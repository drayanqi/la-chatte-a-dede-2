<?php

namespace App\Http\Serializers;

use App\Models\GameMatch;

/**
 * The public camelCase JSON shape of a match (the frontend's MatchResult
 * contract). Single source of truth shared by the practice match endpoints
 * and the matchmaking status payloads — do not invent a second shape.
 *
 * No internal paths or ids leak (frames_file, tactic ids stay private).
 */
class MatchSerializer
{
    /**
     * @return array<string, mixed>
     */
    public static function toArray(GameMatch $match): array
    {
        return [
            'id' => $match->id,
            'mode' => $match->mode,
            'status' => $match->status,
            'scoreChallenger' => $match->score_challenger,
            'scoreOpponent' => $match->score_opponent,
            'result' => $match->result,
            // Ranked (Epic 4 v2): the signed elo deltas applied to each
            // fighter's tactic; null while pending/failed and for practice
            'pointsChallenger' => $match->points_challenger,
            'pointsOpponent' => $match->points_opponent,
            'challengerName' => $match->challenger?->username,
            'opponentName' => $match->opponent?->username,
            // Fighter names, not ids (the serializer law keeps tactic ids
            // private); practice matches have no opponent tactic
            'challengerTacticName' => $match->challengerTactic?->name,
            'opponentTacticName' => $match->opponentTactic?->name,
            // Team customization (story 7.4): per-side colors + crest, null
            // when the side has no tactic (practice bot keeps the defaults)
            'challengerColorPrimary' => $match->challengerTactic?->color_primary,
            'challengerColorSecondary' => $match->challengerTactic?->color_secondary,
            'challengerCrest' => $match->challengerTactic?->crest,
            'opponentColorPrimary' => $match->opponentTactic?->color_primary,
            'opponentColorSecondary' => $match->opponentTactic?->color_secondary,
            'opponentCrest' => $match->opponentTactic?->crest,
            'durationFrames' => $match->duration_frames,
            'createdAt' => $match->created_at->toISOString(),
        ];
    }
}
