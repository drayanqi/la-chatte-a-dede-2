<?php

namespace Tests\Feature\Matches;

use App\Models\Tactic;
use App\Models\User;
use Database\Seeders\SystemTacticSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class EasyBotTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Tactic slot order (1-5) to script role in the seeded JSON.
     */
    private const SCRIPT_ROLES = ['goalkeeper', 'defender1', 'defender2', 'attacker1', 'attacker2'];

    /**
     * The bot scripts the seeder must install (same JSON the seeder reads,
     * kept as expected values so a corrupted copy fails the tests).
     */
    private function expectedScriptCodes(): array
    {
        $codes = json_decode(
            (string) file_get_contents(database_path('seeders/data/easy-bot-scripts.json')),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );
        $this->assertSame(self::SCRIPT_ROLES, array_keys($codes));

        return $codes;
    }

    private function createUserTactic(User $user): Tactic
    {
        $tactic = $user->tactics()->create(['name' => '1-2-2 Formation']);

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

    private function fakeEngineSuccess(): void
    {
        Http::fake([
            '*/simulate' => function (Request $request) {
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
                        'score_challenger' => 2,
                        'score_opponent' => 1,
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

    public function test_seeder_creates_the_easy_bot_system_tactic(): void
    {
        $codes = $this->expectedScriptCodes();
        $this->seed(SystemTacticSeeder::class);

        $tactic = Tactic::where('is_system', true)->sole();
        $this->assertSame('Easy Bot', $tactic->name);
        $this->assertTrue($tactic->is_public);
        $this->assertNull($tactic->user_id);

        $systemUser = User::where('email', 'system-bot@lachatadede.local')->sole();
        $this->assertSame('EasyBot', $systemUser->username);

        $players = $tactic->players()->with('script')->orderBy('player_slot')->get();
        $this->assertCount(5, $players);

        // Home-side 3.2 geometry (GameEngineService mirrors it for the engine).
        $expected = [
            1 => ['EasyBot-Goalkeeper', 8.0, 25.0],
            2 => ['EasyBot-Defender1', 25.0, 15.0],
            3 => ['EasyBot-Defender2', 25.0, 35.0],
            4 => ['EasyBot-Attacker1', 40.0, 15.0],
            5 => ['EasyBot-Attacker2', 40.0, 35.0],
        ];
        foreach ($players as $index => $player) {
            [$name, $x, $y] = $expected[$player->player_slot];
            $this->assertSame($name, $player->script->name);
            $this->assertSame($codes[self::SCRIPT_ROLES[$index]], $player->script->code);
            $this->assertTrue($player->script->is_valid);
            $this->assertSame('javascript', $player->script->language);
            $this->assertSame($systemUser->id, $player->script->user_id);
            $this->assertSame($x, $player->position_x);
            $this->assertSame($y, $player->position_y);
        }
    }

    public function test_seeder_is_idempotent(): void
    {
        $this->seed(SystemTacticSeeder::class);
        $this->seed(SystemTacticSeeder::class);

        $this->assertSame(1, Tactic::where('is_system', true)->count());
        $systemUser = User::where('email', 'system-bot@lachatadede.local')->sole();
        $this->assertSame(5, $systemUser->scripts()->count());

        $tactic = Tactic::where('is_system', true)->sole();
        $this->assertSame(5, $tactic->players()->count());
        $this->assertTrue($tactic->players()->whereNull('script_id')->doesntExist());
    }

    public function test_a_partial_system_tactic_is_rebuilt(): void
    {
        // Simulate a crash mid-creation (story 3.5): one bad row must not
        // 502 every future practice match.
        $partial = Tactic::create(['name' => 'Easy Bot', 'is_system' => true]);

        $this->seed(SystemTacticSeeder::class);

        $fresh = Tactic::where('is_system', true)->sole();
        $this->assertNotSame($partial->id, $fresh->id);
        $this->assertSame(5, $fresh->players()->count());
        $this->assertTrue($fresh->players()->whereNull('script_id')->doesntExist());
    }

    public function test_practice_match_resolves_the_seeded_system_tactic(): void
    {
        $codes = $this->expectedScriptCodes();
        $this->seed(SystemTacticSeeder::class);
        $user = User::factory()->create();
        $tactic = $this->createUserTactic($user);
        $this->fakeEngineSuccess();

        $response = $this->startMatch($user, $tactic);

        $response->assertStatus(201);

        $seeded = Tactic::where('is_system', true)->sole();
        $this->assertDatabaseHas('matches', [
            'id' => $response->json('id'),
            'bot_tactic' => $seeded->id,
        ]);

        // The bot tactic is mirrored across the halfway line: slot 1 GK at
        // x=8 saved -> x=92 sent, driving the real goalkeeper script.
        Http::assertSent(function (Request $request) use ($codes) {
            $body = $request->data();

            return str_contains($request->url(), '/simulate')
                && abs($body['opponent']['players'][0]['x'] - 92.0) < 0.0001
                && $body['opponent']['players'][0]['script'] === $codes['goalkeeper'];
        });
    }

    public function test_practice_match_creates_the_bot_tactic_on_demand_on_an_unseeded_database(): void
    {
        // E2E databases migrate without seeding (story 3.5): the endpoint
        // must still work, with the real scripts (not idle placeholders).
        $codes = $this->expectedScriptCodes();
        $user = User::factory()->create();
        $tactic = $this->createUserTactic($user);
        $this->fakeEngineSuccess();

        $this->startMatch($user, $tactic)->assertStatus(201);

        $created = Tactic::where('is_system', true)->sole();
        $goalkeeper = $created->players()->with('script')->orderBy('player_slot')->first();
        $this->assertSame($codes['goalkeeper'], $goalkeeper->script->code);
    }

    public function test_the_seeder_script_copy_stays_in_sync_with_the_engine_fixtures(): void
    {
        $engineFile = dirname(__DIR__, 4).'/lachatadede-engine/src/engine/bots/easy/scripts.json';
        if (! is_file($engineFile)) {
            $this->markTestSkipped('Engine repository not present next to the API repository.');
        }

        $this->assertSame(
            json_decode((string) file_get_contents($engineFile), true),
            json_decode((string) file_get_contents(database_path('seeders/data/easy-bot-scripts.json')), true),
        );
    }
}
