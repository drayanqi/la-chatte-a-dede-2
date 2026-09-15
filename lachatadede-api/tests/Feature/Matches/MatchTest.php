<?php

namespace Tests\Feature\Matches;

use App\Models\GameMatch;
use App\Models\Tactic;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class MatchTest extends TestCase
{
    use RefreshDatabase;

    private Tactic $systemTactic;

    protected function setUp(): void
    {
        parent::setUp();

        // Story 3.5 stub: the Easy Bot system tactic 3.6 will seed. Created
        // here so the controller's resolution exercises its find path.
        $this->systemTactic = $this->createSystemTactic();
    }

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
     * The system tactic driving the Easy Bot, seeded with the story 3.5
     * idle placeholder scripts to simulate an outdated database — the
     * controller's resolution heals the rows to the canonical scripts
     * (SystemTacticService content sync, spec-match-preview-and-bot-fixes).
     */
    private function createSystemTactic(): Tactic
    {
        $systemUser = User::create([
            'email' => 'system-bot@lachatadede.local',
            'username' => 'EasyBot',
            'password' => Str::random(32),
        ]);

        $tactic = Tactic::create(['name' => 'Easy Bot', 'is_system' => true]);

        $formation = [[8.0, 25.0], [25.0, 15.0], [25.0, 35.0], [40.0, 15.0], [40.0, 35.0]];
        foreach ($formation as $index => [$x, $y]) {
            $script = $systemUser->scripts()->create([
                'name' => 'EasyBot-'.($index + 1),
                'code' => 'function update(game) {}',
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

    private function fakeEngineSuccess(int $scoreChallenger = 2, int $scoreOpponent = 1): void
    {
        Http::fake([
            '*/simulate' => function (Request $request) use ($scoreChallenger, $scoreOpponent) {
                // Faithful engine double (3.3 contract): it writes the frames
                // file into output_path and reports the file it wrote;
                // scores and duration only — no winner key.
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

    private function startMatch(User $user, Tactic $tactic)
    {
        return $this->actingAs($user, 'sanctum')->postJson('/api/matches', [
            'mode' => 'practice',
            'tactic_id' => $tactic->id,
            'bot' => 'easy',
        ]);
    }

    public function test_matches_require_authentication(): void
    {
        $this->postJson('/api/matches', ['mode' => 'practice', 'tactic_id' => Str::uuid(), 'bot' => 'easy'])
            ->assertStatus(401);
        $this->getJson('/api/matches')->assertStatus(401);
        $this->getJson('/api/matches/'.Str::uuid())->assertStatus(401);
        $this->getJson('/api/matches/'.Str::uuid().'/frames')->assertStatus(401);
    }

    public function test_store_simulates_a_practice_match_and_persists_the_result(): void
    {
        $user = User::factory()->create();
        $tactic = $this->createUserTactic($user);
        $this->fakeEngineSuccess(2, 1);

        $response = $this->startMatch($user, $tactic);

        $response->assertStatus(201)
            ->assertJsonPath('mode', 'practice')
            ->assertJsonPath('status', 'completed')
            ->assertJsonPath('scoreChallenger', 2)
            ->assertJsonPath('scoreOpponent', 1)
            ->assertJsonPath('result', 'challenger_win')
            ->assertJsonPath('durationFrames', 10800);

        $matchId = $response->json('id');

        $this->assertDatabaseHas('matches', [
            'id' => $matchId,
            'challenger_id' => $user->id,
            'challenger_tactic' => $tactic->id,
            'bot_tactic' => $this->systemTactic->id,
            'mode' => 'practice',
            'status' => 'completed',
            'score_challenger' => 2,
            'score_opponent' => 1,
            'result' => 'challenger_win',
            'duration_frames' => 10800,
            'frames_file' => 'simulations/'.$matchId.'.json',
            // Practice matches never touch rating points (Epic 4)
            'points_challenger' => null,
            'points_opponent' => null,
        ]);

        // The engine payload follows the 3.3 contract: match id, stored seed,
        // both teams with 5 players each carrying their script code. The user
        // is the challenger (left half as saved); the bot tactic is mirrored
        // across the halfway line (x -> 100 - x) so it defends the right goal.
        // The bot's GK script is the canonical goalkeeper: the seeded stubs
        // are healed by the resolution before the engine call.
        $goalkeeper = json_decode(
            (string) file_get_contents(database_path('seeders/data/easy-bot-scripts.json')),
            true,
            512,
            JSON_THROW_ON_ERROR,
        )['goalkeeper'];
        Http::assertSent(function ($request) use ($matchId, $goalkeeper) {
            $body = $request->data();

            return str_contains($request->url(), '/simulate')
                && $body['match_id'] === $matchId
                && is_int($body['seed'])
                && $body['seed'] >= 1
                && $body['seed'] <= 2 ** 31 - 1
                && count($body['challenger']['players']) === 5
                && count($body['opponent']['players']) === 5
                && $body['challenger']['players'][0]['slot'] === 1
                && $body['challenger']['players'][0]['script'] === 'function update(game) { me.moveToward(50, 25); }'
                && abs($body['challenger']['players'][0]['x'] - 8.0) < 0.0001
                && abs($body['opponent']['players'][0]['x'] - 92.0) < 0.0001
                && $body['opponent']['players'][0]['script'] === $goalkeeper;
        });
    }

    public function test_a_draw_score_maps_to_a_draw_result(): void
    {
        $user = User::factory()->create();
        $tactic = $this->createUserTactic($user);
        $this->fakeEngineSuccess(0, 0);

        $this->startMatch($user, $tactic)
            ->assertStatus(201)
            ->assertJsonPath('result', 'draw');

        $this->assertDatabaseHas('matches', [
            'id' => GameMatch::sole()->id,
            'result' => 'draw',
        ]);
    }

    public function test_store_marks_the_match_failed_when_the_engine_errors(): void
    {
        $user = User::factory()->create();
        $tactic = $this->createUserTactic($user);
        Http::fake([
            '*/simulate' => Http::response(['success' => false, 'error' => 'boom'], 500),
        ]);

        $response = $this->startMatch($user, $tactic);

        $response->assertStatus(502)->assertJsonPath('message', 'Simulation failed');

        $this->assertDatabaseHas('matches', [
            'id' => GameMatch::sole()->id,
            'status' => 'failed',
            'score_challenger' => 0,
            'score_opponent' => 0,
            'result' => null,
            'frames_file' => null,
        ]);
    }

    public function test_store_marks_the_match_failed_when_the_engine_is_unreachable(): void
    {
        $user = User::factory()->create();
        $tactic = $this->createUserTactic($user);
        Http::fake(function () {
            throw new ConnectionException('cURL error 28: Connection timed out');
        });

        $response = $this->startMatch($user, $tactic);

        $response->assertStatus(502)->assertJsonPath('message', 'Simulation failed');

        $this->assertDatabaseHas('matches', [
            'id' => GameMatch::sole()->id,
            'status' => 'failed',
        ]);
    }

    public function test_store_marks_the_match_failed_when_the_engine_result_is_malformed(): void
    {
        $user = User::factory()->create();
        $tactic = $this->createUserTactic($user);
        Http::fake([
            // success:true with a malformed result must be a 502 (AC #4),
            // never an undefined-key 500 that leaves the row pending.
            '*/simulate' => Http::response(['success' => true, 'file' => '/tmp/x.json']),
        ]);

        $response = $this->startMatch($user, $tactic);

        $response->assertStatus(502)->assertJsonPath('message', 'Simulation failed');

        $this->assertDatabaseHas('matches', [
            'id' => GameMatch::sole()->id,
            'status' => 'failed',
        ]);
    }

    public function test_store_marks_the_match_failed_when_the_frames_file_is_missing(): void
    {
        $user = User::factory()->create();
        $tactic = $this->createUserTactic($user);
        Http::fake([
            // The engine reports success but the frames file never landed:
            // the match must not be presented as watchable (AC #4).
            '*/simulate' => Http::response([
                'success' => true,
                'file' => '/var/www/storage/simulations/ghost.json',
                'result' => [
                    'score_challenger' => 2,
                    'score_opponent' => 1,
                    'duration_frames' => 10800,
                ],
                'errors' => [],
            ]),
        ]);

        $response = $this->startMatch($user, $tactic);

        $response->assertStatus(502)->assertJsonPath('message', 'Simulation failed');

        $this->assertDatabaseHas('matches', [
            'id' => GameMatch::sole()->id,
            'status' => 'failed',
            'frames_file' => null,
        ]);
    }

    public function test_store_validates_the_request_payload(): void
    {
        $user = User::factory()->create();
        $tactic = $this->createUserTactic($user);

        $this->actingAs($user, 'sanctum')->postJson('/api/matches', [
            'tactic_id' => $tactic->id,
            'bot' => 'easy',
        ])->assertStatus(422)->assertJsonValidationErrors(['mode']);

        $this->actingAs($user, 'sanctum')->postJson('/api/matches', [
            'mode' => 'ranked',
            'tactic_id' => $tactic->id,
            'bot' => 'easy',
        ])->assertStatus(422)->assertJsonValidationErrors(['mode']);

        $this->actingAs($user, 'sanctum')->postJson('/api/matches', [
            'mode' => 'practice',
            'bot' => 'easy',
        ])->assertStatus(422)->assertJsonValidationErrors(['tactic_id']);

        $this->actingAs($user, 'sanctum')->postJson('/api/matches', [
            'mode' => 'practice',
            'tactic_id' => Str::uuid(),
            'bot' => 'easy',
        ])->assertStatus(422)->assertJsonValidationErrors(['tactic_id']);

        $this->actingAs($user, 'sanctum')->postJson('/api/matches', [
            'mode' => 'practice',
            'tactic_id' => $tactic->id,
            'bot' => 'hard',
        ])->assertStatus(422)->assertJsonValidationErrors(['bot']);
    }

    public function test_store_rejects_a_foreign_tactic(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $foreignTactic = $this->createUserTactic($other, 'Not Yours');

        $this->startMatch($user, $foreignTactic)
            ->assertStatus(404)
            ->assertJsonPath('message', 'Tactic not found');
    }

    public function test_store_rejects_an_incomplete_lineup(): void
    {
        $user = User::factory()->create();
        $tactic = $user->tactics()->create(['name' => 'Half lineup']);
        $script = $user->scripts()->create([
            'name' => 'Only.js', 'code' => 'function update(game) {}', 'language' => 'javascript',
        ]);
        $tactic->players()->create([
            'player_slot' => 1, 'position_x' => 8.0, 'position_y' => 25.0, 'script_id' => $script->id,
        ]);

        $this->startMatch($user, $tactic)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Tactic lineup is incomplete');
    }

    public function test_index_lists_matches_newest_first(): void
    {
        $user = User::factory()->create();
        $tactic = $this->createUserTactic($user);

        $oldest = GameMatch::create([
            'challenger_id' => $user->id, 'challenger_tactic' => $tactic->id,
            'mode' => 'practice', 'seed' => 1, 'status' => 'completed',
        ]);
        $this->travel(5)->minutes();
        $newest = GameMatch::create([
            'challenger_id' => $user->id, 'challenger_tactic' => $tactic->id,
            'mode' => 'practice', 'seed' => 2, 'status' => 'completed',
        ]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/matches');

        $response->assertStatus(200);
        $ids = collect($response->json('data'))->pluck('id');
        $this->assertSame([$newest->id, $oldest->id], $ids->all());
    }

    public function test_index_paginates_matches_with_a_limit_of_twenty(): void
    {
        $user = User::factory()->create();
        $tactic = $this->createUserTactic($user);

        foreach (range(1, 22) as $i) {
            GameMatch::create([
                'challenger_id' => $user->id, 'challenger_tactic' => $tactic->id,
                'mode' => 'practice', 'seed' => $i, 'status' => 'completed',
            ]);
        }

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/matches');

        $response->assertStatus(200);
        $this->assertCount(20, $response->json('data'));
        $this->assertSame(22, $response->json('total'));
    }

    public function test_show_is_scoped_to_the_owner(): void
    {
        $user = User::factory()->create();
        $tactic = $this->createUserTactic($user);
        $match = GameMatch::create([
            'challenger_id' => $user->id, 'challenger_tactic' => $tactic->id,
            'mode' => 'practice', 'seed' => 7, 'status' => 'completed',
            'score_challenger' => 3, 'score_opponent' => 0, 'result' => 'challenger_win',
            'duration_frames' => 10800, 'frames_file' => 'simulations/x.json',
        ]);

        $this->actingAs($user, 'sanctum')->getJson("/api/matches/{$match->id}")
            ->assertStatus(200)
            ->assertJsonPath('id', $match->id)
            ->assertJsonPath('mode', 'practice')
            ->assertJsonPath('status', 'completed')
            ->assertJsonPath('scoreChallenger', 3)
            ->assertJsonPath('scoreOpponent', 0)
            ->assertJsonPath('result', 'challenger_win')
            ->assertJsonPath('durationFrames', 10800)
            ->assertJsonPath('createdAt', $match->created_at->toISOString());

        $intruder = User::factory()->create();
        $this->actingAs($intruder, 'sanctum')
            ->getJson("/api/matches/{$match->id}")
            ->assertStatus(404);
    }

    public function test_frames_endpoint_returns_the_frame_file(): void
    {
        $user = User::factory()->create();
        $tactic = $this->createUserTactic($user);
        $this->fakeEngineSuccess();

        $matchId = $this->startMatch($user, $tactic)->json('id');

        $framesPath = storage_path("simulations/{$matchId}.json");
        $directory = dirname($framesPath);
        if (! is_dir($directory)) {
            mkdir($directory, 0777, true);
        }
        file_put_contents($framesPath, '{"match_id":"'.$matchId.'","frames":[]}');

        try {
            $response = $this->actingAs($user, 'sanctum')
                ->getJson("/api/matches/{$matchId}/frames")
                ->assertStatus(200)
                ->assertHeader('Content-Type', 'application/json');

            // A BinaryFileResponse streams from disk: the test asserts the
            // served file itself rather than an in-memory body.
            $file = $response->getFile();
            $this->assertSame($framesPath, $file->getPathname());
            $this->assertSame('{"match_id":"'.$matchId.'","frames":[]}', file_get_contents($file->getPathname()));
        } finally {
            @unlink($framesPath);
        }
    }

    public function test_frames_returns_404_when_the_file_is_missing(): void
    {
        $user = User::factory()->create();
        $tactic = $this->createUserTactic($user);
        $this->fakeEngineSuccess();

        $matchId = $this->startMatch($user, $tactic)->json('id');

        // The completed match loses its frames file on disk: no longer
        // watchable (AC #4).
        @unlink(storage_path("simulations/{$matchId}.json"));

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/matches/{$matchId}/frames")
            ->assertStatus(404);
    }

    public function test_frames_returns_404_for_a_failed_match(): void
    {
        $user = User::factory()->create();
        $tactic = $this->createUserTactic($user);
        $match = GameMatch::create([
            'challenger_id' => $user->id, 'challenger_tactic' => $tactic->id,
            'mode' => 'practice', 'seed' => 9, 'status' => 'failed',
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/matches/{$match->id}/frames")
            ->assertStatus(404);
    }

    public function test_every_practice_match_resolves_the_seeded_system_bot_tactic(): void
    {
        $user = User::factory()->create();
        $tactic = $this->createUserTactic($user);
        $this->fakeEngineSuccess();

        $firstId = $this->startMatch($user, $tactic)->json('id');
        $secondId = $this->startMatch($user, $tactic)->json('id');

        $this->assertDatabaseHas('matches', ['id' => $firstId, 'bot_tactic' => $this->systemTactic->id]);
        $this->assertDatabaseHas('matches', ['id' => $secondId, 'bot_tactic' => $this->systemTactic->id]);
        $this->assertSame(1, Tactic::where('is_system', true)->count());
    }
}
