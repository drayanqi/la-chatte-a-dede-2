<?php

namespace App\Http\Controllers;

use App\Models\Tactic;
use Illuminate\Http\JsonResponse;

/**
 * The public leaderboard (story 4.5): every non-system tactic ranked by
 * elo — ready or not, played or never played. A pure read: no transaction,
 * no lock (4.2 elo law applies to writes only). The server computes the
 * 1-based rank; the client renders rows in payload order.
 */
class LeaderboardController extends Controller
{
    public function index(): JsonResponse
    {
        // Multi-key tie-break makes equal-elo ordering deterministic, which
        // the sequential rank numbering depends on
        $tactics = Tactic::query()
            ->with('user')
            ->where('is_system', false)
            ->orderByDesc('elo')
            ->orderByDesc('wins')
            ->orderBy('name')
            ->orderBy('id')
            ->get();

        return response()->json($tactics->map(fn (Tactic $tactic, int $index) => [
            'rank' => $index + 1,
            'id' => $tactic->id,
            'name' => $tactic->name,
            'owner' => $tactic->user?->username,
            'elo' => $tactic->elo,
            'wins' => $tactic->wins,
            'losses' => $tactic->losses,
            'crest' => $tactic->crest,
            'colorPrimary' => $tactic->color_primary,
        ])->values()->all());
    }
}
