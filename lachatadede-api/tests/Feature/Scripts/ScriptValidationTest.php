<?php

namespace Tests\Feature\Scripts;

use App\Models\Script;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Story 3.4: scripts are validated by the game engine (POST /validate-script)
 * on store/update. The controller must reject invalid code with 422 and must
 * degrade gracefully when the engine is unreachable (never block editing).
 */
class ScriptValidationTest extends TestCase
{
    use RefreshDatabase;

    private const VALID_CODE = <<<'JS'
function update(game) {
  game.me.moveToward(game.ball.position.x, game.ball.position.y);
}
JS;

    public function test_store_valid_script_persists_is_valid_true(): void
    {
        Http::fake([
            '*/validate-script' => Http::response(['valid' => true, 'errors' => []], 200),
        ]);
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/scripts', [
            'name' => 'Chaser.js',
            'code' => self::VALID_CODE,
            'language' => 'javascript',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('is_valid', true);
        $this->assertNull($response->json('warning'));

        $this->assertDatabaseHas('scripts', [
            'user_id' => $user->id,
            'name' => 'Chaser.js',
            'is_valid' => true,
        ]);
        Http::assertSentCount(1);
    }

    public function test_store_invalid_script_returns_422_with_engine_errors_and_is_not_persisted(): void
    {
        Http::fake([
            '*/validate-script' => Http::response([
                'valid' => false,
                'errors' => [['message' => "Unexpected token '{'", 'line' => 3]],
            ], 200),
        ]);
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/scripts', [
            'name' => 'Broken.js',
            'code' => 'function update(game) { return function {;',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Script validation failed')
            ->assertJsonPath('errors.0.message', "Unexpected token '{'")
            ->assertJsonPath('errors.0.line', 3);

        $this->assertDatabaseMissing('scripts', ['name' => 'Broken.js']);
    }

    public function test_store_script_is_saved_as_unvalidated_when_engine_is_unreachable(): void
    {
        // No Http::fake: GAME_ENGINE_URL in phpunit.xml points to an
        // unreachable port, exercising the graceful-degradation path.
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/scripts', [
            'name' => 'Offline.js',
            'code' => self::VALID_CODE,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('is_valid', false);
        $this->assertSame(
            'AI validation service unreachable; script saved as unvalidated',
            $response->json('warning')
        );

        $this->assertDatabaseHas('scripts', [
            'name' => 'Offline.js',
            'is_valid' => false,
        ]);
    }

    public function test_store_script_degrades_gracefully_when_engine_returns_500(): void
    {
        Http::fake([
            '*/validate-script' => Http::response(['error' => 'boom'], 500),
        ]);
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/scripts', [
            'name' => 'Engine500.js',
            'code' => self::VALID_CODE,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('is_valid', false);
        $this->assertNotNull($response->json('warning'));
    }

    public function test_store_empty_code_skips_validation_and_never_calls_the_engine(): void
    {
        Http::fake();
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/scripts', [
            'name' => 'Empty.js',
            'code' => '',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('code', '')
            ->assertJsonPath('is_valid', false);
        // No code to validate: no warning, no engine call.
        $this->assertNull($response->json('warning'));
        Http::assertNothingSent();
    }

    public function test_update_code_revalidates_the_script(): void
    {
        Http::fake([
            '*/validate-script' => Http::response(['valid' => true, 'errors' => []], 200),
        ]);
        $user = User::factory()->create();
        $script = $user->scripts()->create(['name' => 'Bot.js', 'code' => 'old']);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/scripts/{$script->id}", [
            'code' => self::VALID_CODE,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('is_valid', true);
        $this->assertDatabaseHas('scripts', [
            'id' => $script->id,
            'code' => self::VALID_CODE,
            'is_valid' => true,
        ]);
    }

    public function test_update_invalid_code_returns_422_and_keeps_previous_state(): void
    {
        Http::fake([
            '*/validate-script' => Http::response([
                'valid' => false,
                'errors' => [['message' => 'missing update function']],
            ], 200),
        ]);
        $user = User::factory()->create();
        $script = $user->scripts()->create(['name' => 'Bot.js', 'code' => 'good old code']);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/scripts/{$script->id}", [
            'code' => 'var broken = ;',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('errors.0.message', 'missing update function');

        $this->assertDatabaseHas('scripts', [
            'id' => $script->id,
            'code' => 'good old code',
            'is_valid' => false,
        ]);
    }

    public function test_update_name_only_does_not_touch_validation(): void
    {
        // Even though the fake engine would reject everything, a rename must
        // not call the engine nor flip the stored validation status.
        Http::fake([
            '*/validate-script' => Http::response(['valid' => false, 'errors' => []], 200),
        ]);
        $user = User::factory()->create();
        $script = $user->scripts()->create([
            'name' => 'Bot.js',
            'code' => self::VALID_CODE,
            'is_valid' => true,
        ]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/scripts/{$script->id}", [
            'name' => 'Renamed.js',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('name', 'Renamed.js')
            ->assertJsonPath('is_valid', true);
        Http::assertNothingSent();
    }

    public function test_show_includes_is_valid(): void
    {
        $user = User::factory()->create();
        $script = $user->scripts()->create([
            'name' => 'Bot.js',
            'code' => self::VALID_CODE,
            'is_valid' => true,
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/scripts/{$script->id}")
            ->assertStatus(200)
            ->assertJsonPath('is_valid', true);
    }
}
