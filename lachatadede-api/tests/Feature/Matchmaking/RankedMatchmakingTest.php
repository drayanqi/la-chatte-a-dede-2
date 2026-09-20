<?php

namespace Tests\Feature\Matchmaking;

use App\Models\GameMatch;
use App\Models\Tactic;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class RankedMatchmakingTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A 1-2-2 formation tactic (GK, 2 DEF, 2 ATK) with one script per slot,
     * optionally pre-rated (elo/wins/losses are server-managed columns set
     * through the model, never the API).
     */
    private function createUserTactic(User $user, string $name = '1-2-2 Formation', array $ranked = []): Tactic
    {
        $tactic = $user->tactics()->create(['name' => $name, ...$ranked]);

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
     * Faithful engine double (3.3 contract, same pattern as MatchTest): it
     * writes the frames file into output_path and reports it; scores and
     * duration only — no winner key.
     */
    private function fakeEngineSuccess(int $scoreChallenger = 2, int $scoreOpponent = 1): void
    {
        Http::fake([
            '*/simulate' => function (Request $request) use ($scoreChallenger, $scoreOpponent) {
                $matchId = $request->data()['match_id'];
                $framesPath = storage_path("simulations/{$matchId}.json");

                if (! is_dir(dirname($framesPath))) {
                    mkdir(dirname($framesPath), 0777, true);
                }
                file_put_contents($framesPath, '{"frames":[]}');

                return Http::response([
                    'success' => true,
                    'file' => '/var/www/storage/simulations/'.$matchId.'.json',
                    'result' => [
                        'score_challenger' => $scoreChallenger,
                        'score_opponent' => $scoreOpponent,
                        'duration_frames' => 10800,
                    ],
                    'errors' => [],
                ]);
            },
        ]);
    }

    private function fakeEngineFailure(): void
    {
        Http::fake([
            '*/simulate' => Http::response(['success' => false, 'error' => 'boom'], 500),
        ]);
    }

    public function test_opponents_require_authentication(): void
    {
        $this->getJson('/api/matchmaking/opponents')->assertStatus(401);
        $this->postJson('/api/matchmaking/quick', ['tactic_id' => Str::uuid()])->assertStatus(401);
        $this->postJson('/api/matchmaking/challenge', [
            'tactic_id' => Str::uuid(),
            'opponent_tactic_id' => Str::uuid(),
        ])->assertStatus(401);
    }

    public function test_opponents_lists_only_challengeable_tactics_ranked_by_elo(): void
    {
        $me = User::factory()->create();
        $weak = User::factory()->create(['username' => 'weakling']);
        $strong = User::factory()->create(['username' => 'strongarm']);
        $idle = User::factory()->create();

        // The pool: ready + complete foreign tactics
        $poolB = $this->createUserTactic($weak, 'Weak Fighter', ['elo' => 900]);
        $poolB->update(['is_ready' => true]);
        $poolA = $this->createUserTactic($strong, 'Strong Fighter', ['elo' => 1300]);
        $poolA->update(['is_ready' => true]);

        // Excluded: my own ready tactic
        $mine = $this->createUserTactic($me, 'Mine');
        $mine->update(['is_ready' => true]);

        // Excluded: system tactic (even ready)
        $system = Tactic::create(['name' => 'Easy Bot', 'is_system' => true, 'is_ready' => true]);
        $systemUser = User::factory()->create();
        $formation = [[8.0, 25.0], [25.0, 15.0], [25.0, 35.0], [40.0, 15.0], [40.0, 35.0]];
        foreach ($formation as $index => [$x, $y]) {
            $script = $systemUser->scripts()->create([
                'name' => 'Sys-'.$index, 'code' => 'x', 'language' => 'javascript',
            ]);
            $system->players()->create([
                'player_slot' => $index + 1, 'position_x' => $x, 'position_y' => $y, 'script_id' => $script->id,
            ]);
        }

        // Excluded: not ready
        $notReady = $this->createUserTactic($idle, 'Sleeping');
        // Excluded: ready but lineup broken after the toggle
        $broken = $this->createUserTactic($idle, 'Broken', ['is_ready' => true]);
        $broken->players()->first()->update(['script_id' => null]);

        $response = $this->actingAs($me, 'sanctum')
            ->getJson('/api/matchmaking/opponents')
            ->assertOk()
            ->assertJsonCount(2);

        $ids = collect($response->json())->pluck('id');
        $this->assertSame([$poolA->id, $poolB->id], $ids->all());

        collect($response->json())->each(function (array $row) {
            $this->assertArrayHasKey('owner', $row);
            $this->assertArrayHasKey('elo', $row);
            $this->assertArrayHasKey('wins', $row);
            $this->assertArrayHasKey('losses', $row);
        });
        $this->assertSame('strongarm', $response->json('0.owner'));
        $this->assertSame('weakling', $response->json('1.owner'));
    }

    public function test_quick_match_rejects_a_tactic_that_is_not_ready(): void
    {
        $me = User::factory()->create();
        $mine = $this->createUserTactic($me);

        $this->actingAs($me, 'sanctum')
            ->postJson('/api/matchmaking/quick', ['tactic_id' => $mine->id])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Your tactic is not ready');
    }

    public function test_quick_match_rejects_an_incomplete_lineup(): void
    {
        $me = User::factory()->create();
        $mine = $this->createUserTactic($me, 'Broken', ['is_ready' => true]);
        $mine->players()->first()->update(['script_id' => null]);

        $this->actingAs($me, 'sanctum')
            ->postJson('/api/matchmaking/quick', ['tactic_id' => $mine->id])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Tactic lineup is incomplete');
    }

    public function test_quick_match_with_an_empty_pool_returns_404(): void
    {
        $me = User::factory()->create();
        $mine = $this->createUserTactic($me, 'Lonely', ['is_ready' => true]);

        $this->actingAs($me, 'sanctum')
            ->postJson('/api/matchmaking/quick', ['tactic_id' => $mine->id])
            ->assertStatus(404)
            ->assertJsonPath('message', 'No opponents ready');

        $this->assertDatabaseCount('matches', 0);
    }

    public function test_quick_match_plays_a_random_pool_opponent_and_applies_elo(): void
    {
        $this->fakeEngineSuccess(2, 1);

        $me = User::factory()->create();
        $rival = User::factory()->create(['username' => 'rival']);

        $mine = $this->createUserTactic($me, 'Mine', ['is_ready' => true]);
        $theirs = $this->createUserTactic($rival, 'Theirs', ['is_ready' => true]);

        $response = $this->actingAs($me, 'sanctum')
            ->postJson('/api/matchmaking/quick', ['tactic_id' => $mine->id])
            ->assertStatus(201);

        $response->assertJsonPath('mode', 'ranked')
            ->assertJsonPath('status', 'completed')
            ->assertJsonPath('scoreChallenger', 2)
            ->assertJsonPath('scoreOpponent', 1)
            ->assertJsonPath('result', 'challenger_win')
            ->assertJsonPath('challengerName', $me->username)
            ->assertJsonPath('opponentName', 'rival');

        $match = GameMatch::query()->sole();
        $this->assertSame('ranked', $match->mode);
        $this->assertSame('completed', $match->status);
        $this->assertSame($me->id, $match->challenger_id);
        $this->assertSame($rival->id, $match->opponent_id);
        $this->assertSame($mine->id, $match->challenger_tactic);
        $this->assertSame($theirs->id, $match->opponent_tactic);

        // Equal ratings: standard +/-25 (K=50, story 4.4 calibration)
        $this->assertSame(25, $match->points_challenger);
        $this->assertSame(-25, $match->points_opponent);

        $this->assertSame(1025, $mine->fresh()->elo);
        $this->assertSame(975, $theirs->fresh()->elo);
        $this->assertSame(1, $mine->fresh()->wins);
        $this->assertSame(0, $mine->fresh()->losses);
        $this->assertSame(0, $theirs->fresh()->wins);
        $this->assertSame(1, $theirs->fresh()->losses);

        // The frames file landed in storage
        $this->assertFileExists(storage_path($match->frames_file));
    }

    public function test_beating_a_higher_rated_tactic_pays_the_upset_bonus(): void
    {
        $this->fakeEngineSuccess(1, 0);

        $me = User::factory()->create();
        $rival = User::factory()->create();

        $mine = $this->createUserTactic($me, 'Underdog', ['is_ready' => true, 'elo' => 1000]);
        $theirs = $this->createUserTactic($rival, 'Favorite', ['is_ready' => true, 'elo' => 1200]);

        $this->actingAs($me, 'sanctum')
            ->postJson('/api/matchmaking/quick', ['tactic_id' => $mine->id])
            ->assertStatus(201);

        $match = GameMatch::query()->sole();

        // E(1000 vs 1200) = 0.24 -> 50 * (1 - 0.24) = 38 (symmetric)
        $this->assertSame(38, $match->points_challenger);
        $this->assertSame(-38, $match->points_opponent);
        $this->assertSame(1038, $mine->fresh()->elo);
        $this->assertSame(1162, $theirs->fresh()->elo);
    }

    public function test_a_draw_moves_elo_symmetrically_but_never_the_counters(): void
    {
        $this->fakeEngineSuccess(1, 1);

        $me = User::factory()->create();
        $rival = User::factory()->create();

        $mine = $this->createUserTactic($me, 'Drawn A', ['is_ready' => true, 'elo' => 1100, 'wins' => 3, 'losses' => 2]);
        $theirs = $this->createUserTactic($rival, 'Drawn B', ['is_ready' => true, 'elo' => 1000, 'wins' => 1, 'losses' => 1]);

        $this->actingAs($me, 'sanctum')
            ->postJson('/api/matchmaking/quick', ['tactic_id' => $mine->id])
            ->assertStatus(201);

        $match = GameMatch::query()->sole();
        $this->assertSame('draw', $match->result);

        // E(1100 vs 1000) = 0.64 -> 50 * (0.5 - 0.64) = -7 (symmetric +7)
        $this->assertSame(-7, $match->points_challenger);
        $this->assertSame(7, $match->points_opponent);

        // The record stays W/L only (draws are hidden, Pelo)
        $this->assertSame(1093, $mine->fresh()->elo);
        $this->assertSame(3, $mine->fresh()->wins);
        $this->assertSame(2, $mine->fresh()->losses);
        $this->assertSame(1007, $theirs->fresh()->elo);
        $this->assertSame(1, $theirs->fresh()->wins);
        $this->assertSame(1, $theirs->fresh()->losses);
    }

    public function test_elo_never_goes_below_zero(): void
    {
        $this->fakeEngineSuccess(0, 3);

        $me = User::factory()->create();
        $rival = User::factory()->create();

        // Two bottom-rated fighters: the loser's -25 is floored at 0
        $mine = $this->createUserTactic($me, 'Crushed', ['is_ready' => true, 'elo' => 10]);
        $theirs = $this->createUserTactic($rival, 'Hammer', ['is_ready' => true, 'elo' => 10]);

        $this->actingAs($me, 'sanctum')
            ->postJson('/api/matchmaking/quick', ['tactic_id' => $mine->id])
            ->assertStatus(201);

        $this->assertSame(35, $theirs->fresh()->elo);
        $this->assertSame(0, $mine->fresh()->elo);
    }

    public function test_challenge_plays_a_specific_ready_tactic(): void
    {
        $this->fakeEngineSuccess(3, 0);

        $me = User::factory()->create();
        $rival = User::factory()->create();
        $other = User::factory()->create();

        $mine = $this->createUserTactic($me, 'Mine', ['is_ready' => true]);
        $target = $this->createUserTactic($rival, 'Target', ['is_ready' => true]);
        $distractor = $this->createUserTactic($other, 'Distractor', ['is_ready' => true]);

        $this->actingAs($me, 'sanctum')
            ->postJson('/api/matchmaking/challenge', [
                'tactic_id' => $mine->id,
                'opponent_tactic_id' => $target->id,
            ])
            ->assertStatus(201);

        $match = GameMatch::query()->sole();
        $this->assertSame($target->id, $match->opponent_tactic);
        $this->assertNotSame($distractor->id, $match->opponent_tactic);
    }

    public function test_challenge_rejects_invalid_opponents(): void
    {
        $me = User::factory()->create();
        $rival = User::factory()->create();

        $mine = $this->createUserTactic($me, 'Mine', ['is_ready' => true]);
        $ownSecond = $this->createUserTactic($me, 'My Other', ['is_ready' => true]);
        $notReady = $this->createUserTactic($rival, 'Sleeping');
        $broken = $this->createUserTactic($rival, 'Broken', ['is_ready' => true]);
        $broken->players()->first()->update(['script_id' => null]);

        $challenge = fn (string $opponentId) => $this->actingAs($me, 'sanctum')
            ->postJson('/api/matchmaking/challenge', [
                'tactic_id' => $mine->id,
                'opponent_tactic_id' => $opponentId,
            ]);

        $challenge(Str::uuid())->assertStatus(404)->assertJsonPath('message', 'Tactic not found');
        $challenge($ownSecond->id)->assertStatus(422)
            ->assertJsonPath('message', 'You cannot challenge your own tactic');
        $challenge($notReady->id)->assertStatus(422)->assertJsonPath('message', 'Tactic is not ready');
        $challenge($broken->id)->assertStatus(422)
            ->assertJsonPath('message', 'Tactic lineup is incomplete');

        // System tactics are never challengeable
        $system = Tactic::create(['name' => 'Easy Bot', 'is_system' => true, 'is_ready' => true]);
        $challenge($system->id)->assertStatus(422)->assertJsonPath('message', 'Tactic is not ready');

        $this->assertDatabaseCount('matches', 0);
    }

    public function test_the_offline_opponent_finds_the_match_in_their_history(): void
    {
        $this->fakeEngineSuccess(2, 1);

        $me = User::factory()->create();
        $rival = User::factory()->create();

        $mine = $this->createUserTactic($me, 'Mine', ['is_ready' => true]);
        $theirs = $this->createUserTactic($rival, 'Theirs', ['is_ready' => true]);

        $this->actingAs($me, 'sanctum')
            ->postJson('/api/matchmaking/challenge', [
                'tactic_id' => $mine->id,
                'opponent_tactic_id' => $theirs->id,
            ])
            ->assertStatus(201);

        // The opponent never connected: the match shows in THEIR history
        // (the serializer exposes the fighter names + elo deltas, never ids)
        $theirHistory = $this->actingAs($rival, 'sanctum')
            ->getJson('/api/matches')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->assertSame($me->username, $theirHistory->json('data.0.challengerName'));
        $this->assertSame($rival->username, $theirHistory->json('data.0.opponentName'));
        $this->assertSame(-25, $theirHistory->json('data.0.pointsOpponent'));

        // And in mine
        $myHistory = $this->actingAs($me, 'sanctum')
            ->getJson('/api/matches')
            ->assertOk()
            ->assertJsonCount(1, 'data');
        $this->assertSame(25, $myHistory->json('data.0.pointsChallenger'));

        // The per-tactic filter (story 4.4 shape): both tactics see it, a
        // foreign tactic id does not
        $this->actingAs($rival, 'sanctum')
            ->getJson('/api/matches?tactic_id='.$theirs->id)
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $foreign = $this->createUserTactic($rival, 'Other tactic');
        $this->actingAs($rival, 'sanctum')
            ->getJson('/api/matches?tactic_id='.$foreign->id)
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $intruder = User::factory()->create();
        $this->actingAs($intruder, 'sanctum')
            ->getJson('/api/matches?tactic_id='.$theirs->id)
            ->assertStatus(404)
            ->assertJsonPath('message', 'Tactic not found');
    }

    public function test_history_rows_expose_the_fighter_tactic_names(): void
    {
        $this->fakeEngineSuccess(2, 1);

        $me = User::factory()->create();
        $rival = User::factory()->create();

        $mine = $this->createUserTactic($me, 'Mine', ['is_ready' => true]);
        $theirs = $this->createUserTactic($rival, 'Theirs', ['is_ready' => true]);

        $this->actingAs($me, 'sanctum')
            ->postJson('/api/matchmaking/challenge', [
                'tactic_id' => $mine->id,
                'opponent_tactic_id' => $theirs->id,
            ])
            ->assertStatus(201);

        // Fighter NAMES, never tactic ids (serializer law)
        $row = $this->actingAs($rival, 'sanctum')
            ->getJson('/api/matches')
            ->assertOk()
            ->json('data.0');

        $this->assertSame('Mine', $row['challengerTacticName']);
        $this->assertSame('Theirs', $row['opponentTacticName']);

        // The id-leak law cuts both ways: names present, ids absent
        $this->assertArrayNotHasKey('challengerTacticId', $row);
        $this->assertArrayNotHasKey('opponentTacticId', $row);
    }

    public function test_the_mode_filter_splits_the_history(): void
    {
        $this->fakeEngineSuccess(1, 0);

        $me = User::factory()->create();
        $rival = User::factory()->create();

        $mine = $this->createUserTactic($me, 'Mine', ['is_ready' => true]);
        $theirs = $this->createUserTactic($rival, 'Theirs', ['is_ready' => true]);

        // One ranked match and one practice match, same user
        $this->actingAs($me, 'sanctum')
            ->postJson('/api/matchmaking/quick', ['tactic_id' => $mine->id])
            ->assertStatus(201);

        $this->actingAs($me, 'sanctum')
            ->postJson('/api/matches', ['mode' => 'practice', 'tactic_id' => $mine->id, 'bot' => 'easy'])
            ->assertStatus(201);

        $modes = fn (string $query) => $this->actingAs($me, 'sanctum')
            ->getJson('/api/matches'.$query)
            ->assertOk()
            ->collect('data.*.mode')
            ->sort()
            ->values()
            ->all();

        // Both filters, then no param (both rows; canonical order — same-second
        // rows make created_at ordering ambiguous)
        $this->assertSame(['ranked'], $modes('?mode=ranked'));
        $this->assertSame(['practice'], $modes('?mode=practice'));
        $this->assertSame(['practice', 'ranked'], $modes(''));

        // An unknown mode is rejected by validation
        $this->actingAs($me, 'sanctum')
            ->getJson('/api/matches?mode=speedrun')
            ->assertStatus(422);

        // Practice rows carry the challenger tactic name; the bot side has none
        $practiceRow = $this->actingAs($me, 'sanctum')
            ->getJson('/api/matches?mode=practice')
            ->json('data.0');
        $this->assertSame('Mine', $practiceRow['challengerTacticName']);
        $this->assertNull($practiceRow['opponentTacticName']);

        // A failed ranked match moved nothing and is unwatchable — the ranked
        // history must not count it (review 2026-09-20: the paginator describes
        // the rows the client renders; unfiltered lists stay untouched)
        GameMatch::create([
            'challenger_id' => $rival->id,
            'opponent_id' => $me->id,
            'challenger_tactic' => $theirs->id,
            'opponent_tactic' => $mine->id,
            'mode' => 'ranked',
            'seed' => 1,
            'status' => 'failed',
        ]);

        $this->assertSame(['ranked'], $modes('?mode=ranked'));
        $this->assertSame(['practice'], $modes('?mode=practice'));
    }

    public function test_the_offline_opponent_can_open_the_match_and_its_frames(): void
    {
        $this->fakeEngineSuccess(2, 1);

        $me = User::factory()->create();
        $rival = User::factory()->create();

        $mine = $this->createUserTactic($me, 'Mine', ['is_ready' => true]);
        $theirs = $this->createUserTactic($rival, 'Theirs', ['is_ready' => true]);

        $response = $this->actingAs($me, 'sanctum')
            ->postJson('/api/matchmaking/challenge', [
                'tactic_id' => $mine->id,
                'opponent_tactic_id' => $theirs->id,
            ])
            ->assertStatus(201);

        $matchId = $response->json('id');

        // The opponent LOST this match (2-1) but can still open it and
        // stream its frames (story 4.4: the challenger-only relation 404'd them)
        $this->actingAs($rival, 'sanctum')
            ->getJson('/api/matches/'.$matchId)
            ->assertOk()
            ->assertJsonPath('id', $matchId)
            ->assertJsonPath('result', 'challenger_win');

        $this->actingAs($rival, 'sanctum')
            ->get('/api/matches/'.$matchId.'/frames')
            ->assertOk();

        // Regression guard: non-participants stay scoped out on both endpoints
        $intruder = User::factory()->create();
        $this->actingAs($intruder, 'sanctum')
            ->getJson('/api/matches/'.$matchId)
            ->assertStatus(404);
        $this->actingAs($intruder, 'sanctum')
            ->getJson('/api/matches/'.$matchId.'/frames')
            ->assertStatus(404);
    }

    public function test_a_failed_simulation_marks_the_match_failed_and_moves_nothing(): void
    {
        $this->fakeEngineFailure();

        $me = User::factory()->create();
        $rival = User::factory()->create();

        $mine = $this->createUserTactic($me, 'Mine', ['is_ready' => true, 'elo' => 1000, 'wins' => 4, 'losses' => 1]);
        $theirs = $this->createUserTactic($rival, 'Theirs', ['is_ready' => true, 'elo' => 1000, 'wins' => 2, 'losses' => 3]);

        $this->actingAs($me, 'sanctum')
            ->postJson('/api/matchmaking/quick', ['tactic_id' => $mine->id])
            ->assertStatus(502)
            ->assertJsonPath('message', 'Simulation failed');

        $match = GameMatch::query()->sole();
        $this->assertSame('failed', $match->status);
        $this->assertNull($match->result);
        $this->assertNull($match->points_challenger);

        // Not one point of elo, not one counter
        $this->assertSame(1000, $mine->fresh()->elo);
        $this->assertSame(4, $mine->fresh()->wins);
        $this->assertSame(1, $mine->fresh()->losses);
        $this->assertSame(1000, $theirs->fresh()->elo);
        $this->assertSame(2, $theirs->fresh()->wins);
        $this->assertSame(3, $theirs->fresh()->losses);
    }
}
