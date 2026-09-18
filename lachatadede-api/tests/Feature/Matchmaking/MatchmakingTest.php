<?php

namespace Tests\Feature\Matchmaking;

use App\Models\GameMatch;
use App\Models\MatchmakingQueue;
use App\Models\Script;
use App\Models\Tactic;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MatchmakingTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A 1-2-2 formation tactic (GK, 2 DEF, 2 ATK) with one script per slot.
     */
    private function createUserTactic(User $user, string $name = '1-2-2 Formation'): Tactic
    {
        $tactic = $user->tactics()->create(['name' => $name]);

        $formation = [[8.0, 25.0], [25.0, 15.0], [25.0, 35.0], [40.0, 15.0], [40.0, 35.0]];
        foreach ($formation as $index => [$x, $y]) {
            $script = $user->scripts()->create([
                'name' => 'Slot-'.($index + 1).'.js',
                'code' => 'function update(game) { me.moveToward(50, 25); }',
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
    }

    /**
     * Seed a waiting queue row directly: with pairing on every join, two
     * users can never both be waiting through the API alone — waiting
     * candidates for preference/timeout tests are seeded.
     *
     * @param  array{rating?: int, joined_at?: \DateTimeInterface|null, tactic?: Tactic}  $overrides
     */
    private function seedWaitingRow(User $user, array $overrides = []): MatchmakingQueue
    {
        return MatchmakingQueue::create([
            'user_id' => $user->id,
            'tactic_id' => ($overrides['tactic'] ?? $this->createUserTactic($user, $user->username."'s tactic"))->id,
            'rating' => $overrides['rating'] ?? 0,
            'status' => 'waiting',
            'joined_at' => $overrides['joined_at'] ?? now(),
        ]);
    }

    private function joinQueue(User $user, Tactic $tactic)
    {
        return $this->actingAs($user, 'sanctum')->postJson('/api/matchmaking/queue', [
            'tactic_id' => $tactic->id,
        ]);
    }

    private function pollQueue(User $user)
    {
        return $this->actingAs($user, 'sanctum')->getJson('/api/matchmaking/queue');
    }

    // ------------------------------------------------------------------
    // Join (AC #1)
    // ------------------------------------------------------------------

    public function test_join_requires_authentication(): void
    {
        $this->postJson('/api/matchmaking/queue', ['tactic_id' => 'x'])->assertStatus(401);
        $this->getJson('/api/matchmaking/queue')->assertStatus(401);
        $this->deleteJson('/api/matchmaking/queue')->assertStatus(401);
    }

    public function test_join_with_complete_lineup_returns_waiting(): void
    {
        $user = User::create(['email' => 'a@test.local', 'username' => 'alice', 'password' => 'password123']);
        $tactic = $this->createUserTactic($user);

        $this->joinQueue($user, $tactic)
            ->assertStatus(200)
            ->assertJson(['status' => 'waiting']);

        $this->assertDatabaseHas('matchmaking_queue', [
            'user_id' => $user->id,
            'tactic_id' => $tactic->id,
            'status' => 'waiting',
            'rating' => 0,
        ]);
    }

    public function test_join_with_incomplete_lineup_is_rejected(): void
    {
        $user = User::create(['email' => 'a@test.local', 'username' => 'alice', 'password' => 'password123']);
        $tactic = $this->createUserTactic($user);

        // Slot 5 loses its script: the lineup no longer fields a match.
        Script::where('user_id', $user->id)->orderByDesc('created_at')->first()->delete();

        $this->joinQueue($user, $tactic)
            ->assertStatus(422)
            ->assertJson(['message' => 'Tactic lineup is incomplete']);

        $this->assertDatabaseCount('matchmaking_queue', 0);
    }

    public function test_join_with_another_users_tactic_is_not_found(): void
    {
        $owner = User::create(['email' => 'a@test.local', 'username' => 'alice', 'password' => 'password123']);
        $intruder = User::create(['email' => 'b@test.local', 'username' => 'bob', 'password' => 'password123']);
        $tactic = $this->createUserTactic($owner);

        $this->joinQueue($intruder, $tactic)->assertStatus(404);
    }

    public function test_rejoin_is_idempotent_and_refreshes_the_row(): void
    {
        $user = User::create(['email' => 'a@test.local', 'username' => 'alice', 'password' => 'password123']);
        $tacticA = $this->createUserTactic($user, 'First');
        $tacticB = $this->createUserTactic($user, 'Second');

        $this->joinQueue($user, $tacticA)->assertStatus(200)->assertJson(['status' => 'waiting']);
        $this->joinQueue($user, $tacticB)->assertStatus(200)->assertJson(['status' => 'waiting']);

        // One row (unique user_id), pointing at the latest tactic.
        $this->assertDatabaseCount('matchmaking_queue', 1);
        $this->assertDatabaseHas('matchmaking_queue', [
            'user_id' => $user->id,
            'tactic_id' => $tacticB->id,
            'status' => 'waiting',
        ]);
    }

    public function test_rejoining_while_a_ranked_match_is_pending_returns_it(): void
    {
        $alice = User::create(['email' => 'a@test.local', 'username' => 'alice', 'password' => 'password123']);
        $bob = User::create(['email' => 'b@test.local', 'username' => 'bob', 'password' => 'password123']);

        $this->seedWaitingRow($alice);
        $tacticB = $this->createUserTactic($bob, 'Bob tactic');
        $this->joinQueue($bob, $tacticB)->assertJson(['status' => 'matched']);

        // Bob re-joins (e.g. after dismissing the banner): the still-pending
        // match comes back — never a second match, never a reactivated
        // waiting row (one active ranked match at a time).
        $matchId = GameMatch::sole()->id;
        $this->joinQueue($bob, $tacticB)
            ->assertOk()
            ->assertJsonPath('status', 'matched')
            ->assertJsonPath('match.id', $matchId);

        $this->assertDatabaseCount('matches', 1);
        $this->assertDatabaseHas('matchmaking_queue', [
            'user_id' => $bob->id,
            'status' => 'matched',
            'match_id' => $matchId,
        ]);
    }

    // ------------------------------------------------------------------
    // Pairing (AC #2)
    // ------------------------------------------------------------------

    public function test_two_queued_users_are_paired_into_a_ranked_match(): void
    {
        $alice = User::create(['email' => 'a@test.local', 'username' => 'alice', 'password' => 'password123']);
        $bob = User::create(['email' => 'b@test.local', 'username' => 'bob', 'password' => 'password123']);
        $tacticA = $this->createUserTactic($alice, 'Alice tactic');
        $tacticB = $this->createUserTactic($bob, 'Bob tactic');

        $this->joinQueue($alice, $tacticA)->assertJson(['status' => 'waiting']);
        $this->joinQueue($bob, $tacticB)->assertJson(['status' => 'matched']);

        // Both sides discover the SAME match through their own poll.
        $pollA = $this->pollQueue($alice)->assertJsonPath('status', 'matched');
        $pollB = $this->pollQueue($bob)->assertJsonPath('status', 'matched');
        $matchIdA = $pollA->json('match.id');
        $matchIdB = $pollB->json('match.id');
        $this->assertNotNull($matchIdA);
        $this->assertSame($matchIdA, $matchIdB);

        // The match row: ranked superset columns per the pairing rules —
        // earlier joiner is the challenger, simulation is story 4.2 (pending).
        $match = GameMatch::findOrFail($matchIdA);
        $this->assertSame('ranked', $match->mode);
        $this->assertSame($alice->id, $match->challenger_id);
        $this->assertSame($bob->id, $match->opponent_id);
        $this->assertSame($tacticA->id, $match->challenger_tactic);
        $this->assertSame($tacticB->id, $match->opponent_tactic);
        $this->assertSame('pending', $match->status);
        $this->assertGreaterThan(0, $match->seed);
        $this->assertSame(0, $match->score_challenger);
        $this->assertSame(0, $match->score_opponent);
        $this->assertNull($match->result);
        $this->assertNull($match->points_challenger);
        $this->assertNull($match->points_opponent);

        // Both queue rows are matched and stamped with the match.
        $this->assertDatabaseHas('matchmaking_queue', [
            'user_id' => $alice->id, 'status' => 'matched', 'match_id' => $match->id,
        ]);
        $this->assertDatabaseHas('matchmaking_queue', [
            'user_id' => $bob->id, 'status' => 'matched', 'match_id' => $match->id,
        ]);

        // The serialized payload keeps the public MatchResult shape.
        $pollA->assertJsonPath('match.mode', 'ranked');
        $pollA->assertJsonPath('match.status', 'pending');
    }

    public function test_pairing_prefers_the_closest_rating(): void
    {
        $alice = User::create(['email' => 'a@test.local', 'username' => 'alice', 'password' => 'password123']);
        $bob = User::create(['email' => 'b@test.local', 'username' => 'bob', 'password' => 'password123', 'points' => 100]);
        $carol = User::create(['email' => 'c@test.local', 'username' => 'carol', 'password' => 'password123', 'points' => 95]);

        // Alice (rating 0) and Bob (rating 100) wait; Carol (rating 95)
        // joins and must pair with Bob, leaving Alice waiting.
        $this->seedWaitingRow($alice, ['rating' => 0]);
        $this->seedWaitingRow($bob, ['rating' => 100]);

        $tacticC = $this->createUserTactic($carol, 'Carol tactic');
        $this->joinQueue($carol, $tacticC)->assertJson(['status' => 'matched']);

        $this->assertDatabaseCount('matches', 1);
        $match = GameMatch::sole();
        $this->assertSame($bob->id, $match->challenger_id);
        $this->assertSame($carol->id, $match->opponent_id);

        $this->assertDatabaseHas('matchmaking_queue', [
            'user_id' => $alice->id, 'status' => 'waiting', 'match_id' => null,
        ]);
        $this->assertDatabaseHas('matchmaking_queue', [
            'user_id' => $bob->id, 'status' => 'matched', 'match_id' => $match->id,
        ]);
    }

    public function test_pairing_skips_candidates_whose_lineup_broke(): void
    {
        $alice = User::create(['email' => 'a@test.local', 'username' => 'alice', 'password' => 'password123']);
        $bob = User::create(['email' => 'b@test.local', 'username' => 'bob', 'password' => 'password123']);

        // Alice queued, then lost a slot's script: her entry must be skipped.
        $brokenTactic = $this->createUserTactic($alice, 'Broken lineup');
        Script::where('user_id', $alice->id)->orderByDesc('created_at')->first()->delete();
        $this->seedWaitingRow($alice, ['tactic' => $brokenTactic]);

        $tacticB = $this->createUserTactic($bob, 'Bob tactic');
        $this->joinQueue($bob, $tacticB)->assertJson(['status' => 'waiting']);

        $this->assertDatabaseCount('matches', 0);
    }

    // ------------------------------------------------------------------
    // Timeout (AC #3)
    // ------------------------------------------------------------------

    public function test_stale_waiting_entry_expires_on_poll(): void
    {
        $user = User::create(['email' => 'a@test.local', 'username' => 'alice', 'password' => 'password123']);
        $tactic = $this->createUserTactic($user);

        $this->joinQueue($user, $tactic)->assertJson(['status' => 'waiting']);
        MatchmakingQueue::where('user_id', $user->id)->update(['joined_at' => now()->subSeconds(31)]);

        $this->pollQueue($user)->assertOk()->assertJson(['status' => 'timeout']);
        $this->assertDatabaseHas('matchmaking_queue', ['user_id' => $user->id, 'status' => 'expired']);

        // The timeout is reported once; afterwards the user is idle.
        $this->pollQueue($user)->assertOk()->assertJson(['status' => 'idle']);
    }

    public function test_an_expired_entry_never_pairs(): void
    {
        $alice = User::create(['email' => 'a@test.local', 'username' => 'alice', 'password' => 'password123']);
        $bob = User::create(['email' => 'b@test.local', 'username' => 'bob', 'password' => 'password123']);

        $this->seedWaitingRow($alice, ['joined_at' => now()->subSeconds(31)]);

        $tacticB = $this->createUserTactic($bob, 'Bob tactic');
        $this->joinQueue($bob, $tacticB)->assertJson(['status' => 'waiting']);

        $this->assertDatabaseCount('matches', 0);
    }

    // ------------------------------------------------------------------
    // Cancel (AC #4)
    // ------------------------------------------------------------------

    public function test_cancel_removes_the_user_from_the_queue(): void
    {
        $user = User::create(['email' => 'a@test.local', 'username' => 'alice', 'password' => 'password123']);
        $tactic = $this->createUserTactic($user);

        $this->joinQueue($user, $tactic)->assertJson(['status' => 'waiting']);

        $this->deleteJson('/api/matchmaking/queue')->assertStatus(204);

        $this->pollQueue($user)->assertOk()->assertJson(['status' => 'idle']);
        $this->assertDatabaseHas('matchmaking_queue', ['user_id' => $user->id, 'status' => 'cancelled']);
    }

    public function test_cancel_is_idempotent(): void
    {
        $user = User::create(['email' => 'a@test.local', 'username' => 'alice', 'password' => 'password123']);

        // No row at all, and no waiting row: both calls stay 204.
        $this->actingAs($user, 'sanctum')->deleteJson('/api/matchmaking/queue')->assertStatus(204);
        $this->actingAs($user, 'sanctum')->deleteJson('/api/matchmaking/queue')->assertStatus(204);
    }

    public function test_cancelling_does_not_touch_a_matched_entry(): void
    {
        $alice = User::create(['email' => 'a@test.local', 'username' => 'alice', 'password' => 'password123']);
        $bob = User::create(['email' => 'b@test.local', 'username' => 'bob', 'password' => 'password123']);

        $this->seedWaitingRow($alice);
        $tacticB = $this->createUserTactic($bob, 'Bob tactic');
        $this->joinQueue($bob, $tacticB)->assertJson(['status' => 'matched']);

        // Bob cancels after being matched: his matched row (and the match
        // reference) is untouched — the match itself is not cancellable here.
        $this->deleteJson('/api/matchmaking/queue')->assertStatus(204);

        $this->pollQueue($bob)->assertOk()->assertJsonPath('status', 'matched');
    }

    // ------------------------------------------------------------------
    // Self-pairing guard (AC #2)
    // ------------------------------------------------------------------

    public function test_a_solo_user_stays_waiting_and_never_pairs_with_self(): void
    {
        $user = User::create(['email' => 'a@test.local', 'username' => 'alice', 'password' => 'password123']);
        $tactic = $this->createUserTactic($user);

        $this->joinQueue($user, $tactic)->assertJson(['status' => 'waiting']);

        $this->pollQueue($user)->assertOk()->assertJson(['status' => 'waiting']);
        $this->pollQueue($user)->assertOk()->assertJson(['status' => 'waiting']);

        $this->assertDatabaseCount('matches', 0);
    }
}
