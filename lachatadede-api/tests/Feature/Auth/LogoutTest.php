<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LogoutTest extends TestCase
{
    use RefreshDatabase;

    public function test_logout_deletes_the_current_access_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('auth_token')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/logout');

        $response->assertStatus(200)
            ->assertJsonPath('message', 'Logged out successfully')
            ->assertCookieExpired('auth_token');

        // Feature-test guards cache their resolved user across requests
        // (production requests always boot a fresh guard), so reset the
        // auth manager before proving the deleted token no longer works.
        $this->app->make('auth')->forgetGuards();

        // The token no longer authenticates anything
        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/user')
            ->assertStatus(401);

        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_user_endpoint_returns_the_authenticated_user(): void
    {
        $user = User::factory()->create(['username' => 'ProfileUser']);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/user');

        $response->assertStatus(200)
            ->assertJsonPath('id', $user->id)
            ->assertJsonPath('username', 'ProfileUser')
            ->assertJsonMissing(['password']);
    }

    public function test_user_endpoint_requires_authentication(): void
    {
        $this->getJson('/api/user')->assertStatus(401);
    }
}
