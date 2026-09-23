<?php

namespace App\Http\Controllers;

use App\Exceptions\RankedMatchException;
use App\Http\Serializers\MatchSerializer;
use App\Models\Tactic;
use App\Services\RankedMatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * The ranked matchmaking API (Epic 4 v2): browse the challengeable pool and
 * challenge a specific tactic. The match is simulated synchronously — the
 * opponent sees it in their history, online or not.
 */
class MatchmakingController extends Controller
{
    /**
     * The ready tactics of other players, ranked by elo (AC: 4.2 browse).
     */
    public function opponents(RankedMatchService $ranked): JsonResponse
    {
        return response()->json($ranked->opponents(Auth::user()));
    }

    /**
     * Challenge (AC #3/#5): one specific opponent tactic from the pool.
     * 201 with the completed match, or a mapped error (404 unknown tactic,
     * 422 ineligible tactic, 502 failed simulation).
     */
    public function challenge(Request $request, RankedMatchService $ranked): JsonResponse
    {
        $validated = $request->validate([
            'tactic_id' => ['required', 'uuid'],
            'opponent_tactic_id' => ['required', 'uuid'],
        ]);

        $user = Auth::user();

        $mine = $user->tactics()->with('players.script')->find($validated['tactic_id']);
        if (! $mine) {
            return response()->json(['message' => 'Tactic not found'], 404);
        }

        $opponent = Tactic::query()->with('players.script')->find($validated['opponent_tactic_id']);
        if (! $opponent) {
            return response()->json(['message' => 'Tactic not found'], 404);
        }

        try {
            $match = $ranked->challenge($user, $mine, $opponent);
        } catch (RankedMatchException $e) {
            return response()->json(['message' => $e->getMessage()], $e->status);
        }

        return response()->json(MatchSerializer::toArray($match), 201);
    }
}
