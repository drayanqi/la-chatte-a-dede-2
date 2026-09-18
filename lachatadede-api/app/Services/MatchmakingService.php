<?php

namespace App\Services;

use App\Models\GameMatch;
use App\Models\MatchmakingQueue;
use App\Models\Tactic;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class MatchmakingService
{
    /**
     * How long a 'waiting' entry stays eligible (seconds). Beyond it the
     * entry no longer pairs (AC #3: "no opponent found within 30 seconds")
     * and the owner's next status poll sees the timeout.
     */
    public const TIMEOUT_SECONDS = 30;

    /**
     * Add the user to the ranked queue and attempt an immediate pairing.
     *
     * The row is upserted (unique user_id): an existing row — whatever its
     * terminal state — is reactivated as 'waiting' with the fresh tactic,
     * rating snapshot and joined_at — except a 'matched' row, which returns
     * its pending ranked match instead of opening a second queue entry
     * behind it. Inside the same transaction, a waiting opponent (other
     * user, not expired, lineup still complete) is paired: one GameMatch
     * (mode 'ranked', status 'pending' — simulation is story 4.2) with the
     * EARLIER joiner as challenger, both queue rows marked 'matched'.
     *
     * Concurrency: two simultaneous joins take the same queue-row locks in
     * opposite order (own row first, then the candidate scan), which MySQL
     * resolves as a deadlock; the transaction is configured to retry such
     * concurrency errors once (same guarantee as the unique-index path:
     * exactly one match, never two).
     *
     * @return array{status: 'waiting'}|array{status: 'matched', match: GameMatch}
     */
    public function join(User $user, Tactic $tactic): array
    {
        try {
            return $this->joinOnce($user, $tactic);
        } catch (UniqueConstraintViolationException) {
            // Lost the upsert race against a concurrent join by the same
            // user (unique index backstop): the row exists now — join again
            // as an idempotent re-join.
            return $this->joinOnce($user, $tactic);
        }
    }

    private function joinOnce(User $user, Tactic $tactic): array
    {
        // attempts: 2 — a deadlock between two simultaneous joins (ABBA on
        // the queue-row locks) rolls back and retries once instead of 500ing
        // one player's request; the unique-index violation below is not a
        // concurrency error and still propagates to join()'s catch.
        return DB::transaction(function () use ($user, $tactic) {
            // lockForUpdate serializes concurrent joins touching the same
            // rows: pairing decisions never race each other.
            $row = MatchmakingQueue::where('user_id', $user->id)->lockForUpdate()->first();

            if ($row !== null && $row->status === 'matched' && $row->match_id !== null) {
                $pending = GameMatch::find($row->match_id);

                // One active ranked match at a time: re-joining while a
                // match is still pending returns it instead of reactivating
                // the row and pairing a second match.
                if ($pending !== null) {
                    return ['status' => 'matched', 'match' => $pending];
                }
            }

            $attributes = [
                'tactic_id' => $tactic->id,
                'rating' => (int) $user->points,
                'status' => 'waiting',
                'match_id' => null,
                'joined_at' => now(),
            ];

            if ($row === null) {
                $row = MatchmakingQueue::create([...$attributes, 'user_id' => $user->id]);
            } else {
                $row->update($attributes);
            }

            $match = $this->tryPairing($row);

            if ($match instanceof GameMatch) {
                return ['status' => 'matched', 'match' => $match];
            }

            return ['status' => 'waiting'];
        });
    }

    /**
     * The user's matchmaking state. Lazily expires the user's own stale
     * 'waiting' row (AC #3: server-enforced 30s timeout — the row flips to
     * 'expired' and the poll reports it once, then idle).
     *
     * @return array{status: 'idle'}|array{status: 'waiting'}|array{status: 'timeout'}|array{status: 'matched', match: GameMatch}
     */
    public function status(User $user): array
    {
        return DB::transaction(function () use ($user) {
            $row = MatchmakingQueue::where('user_id', $user->id)->lockForUpdate()->first();

            if ($row === null || in_array($row->status, ['cancelled', 'expired'], true)) {
                return ['status' => 'idle'];
            }

            if ($row->status === 'matched') {
                $match = $row->match_id !== null ? GameMatch::find($row->match_id) : null;

                if ($match !== null) {
                    return ['status' => 'matched', 'match' => $match];
                }

                return ['status' => 'idle'];
            }

            if ($row->joined_at !== null
                && $row->joined_at->lt(now()->subSeconds(self::TIMEOUT_SECONDS))) {
                $row->update(['status' => 'expired']);

                return ['status' => 'timeout'];
            }

            return ['status' => 'waiting'];
        });
    }

    /**
     * Leave the queue (AC #4). Idempotent: only a 'waiting' row changes —
     * 'matched' entries keep pointing at their match, terminal rows are
     * already out.
     */
    public function cancel(User $user): void
    {
        MatchmakingQueue::where('user_id', $user->id)
            ->where('status', 'waiting')
            ->update(['status' => 'cancelled']);
    }

    /**
     * Pair the freshly (re)queued row with the best waiting opponent: the
     * candidate with the smallest rating difference (ties → the oldest
     * joiner). Candidates that expired or whose lineup broke since they
     * joined are skipped — a ranked match must never be created against an
     * incomplete lineup (the story 4.2 engine payload depends on it).
     */
    private function tryPairing(MatchmakingQueue $myRow): ?GameMatch
    {
        $candidates = MatchmakingQueue::where('status', 'waiting')
            ->where('user_id', '!=', $myRow->user_id)
            ->where('joined_at', '>=', now()->subSeconds(self::TIMEOUT_SECONDS))
            ->orderBy('joined_at')
            ->lockForUpdate()
            ->get();

        if ($candidates->isEmpty()) {
            return null;
        }

        // Lock every involved tactic row (candidates + the joiner's own) in
        // one PK-ordered query: a concurrent tactic delete can no longer gut
        // the match between validation and creation (FK failure or a
        // nullOnDelete cascade), and the shared lock order keeps concurrent
        // joiners from deadlocking on the tactic rows.
        $tactics = Tactic::with('players.script')
            ->whereIn('id', $candidates->pluck('tactic_id')->push($myRow->tactic_id)->unique()->values())
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');

        // The joiner's own tactic vanished mid-transaction: the blocked
        // cascade deletes the queue row right after commit — nothing to pair.
        if (! $tactics->has($myRow->tactic_id)) {
            return null;
        }

        $best = null;
        $bestDiff = PHP_INT_MAX;
        foreach ($candidates as $candidate) {
            if (! $this->lineupComplete($tactics->get($candidate->tactic_id))) {
                continue;
            }

            // Candidates arrive oldest-first, so a strictly smaller diff is
            // the only way to replace the incumbent — ties keep the oldest.
            $diff = abs($candidate->rating - $myRow->rating);
            if ($best === null || $diff < $bestDiff) {
                $best = $candidate;
                $bestDiff = $diff;
            }
        }

        if ($best === null) {
            return null;
        }

        // The earlier joiner is the challenger (deterministic sides).
        [$challenger, $opponent] = $best->joined_at->lte($myRow->joined_at)
            ? [$best, $myRow]
            : [$myRow, $best];

        $match = GameMatch::create([
            'challenger_id' => $challenger->user_id,
            'opponent_id' => $opponent->user_id,
            'challenger_tactic' => $challenger->tactic_id,
            'opponent_tactic' => $opponent->tactic_id,
            'mode' => 'ranked',
            'seed' => random_int(1, 2 ** 31 - 1),
            'status' => 'pending',
        ]);

        $best->update(['status' => 'matched', 'match_id' => $match->id]);
        $myRow->update(['status' => 'matched', 'match_id' => $match->id]);

        return $match;
    }

    /**
     * A tactic can field a match only with 5 slots, each scripted. Null
     * (tactic deleted) counts as incomplete — the controller's join gate
     * and the pairing-time re-validation share this single rule.
     */
    public function lineupComplete(?Tactic $tactic): bool
    {
        return $tactic !== null
            && $tactic->players->count() === 5
            && $tactic->players->every(fn ($player) => $player->script !== null);
    }
}
