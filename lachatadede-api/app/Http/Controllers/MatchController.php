<?php

namespace App\Http\Controllers;

use App\Exceptions\GameEngineException;
use App\Models\GameMatch;
use App\Models\Tactic;
use App\Models\User;
use App\Services\GameEngineService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Throwable;

class MatchController extends Controller
{
    /**
     * Start a practice match (AC #1, #3): a single synchronous request —
     * create the row, simulate against the bot, persist the result. There is
     * no queue and no polling; the response only returns once the simulation
     * finished (or failed, AC #4).
     */
    public function store(Request $request, GameEngineService $engine): JsonResponse
    {
        $validated = $request->validate([
            'mode' => ['required', 'string', 'in:practice'],
            'tactic_id' => ['required', 'uuid', 'exists:tactics,id'],
            'bot' => ['required', 'string', 'in:easy'],
        ]);

        $user = Auth::user();

        $tactic = $user->tactics()->with('players.script')->find($validated['tactic_id']);
        if (! $tactic) {
            return response()->json(['message' => 'Tactic not found'], 404);
        }

        // The engine needs a full lineup: 5 slots, each with a script.
        $lineupComplete = $tactic->players->count() === 5
            && $tactic->players->every(fn ($player) => $player->script !== null);
        if (! $lineupComplete) {
            return response()->json(['message' => 'Tactic lineup is incomplete'], 422);
        }

        $botTactic = $this->resolveEasyBotTactic();

        $match = GameMatch::create([
            'challenger_id' => $user->id,
            'challenger_tactic' => $tactic->id,
            'bot_tactic' => $botTactic->id,
            'mode' => 'practice',
            'seed' => random_int(1, 2 ** 31 - 1),
            'status' => 'pending',
        ]);

        try {
            $result = $engine->simulate($match, $tactic, $botTactic);
        } catch (GameEngineException) {
            // AC #4: mark the row failed; it is never presented as watchable.
            $match->update(['status' => 'failed']);

            return response()->json(['message' => 'Simulation failed'], 502);
        } catch (Throwable) {
            // A non-engine failure (malformed engine body, unexpected error)
            // must fail the row the same way — never leave it pending forever.
            $match->update(['status' => 'failed']);

            return response()->json(['message' => 'Simulation failed'], 502);
        }

        // The engine reports the file it wrote; derive the storage-relative
        // path from it (basename strips the engine-side mount prefix) and
        // refuse to mark a match completed whose frames never landed
        // (AC #4: never present a broken match as watchable).
        $framesFile = 'simulations/'.basename((string) ($result['file'] ?? ''));
        if (! is_file(storage_path($framesFile))) {
            $match->update(['status' => 'failed']);

            return response()->json(['message' => 'Simulation failed'], 502);
        }

        $match->update([
            'score_challenger' => $result['result']['score_challenger'],
            'score_opponent' => $result['result']['score_opponent'],
            // The /simulate response carries scores only (no winner key);
            // the outcome is derived from the final score.
            'result' => $this->outcome(
                (int) $result['result']['score_challenger'],
                (int) $result['result']['score_opponent']
            ),
            'duration_frames' => $result['result']['duration_frames'],
            'status' => 'completed',
            'frames_file' => $framesFile,
        ]);

        return response()->json($this->serializeMatch($match->fresh()), 201);
    }

    /**
     * List the user's matches, newest first (FR34: most recent match),
     * paginated 20 per page.
     */
    public function index(): JsonResponse
    {
        $matches = Auth::user()->matches()
            ->orderBy('created_at', 'desc')
            ->paginate(20)
            ->through(fn (GameMatch $match) => $this->serializeMatch($match));

        return response()->json($matches);
    }

    /**
     * Get a single match, scoped to its owner.
     */
    public function show(string $id): JsonResponse
    {
        $match = Auth::user()->matches()->find($id);

        if (! $match) {
            return response()->json(['message' => 'Match not found'], 404);
        }

        return response()->json($this->serializeMatch($match));
    }

    /**
     * Stream the match frames file (storage/simulations/{id}.json), consumed
     * by the replay player (story 3.8). Only completed matches with a file on
     * disk are watchable; everything else is a 404 (AC #4).
     */
    public function frames(string $id): JsonResponse|\Symfony\Component\HttpFoundation\BinaryFileResponse
    {
        $match = Auth::user()->matches()->find($id);

        if (! $match || $match->status !== 'completed' || ! $match->frames_file) {
            return response()->json(['message' => 'Match frames not found'], 404);
        }

        $path = storage_path($match->frames_file);

        // Containment: frames_file is a DB value, so never serve anything
        // from outside the simulations directory (defense in depth against
        // a corrupted or tampered row).
        $root = realpath(storage_path('simulations'));
        if (! is_file($path) || $root === false
            || ! str_starts_with((string) realpath($path), $root.DIRECTORY_SEPARATOR)) {
            return response()->json(['message' => 'Match frames not found'], 404);
        }

        return response()->file($path);
    }

    /**
     * Derive the match result column from the final score.
     */
    private function outcome(int $scoreChallenger, int $scoreOpponent): string
    {
        return match (true) {
            $scoreChallenger > $scoreOpponent => 'challenger_win',
            $scoreChallenger < $scoreOpponent => 'opponent_win',
            default => 'draw',
        };
    }

    /**
     * Resolve the system tactic driving the Easy Bot.
     *
     * Story 3.5 stub — replaced by the real Easy Bot seeding in story 3.6.
     * The tactic's 5 slots run idle placeholder scripts, owned by a dedicated
     * system user (scripts.user_id is NOT NULL). Created on demand so the
     * endpoint also works on a freshly migrated database (e.g. E2E runs,
     * which migrate without seeding).
     */
    private function resolveEasyBotTactic(): Tactic
    {
        try {
            return $this->resolveEasyBotTacticOnce();
        } catch (UniqueConstraintViolationException) {
            // Lost the system-user create race against a concurrent first
            // match (e.g. parallel E2E workers): everything exists now —
            // resolve again from the committed state.
            return $this->resolveEasyBotTacticOnce();
        }
    }

    private function resolveEasyBotTacticOnce(): Tactic
    {
        return DB::transaction(function () {
            // lockForUpdate serializes concurrent first calls: the second
            // transaction waits here, then sees what the first committed.
            $existing = Tactic::where('is_system', true)->lockForUpdate()->first();

            if ($existing && $this->systemTacticIsComplete($existing)) {
                return $existing;
            }

            if ($existing) {
                // A crash mid-creation left a partial tactic; rebuild it so
                // one bad row cannot 502 every future practice match.
                $existing->delete();
            }

            $systemUser = User::firstWhere('email', 'system-bot@lachatadede.local')
                ?? User::create([
                    'email' => 'system-bot@lachatadede.local',
                    'username' => 'EasyBot',
                    'password' => bin2hex(random_bytes(16)),
                ]);

            $tactic = Tactic::create(['name' => 'Easy Bot', 'is_system' => true]);

            $formation = [[8.0, 25.0], [25.0, 15.0], [25.0, 35.0], [40.0, 15.0], [40.0, 35.0]];
            foreach ($formation as $index => [$x, $y]) {
                $script = $systemUser->scripts()->create([
                    'name' => 'EasyBot-'.($index + 1),
                    'code' => 'function update(game) {}',
                    'language' => 'javascript',
                ]);
                $tactic->players()->create([
                    'player_slot' => $index + 1,
                    'position_x' => $x,
                    'position_y' => $y,
                    'script_id' => $script->id,
                ]);
            }

            return $tactic;
        });
    }

    /**
     * The system tactic is usable only with all 5 slots scripted.
     */
    private function systemTacticIsComplete(Tactic $tactic): bool
    {
        return $tactic->players()->count() === 5
            && $tactic->players()->whereNull('script_id')->doesntExist();
    }

    /**
     * Public API shape (camelCase) — no internal paths or ids leak.
     *
     * @return array<string, mixed>
     */
    private function serializeMatch(GameMatch $match): array
    {
        return [
            'id' => $match->id,
            'mode' => $match->mode,
            'status' => $match->status,
            'scoreChallenger' => $match->score_challenger,
            'scoreOpponent' => $match->score_opponent,
            'result' => $match->result,
            'durationFrames' => $match->duration_frames,
            'createdAt' => $match->created_at->toISOString(),
        ];
    }
}
