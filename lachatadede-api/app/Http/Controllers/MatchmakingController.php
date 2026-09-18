<?php

namespace App\Http\Controllers;

use App\Http\Serializers\MatchSerializer;
use App\Services\MatchmakingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class MatchmakingController extends Controller
{
    /**
     * Join the ranked queue (AC #1, #2): validate the tactic, then let the
     * service upsert the row and attempt an immediate pairing. Idempotent —
     * re-joining returns the current state (waiting, or the freshly created
     * match when an opponent was waiting).
     */
    public function join(Request $request, MatchmakingService $matchmaking): JsonResponse
    {
        $validated = $request->validate([
            'tactic_id' => ['required', 'uuid', 'exists:tactics,id'],
        ]);

        $user = Auth::user();

        $tactic = $user->tactics()->find($validated['tactic_id']);
        if (! $tactic) {
            return response()->json(['message' => 'Tactic not found'], 404);
        }

        // The engine needs a full lineup (same rule as practice matches) —
        // the service's pairing-time re-validation shares this one rule.
        $tactic->load('players.script');
        if (! $matchmaking->lineupComplete($tactic)) {
            return response()->json(['message' => 'Tactic lineup is incomplete'], 422);
        }

        return response()->json($this->serialize($matchmaking->join($user, $tactic)));
    }

    /**
     * Poll the queue state (AC #2, #3): waiting / matched (with the created
     * match) / timeout (server-enforced 30s expiry, reported once) / idle.
     */
    public function status(MatchmakingService $matchmaking): JsonResponse
    {
        return response()->json($this->serialize($matchmaking->status(Auth::user())));
    }

    /**
     * Leave the queue (AC #4). Always 204 — idempotent.
     */
    public function cancel(MatchmakingService $matchmaking): \Illuminate\Http\Response
    {
        $matchmaking->cancel(Auth::user());

        return response()->noContent();
    }

    /**
     * Serialize the service result: the match (when present) goes through
     * the shared serializer — the frontend's MatchResult shape.
     *
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function serialize(array $result): array
    {
        if (isset($result['match'])) {
            $result['match'] = MatchSerializer::toArray($result['match']);
        }

        return $result;
    }
}
