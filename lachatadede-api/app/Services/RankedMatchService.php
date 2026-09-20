<?php

namespace App\Services;

use App\Exceptions\RankedMatchException;
use App\Models\GameMatch;
use App\Models\Tactic;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * The ranked challenge engine (Epic 4 v2, story 4.2).
 *
 * A match is created the moment it is challenged and simulated
 * synchronously in the request — the opponent does not need to be online;
 * they read the result in their history. elo, wins and losses live on the
 * TACTIC (a tactic is a ranked fighter), and the result write is a single
 * transaction so both fighters' records move together or not at all.
 */
class RankedMatchService
{
    public function __construct(
        private readonly GameEngineService $engine,
        private readonly EloService $elo,
    ) {}

    /**
     * The challengeable pool: ready tactics of OTHER players, non-system,
     * lineup still complete (re-validated live — a ready flag can go stale
     * when its owner breaks the lineup after toggling). Ranked by elo.
     *
     * @return list<array{id: string, name: string, owner: string|null, elo: int, wins: int, losses: int}>
     */
    public function opponents(User $user): array
    {
        return $this->poolTactics($user)
            ->map(fn (Tactic $tactic) => [
                'id' => $tactic->id,
                'name' => $tactic->name,
                'owner' => $tactic->user?->username,
                'elo' => $tactic->elo,
                'wins' => $tactic->wins,
                'losses' => $tactic->losses,
            ])
            ->all();
    }

    /**
     * Quick match (AC #1, #2): a RANDOM pool opponent, any elo (band
     * matching is deferred). Empty pool → 404.
     */
    public function quickMatch(User $user, Tactic $mine): GameMatch
    {
        $this->assertFieldable($mine, 'Your tactic');

        $pool = $this->poolTactics($user)->values();

        if ($pool->isEmpty()) {
            throw new RankedMatchException('No opponents ready', 404);
        }

        $opponent = $pool->random();

        return $this->play($user, $mine, $opponent);
    }

    /**
     * Challenge (AC #3, #5): one specific opponent tactic, which must be a
     * genuine pool member (ready, complete, foreign, non-system).
     */
    public function challenge(User $user, Tactic $mine, Tactic $opponent): GameMatch
    {
        $this->assertFieldable($mine, 'Your tactic');

        if ($opponent->is_system) {
            throw new RankedMatchException('Tactic is not ready', 422);
        }

        if ($opponent->user_id === $user->id) {
            throw new RankedMatchException('You cannot challenge your own tactic', 422);
        }

        if (! $opponent->is_ready) {
            throw new RankedMatchException('Tactic is not ready', 422);
        }

        if (! $opponent->lineupIsComplete()) {
            throw new RankedMatchException('Tactic lineup is incomplete', 422);
        }

        return $this->play($user, $mine, $opponent);
    }

    /**
     * The initiator side: owned (enforced by the controller's scoping),
     * ready, and lineup complete — the engine payload depends on it.
     */
    private function assertFieldable(Tactic $tactic, string $label): void
    {
        if (! $tactic->is_ready) {
            throw new RankedMatchException($label.' is not ready', 422);
        }

        if (! $tactic->lineupIsComplete()) {
            throw new RankedMatchException('Tactic lineup is incomplete', 422);
        }
    }

    /**
     * @return Collection<int, Tactic>
     */
    private function poolTactics(User $user): Collection
    {
        return Tactic::query()
            ->with(['players.script', 'user'])
            ->where('is_ready', true)
            ->where('is_system', false)
            ->where('user_id', '!=', $user->id)
            ->orderByDesc('elo')
            ->get()
            ->filter(fn (Tactic $tactic) => $tactic->lineupIsComplete())
            ->values();
    }

    /**
     * One ranked match, end to end: row → engine simulation → result +
     * elo write. The engine call stays OUTSIDE the transaction (a 6s
     * simulation must not hold tactic-row locks); elo is only applied to
     * a completed match inside the final transaction, so a mid-flight
     * crash leaves a pending row and zero elo movement.
     */
    private function play(User $user, Tactic $mine, Tactic $opponent): GameMatch
    {
        $match = GameMatch::create([
            'challenger_id' => $user->id,
            'opponent_id' => $opponent->user_id,
            'challenger_tactic' => $mine->id,
            'opponent_tactic' => $opponent->id,
            'mode' => 'ranked',
            'seed' => random_int(1, 2 ** 31 - 1),
            'status' => 'pending',
        ]);

        try {
            $result = $this->engine->simulate($match, $mine, $opponent);
        } catch (Throwable) {
            // A non-engine failure (unreachable engine, malformed body) fails
            // the row the same way — never leave it pending forever.
            $match->update(['status' => 'failed']);

            throw new RankedMatchException('Simulation failed', 502);
        }

        // The engine reports the file it wrote; derive the storage-relative
        // path (same rule as practice) and refuse to complete a match whose
        // frames never landed.
        $framesFile = 'simulations/'.basename((string) ($result['file'] ?? ''));
        if (! is_file(storage_path($framesFile))) {
            $match->update(['status' => 'failed']);

            throw new RankedMatchException('Simulation failed', 502);
        }

        $this->finalize($match, $mine->id, $opponent->id, $result, $framesFile);

        return $match->fresh();
    }

    /**
     * The result write: match row + both tactics' elo and counters in ONE
     * transaction. Both tactic rows are locked PK-ordered so concurrent
     * completions serialize and always read each other's fresh elo.
     *
     * @param  array<string, mixed>  $result
     */
    private function finalize(GameMatch $match, string $challengerTacticId, string $opponentTacticId, array $result, string $framesFile): void
    {
        DB::transaction(function () use ($match, $challengerTacticId, $opponentTacticId, $result, $framesFile) {
            $tactics = Tactic::query()
                ->whereIn('id', [$challengerTacticId, $opponentTacticId])
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $challengerTactic = $tactics->get($challengerTacticId);
            $opponentTactic = $tactics->get($opponentTacticId);

            if ($challengerTactic === null || $opponentTactic === null) {
                // A tactic was deleted mid-flight (nullOnDelete FK): the match
                // cannot be completed — fail it, no elo ever moved.
                $match->update(['status' => 'failed']);

                throw new RankedMatchException('Simulation failed', 502);
            }

            $scoreChallenger = (int) $result['result']['score_challenger'];
            $scoreOpponent = (int) $result['result']['score_opponent'];
            $outcome = $scoreChallenger > $scoreOpponent
                ? 'challenger_win'
                : ($scoreChallenger < $scoreOpponent ? 'opponent_win' : 'draw');

            // Score from the challenger's perspective: 1 win, 0.5 draw, 0 loss
            $scoreA = $outcome === 'challenger_win' ? 1.0 : ($outcome === 'draw' ? 0.5 : 0.0);

            [$deltaChallenger, $deltaOpponent] = $this->elo->deltas(
                $challengerTactic->elo,
                $opponentTactic->elo,
                $scoreA,
            );

            // Draws move elo symmetrically but never the W/L counters (Pelo:
            // the record is wins/losses only). elo is floored at 0.
            $challengerTactic->update([
                'elo' => max(0, $challengerTactic->elo + $deltaChallenger),
                'wins' => $challengerTactic->wins + ($outcome === 'challenger_win' ? 1 : 0),
                'losses' => $challengerTactic->losses + ($outcome === 'opponent_win' ? 1 : 0),
            ]);

            $opponentTactic->update([
                'elo' => max(0, $opponentTactic->elo + $deltaOpponent),
                'wins' => $opponentTactic->wins + ($outcome === 'opponent_win' ? 1 : 0),
                'losses' => $opponentTactic->losses + ($outcome === 'challenger_win' ? 1 : 0),
            ]);

            $match->update([
                'score_challenger' => $scoreChallenger,
                'score_opponent' => $scoreOpponent,
                'result' => $outcome,
                'duration_frames' => (int) $result['result']['duration_frames'],
                'status' => 'completed',
                'frames_file' => $framesFile,
                'points_challenger' => $deltaChallenger,
                'points_opponent' => $deltaOpponent,
            ]);
        });
    }
}
