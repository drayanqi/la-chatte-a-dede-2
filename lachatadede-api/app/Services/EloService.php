<?php

namespace App\Services;

/**
 * The Elo rating math for ranked tactics (Epic 4 v2, story 4.2).
 *
 * Each tactic carries its own rating; K=50 was chosen so two equal-rated
 * tactics exchange exactly +/-25 points per decisive result (the old story
 * 4.4 calibration) and the expected-score term delivers the upset bonus
 * for free: beating a much stronger tactic pays more, beating a much
 * weaker one pays almost nothing.
 *
 * Deltas are symmetric by construction (round() rounds half away from
 * zero), so a win/loss pair and a draw pair always cancel out exactly.
 */
class EloService
{
    public const K = 50;

    public const STARTING_ELO = 1000;

    /**
     * A's expected score against B (1 = certain win, 0.5 = even).
     */
    public function expected(int $ratingA, int $ratingB): float
    {
        return 1.0 / (1.0 + 10.0 ** (($ratingB - $ratingA) / 400.0));
    }

    /**
     * The signed rating deltas for both sides of one match.
     *
     * @return array{0: int, 1: int} [deltaA, deltaB]
     */
    public function deltas(int $ratingA, int $ratingB, float $scoreA): array
    {
        $deltaA = (int) round(self::K * ($scoreA - $this->expected($ratingA, $ratingB)));
        $deltaB = (int) round(self::K * ((1.0 - $scoreA) - $this->expected($ratingB, $ratingA)));

        return [$deltaA, $deltaB];
    }
}
