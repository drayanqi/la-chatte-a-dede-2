<?php

namespace Tests\Feature\Leaderboard;

use App\Models\Tactic;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LeaderboardTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A minimal user tactic with an optionally pre-rated record (elo/wins/
     * losses are server-managed columns set through the model, never the
     * API — same convention as RankedMatchmakingTest). The leaderboard has
     * no lineup requirements: never-played and not-ready tactics appear.
     */
    private function createUserTactic(User $user, string $name = '1-2-2 Formation', array $ranked = []): Tactic
    {
        return $user->tactics()->create(['name' => $name, ...$ranked]);
    }

    public function test_leaderboard_requires_authentication(): void
    {
        $this->getJson('/api/leaderboard')->assertStatus(401);
    }

    public function test_tactics_are_ranked_by_elo_with_sequential_ranks(): void
    {
        $me = User::factory()->create();
        $bronze = User::factory()->create(['username' => 'bronze']);
        $silver = User::factory()->create(['username' => 'silver']);
        $gold = User::factory()->create(['username' => 'gold']);

        $this->createUserTactic($bronze, 'Bronze Fighter', ['elo' => 900, 'wins' => 1, 'losses' => 2]);
        $this->createUserTactic($silver, 'Silver Fighter', ['elo' => 1100, 'wins' => 3, 'losses' => 1]);
        $this->createUserTactic($gold, 'Gold Fighter', ['elo' => 1300, 'wins' => 5, 'losses' => 0]);
        $mine = $this->createUserTactic($me, 'My Fighter', ['elo' => 1000, 'wins' => 0, 'losses' => 1]);

        $response = $this->actingAs($me, 'sanctum')
            ->getJson('/api/leaderboard')
            ->assertOk()
            ->assertJsonCount(4);

        $this->assertSame([
            ['rank' => 1, 'id' => $response->json('0.id'), 'name' => 'Gold Fighter', 'owner' => 'gold', 'elo' => 1300, 'wins' => 5, 'losses' => 0],
            ['rank' => 2, 'id' => $response->json('1.id'), 'name' => 'Silver Fighter', 'owner' => 'silver', 'elo' => 1100, 'wins' => 3, 'losses' => 1],
            ['rank' => 3, 'id' => $mine->id, 'name' => 'My Fighter', 'owner' => $me->username, 'elo' => 1000, 'wins' => 0, 'losses' => 1],
            ['rank' => 4, 'id' => $response->json('3.id'), 'name' => 'Bronze Fighter', 'owner' => 'bronze', 'elo' => 900, 'wins' => 1, 'losses' => 2],
        ], $response->json());
    }

    public function test_system_tactics_are_excluded(): void
    {
        $me = User::factory()->create();
        $system = Tactic::create(['name' => 'Easy Bot', 'is_system' => true, 'elo' => 9999, 'wins' => 100]);
        $rival = User::factory()->create();
        $this->createUserTactic($rival, 'Rival Fighter', ['elo' => 1050]);

        $response = $this->actingAs($me, 'sanctum')
            ->getJson('/api/leaderboard')
            ->assertOk()
            ->assertJsonCount(1);

        $this->assertSame('Rival Fighter', $response->json('0.name'));
        $this->assertNotSame($system->id, $response->json('0.id'));
    }

    public function test_not_ready_and_never_played_tactics_appear(): void
    {
        $me = User::factory()->create();
        $rival = User::factory()->create();

        // Not ready and never played: the board is a census, not a pool
        $this->createUserTactic($rival, 'Sleeping Giant');
        $this->createUserTactic($me, 'Fresh Recruit');

        $response = $this->actingAs($me, 'sanctum')
            ->getJson('/api/leaderboard')
            ->assertOk()
            ->assertJsonCount(2);

        collect($response->json())->each(function (array $row) {
            $this->assertSame(1000, $row['elo']);
            $this->assertSame(0, $row['wins']);
            $this->assertSame(0, $row['losses']);
        });
    }

    public function test_equal_elo_ties_break_by_wins_then_name(): void
    {
        $me = User::factory()->create();
        $rival = User::factory()->create();

        $this->createUserTactic($rival, 'Yankee Fighter', ['elo' => 1000, 'wins' => 1, 'losses' => 1]);
        $this->createUserTactic($me, 'Zulu Fighter', ['elo' => 1000, 'wins' => 2, 'losses' => 2]);
        $this->createUserTactic($me, 'Beta Fighter', ['elo' => 1000, 'wins' => 2, 'losses' => 0]);
        $this->createUserTactic($me, 'Alpha Fighter', ['elo' => 1000, 'wins' => 2, 'losses' => 0]);

        $response = $this->actingAs($me, 'sanctum')
            ->getJson('/api/leaderboard')
            ->assertOk()
            ->assertJsonCount(4);

        // Same elo: more wins first; equal wins: name asc — ranks stay 1..N
        $this->assertSame(
            ['Alpha Fighter', 'Beta Fighter', 'Zulu Fighter', 'Yankee Fighter'],
            collect($response->json())->pluck('name')->all()
        );
        $this->assertSame([1, 2, 3, 4], collect($response->json())->pluck('rank')->all());
    }

    public function test_rows_expose_the_rank_shape_and_nothing_more(): void
    {
        $me = User::factory()->create();
        $rival = User::factory()->create();

        $rivalTactic = $this->createUserTactic($rival, 'Rival Fighter', ['elo' => 1050, 'wins' => 2, 'losses' => 1]);
        $rivalTactic->players()->create([
            'player_slot' => 1,
            'position_x' => 8.0,
            'position_y' => 25.0,
        ]);

        $mine = $this->createUserTactic($me, 'My Fighter');
        $mine->players()->create([
            'player_slot' => 1,
            'position_x' => 8.0,
            'position_y' => 25.0,
        ]);

        $row = $this->actingAs($me, 'sanctum')
            ->getJson('/api/leaderboard')
            ->assertOk()
            ->assertJsonCount(2)
            ->json('1');

        // Exact shape: rank + the census columns, NOTHING else (NFR9: no
        // players, no scripts, no ids beyond the tactic's own)
        $this->assertSame(
            ['rank', 'id', 'name', 'owner', 'elo', 'wins', 'losses'],
            array_keys($row)
        );
        $this->assertSame(2, $row['rank']);
        $this->assertSame($mine->id, $row['id']);
        $this->assertSame('My Fighter', $row['name']);
        $this->assertSame($me->username, $row['owner']);
        $this->assertSame(1000, $row['elo']);
        $this->assertSame(0, $row['wins']);
        $this->assertSame(0, $row['losses']);

        // Negative assertions (4.4 serializer law): the forbidden keys stay out
        $this->assertArrayNotHasKey('players', $row);
        $this->assertArrayNotHasKey('isSystem', $row);
        $this->assertArrayNotHasKey('isReady', $row);
        $this->assertArrayNotHasKey('userId', $row);
    }
}
