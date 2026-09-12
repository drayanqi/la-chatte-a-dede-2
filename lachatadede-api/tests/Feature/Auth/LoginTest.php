<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_returns_user_and_token(): void
    {
        User::factory()->create([
            'email' => 'login@example.com',
            'password' => 'SecurePass123!',
        ]);

        $response = $this->postJson('/api/login', [
            'email' => 'login@example.com',
            'password' => 'SecurePass123!',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'user' => ['id', 'email', 'username', 'points'],
                'token',
            ])
            ->assertCookie('auth_token');
    }

    public function test_login_rejects_wrong_credentials_with_generic_message(): void
    {
        User::factory()->create(['email' => 'victim@example.com']);

        $response = $this->postJson('/api/login', [
            'email' => 'victim@example.com',
            'password' => 'WrongPassword123!',
        ]);

        $response->assertStatus(401)
            ->assertJsonPath('message', 'Invalid email or password');
    }

    public function test_login_rejects_unknown_email_with_generic_message(): void
    {
        $response = $this->postJson('/api/login', [
            'email' => 'ghost@example.com',
            'password' => 'Whatever123!',
        ]);

        $response->assertStatus(401)
            ->assertJsonPath('message', 'Invalid email or password');
    }

    public function test_login_revokes_previous_auth_tokens(): void
    {
        $user = User::factory()->create(['password' => 'SecurePass123!']);

        $staleToken = $user->createToken('auth_token')->plainTextToken;

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'SecurePass123!',
        ]);

        $response->assertStatus(200);

        // Only the newest auth_token survives
        $this->assertSame(1, $user->tokens()->where('name', 'auth_token')->count());

        // The stale token no longer authenticates
        $stale = $this->withHeader('Authorization', "Bearer {$staleToken}")
            ->getJson('/api/user');
        $stale->assertStatus(401);
    }

    public function test_login_validates_input_format(): void
    {
        $response = $this->postJson('/api/login', [
            'email' => ['malformed'],
            'password' => null,
        ]);

        $response->assertStatus(422);
    }

    public function test_relogin_does_not_duplicate_starter_script(): void
    {
        $register = $this->postJson('/api/register', [
            'email' => 'starter@example.com',
            'password' => 'SecurePass123!',
            'password_confirmation' => 'SecurePass123!',
            'name' => 'StarterUser',
        ]);
        $register->assertStatus(201);

        $this->postJson('/api/login', [
            'email' => 'starter@example.com',
            'password' => 'SecurePass123!',
        ])->assertStatus(200);

        $user = User::where('email', 'starter@example.com')->first();
        $this->assertSame(1, $user->scripts()->count());
    }
}
