<?php

namespace Tests\Feature\Scripts;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ScriptTest extends TestCase
{
    use RefreshDatabase;

    public function test_scripts_require_authentication(): void
    {
        $this->getJson('/api/scripts')->assertStatus(401);
        $this->postJson('/api/scripts', ['name' => 'X.js', 'code' => 'x'])->assertStatus(401);
    }

    public function test_index_returns_only_the_user_scripts_newest_first(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        $older = $user->scripts()->create(['name' => 'Older.js', 'code' => 'older']);
        $newer = $user->scripts()->create(['name' => 'Newer.js', 'code' => 'newer']);
        $foreign = $other->scripts()->create(['name' => 'Foreign.js', 'code' => 'foreign']);

        // Ensure deterministic distinct timestamps
        DB::table('scripts')->where('id', $older->id)->update(['updated_at' => now()->subDay()]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/scripts');

        $response->assertStatus(200);

        $ids = collect($response->json())->pluck('id');
        $this->assertSame([$newer->id, $older->id], $ids->all());
        $this->assertNotContains($foreign->id, $ids);
    }

    public function test_create_script_returns_created_script(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/scripts', [
            'name' => 'MyBot.js',
            'code' => 'function update() {}',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('name', 'MyBot.js')
            ->assertJsonPath('code', 'function update() {}')
            ->assertJsonPath('language', 'javascript');

        $this->assertDatabaseHas('scripts', [
            'user_id' => $user->id,
            'name' => 'MyBot.js',
        ]);
    }

    public function test_create_script_validates_oversized_code(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/scripts', [
            'name' => 'Big.js',
            'code' => str_repeat('a', 70000),
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['code']);
    }

    public function test_update_script_changes_provided_fields(): void
    {
        $user = User::factory()->create();
        $script = $user->scripts()->create([
            'name' => 'Bot.js',
            'code' => 'old code',
            'language' => 'javascript',
        ]);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/scripts/{$script->id}", [
            'code' => 'new code',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('code', 'new code')
            ->assertJsonPath('name', 'Bot.js');

        $this->assertDatabaseHas('scripts', [
            'id' => $script->id,
            'code' => 'new code',
        ]);
    }

    public function test_update_script_allows_falsy_values(): void
    {
        // "0" and "" must both survive persistence; Laravel's global
        // empty-string-to-null middleware delivers them as null, so the
        // controller must treat an explicitly sent key as a real value.
        $user = User::factory()->create();
        $script = $user->scripts()->create(['name' => 'Bot.js', 'code' => 'old code']);

        $zero = $this->actingAs($user, 'sanctum')->putJson("/api/scripts/{$script->id}", [
            'code' => '0',
        ]);
        $zero->assertStatus(200)->assertJsonPath('code', '0');

        $empty = $this->actingAs($user, 'sanctum')->putJson("/api/scripts/{$script->id}", [
            'code' => '',
        ]);
        $empty->assertStatus(200)->assertJsonPath('code', '');
    }

    public function test_update_ignores_absent_fields(): void
    {
        // Absent keys mean "no change": a body without `code` must not clear it
        $user = User::factory()->create();
        $script = $user->scripts()->create(['name' => 'Bot.js', 'code' => 'keep me']);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/scripts/{$script->id}", [
            'name' => 'Renamed.js',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('name', 'Renamed.js');

        $this->assertDatabaseHas('scripts', [
            'id' => $script->id,
            'code' => 'keep me',
        ]);
    }

    public function test_create_script_allows_empty_code(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/scripts', [
            'name' => 'Empty.js',
            'code' => '',
        ]);

        $response->assertStatus(201)->assertJsonPath('code', '');
    }

    public function test_update_rejects_oversized_code(): void
    {
        $user = User::factory()->create();
        $script = $user->scripts()->create(['name' => 'Bot.js', 'code' => 'x']);

        $response = $this->actingAs($user, 'sanctum')->putJson("/api/scripts/{$script->id}", [
            'code' => str_repeat('a', 70000),
        ]);

        $response->assertStatus(422);
    }

    public function test_user_cannot_access_another_users_script(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();
        $script = $owner->scripts()->create(['name' => 'Secret.js', 'code' => 'secret']);

        $this->actingAs($intruder, 'sanctum')
            ->getJson("/api/scripts/{$script->id}")
            ->assertStatus(404);

        $this->actingAs($intruder, 'sanctum')
            ->putJson("/api/scripts/{$script->id}", ['code' => 'hacked'])
            ->assertStatus(404);

        $this->actingAs($intruder, 'sanctum')
            ->deleteJson("/api/scripts/{$script->id}")
            ->assertStatus(404);

        $this->assertDatabaseHas('scripts', [
            'id' => $script->id,
            'code' => 'secret',
        ]);
    }

    public function test_destroy_removes_the_script(): void
    {
        $user = User::factory()->create();
        $script = $user->scripts()->create(['name' => 'Doomed.js', 'code' => 'x']);

        $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/scripts/{$script->id}")
            ->assertStatus(200);

        $this->assertDatabaseMissing('scripts', ['id' => $script->id]);
    }
}
