<?php

namespace App\Services;

use App\Exceptions\GameEngineException;
use App\Models\GameMatch;
use App\Models\Tactic;
use App\Models\TacticPlayer;
use Illuminate\Support\Facades\Http;
use Throwable;

class GameEngineService
{
    /**
     * Simulates the match with the game engine (POST /simulate, story 3.3
     * contract) and returns the engine response body.
     *
     * The user always plays the challenger side: their tactic is used as
     * saved (home half, defends x=0). The bot tactic is stored in the same
     * home-side convention, so it is mirrored across the halfway line
     * (x -> 100 - x) to defend the right goal.
     *
     * @return array<string, mixed> The engine response (success, file, result, errors)
     *
     * @throws GameEngineException When the engine is unreachable, times out,
     *                             answers an HTTP error, or reports success:false
     */
    public function simulate(GameMatch $match, Tactic $userTactic, Tactic $botTactic): array
    {
        $payload = [
            'match_id' => $match->id,
            'seed' => $match->seed,
            'output_path' => storage_path('simulations'),
            'challenger' => ['players' => $this->teamPayload($userTactic)],
            'opponent' => ['players' => $this->teamPayload($botTactic, mirror: true)],
        ];

        $url = rtrim((string) config('services.game_engine.url'), '/').'/simulate';

        try {
            $response = Http::timeout(35)->post($url, $payload);
        } catch (Throwable $e) {
            throw new GameEngineException('Game engine unreachable: '.$e->getMessage(), 0, $e);
        }

        $body = $response->json();

        if (! $response->successful() || ! is_array($body) || ($body['success'] ?? null) !== true) {
            $error = is_array($body) ? (string) ($body['error'] ?? '') : '';
            throw new GameEngineException(
                "Game engine simulation failed (HTTP {$response->status()}): {$error}"
            );
        }

        // A success response with a malformed result (missing/non-numeric
        // scores, duration, or file) would otherwise poison the match row
        // with undefined-key errors — treat it as a failed simulation.
        $result = $body['result'] ?? null;

        if (
            ! is_array($result)
            || ! is_numeric($result['score_challenger'] ?? null)
            || ! is_numeric($result['score_opponent'] ?? null)
            || ! is_numeric($result['duration_frames'] ?? null)
            || ! is_string($body['file'] ?? null)
        ) {
            throw new GameEngineException('Game engine returned a malformed simulation result');
        }

        return $body;
    }

    /**
     * Builds one team's players payload: engine slots with the script code
     * loaded through the tactic_player -> script relation.
     *
     * @return array<int, array{slot: int, x: float, y: float, script: string}>
     */
    private function teamPayload(Tactic $tactic, bool $mirror = false): array
    {
        return $tactic->players()
            ->with('script')
            ->orderBy('player_slot')
            ->get()
            ->map(fn (TacticPlayer $player): array => [
                'slot' => $player->player_slot,
                'x' => $mirror ? 100.0 - $player->position_x : $player->position_x,
                'y' => $player->position_y,
                // A missing script (deleted between validation and the call)
                // degrades to an idle player, never a broken payload.
                'script' => (string) ($player->script->code ?? ''),
            ])
            ->all();
    }
}
