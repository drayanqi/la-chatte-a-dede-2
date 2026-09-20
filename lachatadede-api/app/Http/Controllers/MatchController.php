<?php

namespace App\Http\Controllers;

use App\Exceptions\GameEngineException;
use App\Http\Serializers\MatchSerializer;
use App\Models\GameMatch;
use App\Services\GameEngineService;
use App\Services\SystemTacticService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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

        $botTactic = app(SystemTacticService::class)->ensureEasyBotTactic();

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

        return response()->json(MatchSerializer::toArray($match->fresh()), 201);
    }

    /**
     * List the user's matches, newest first (FR34: most recent match),
     * paginated 20 per page. Covers BOTH sides (Epic 4 v2): a ranked
     * challenge is unilateral — the offline opponent reads the match in
     * their history. Optional `?tactic_id=` filters to one of the user's
     * tactics on either side (per-tactic record, story 4.4's query shape).
     */
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();

        $tacticId = null;
        if ($request->filled('tactic_id')) {
            $tactic = $user->tactics()->find($request->query('tactic_id'));
            if (! $tactic) {
                return response()->json(['message' => 'Tactic not found'], 404);
            }
            $tacticId = $tactic->id;
        }

        $matches = GameMatch::query()
            ->forUser($user)
            ->with(['challenger', 'opponent'])
            ->when($tacticId !== null, function ($query) use ($tacticId) {
                $query->where(function ($q) use ($tacticId) {
                    $q->where('challenger_tactic', $tacticId)
                        ->orWhere('opponent_tactic', $tacticId);
                });
            })
            ->orderBy('created_at', 'desc')
            ->paginate(20)
            ->through(fn (GameMatch $match) => MatchSerializer::toArray($match));

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

        return response()->json(MatchSerializer::toArray($match));
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
}
