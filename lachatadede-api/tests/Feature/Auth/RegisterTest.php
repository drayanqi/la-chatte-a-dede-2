<?php

namespace Tests\Feature\Auth;

use App\Models\Script;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class RegisterTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_creates_user_with_starter_script_and_token(): void
    {
        $response = $this->postJson('/api/register', [
            'email' => 'newuser@example.com',
            'password' => 'SecurePass123!',
            'password_confirmation' => 'SecurePass123!',
            'name' => 'NewUser',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'user' => ['id', 'email', 'username', 'points'],
                'token',
            ])
            ->assertJsonPath('user.email', 'newuser@example.com')
            ->assertJsonPath('user.username', 'NewUser')
            ->assertJsonPath('user.points', 0);

        $this->assertDatabaseHas('users', ['email' => 'newuser@example.com']);

        $user = User::where('email', 'newuser@example.com')->first();
        $this->assertTrue(Hash::check('SecurePass123!', $user->password));

        // Starter AI script provisioned atomically with the account
        $this->assertDatabaseHas('scripts', [
            'user_id' => $user->id,
            'name' => 'StarterAI.js',
            'language' => 'javascript',
        ]);

        // HTTP-only auth cookie is set alongside the bearer token
        $response->assertCookie('auth_token');
    }

    public function test_registration_requires_matching_password_confirmation(): void
    {
        $response = $this->postJson('/api/register', [
            'email' => 'mismatch@example.com',
            'password' => 'SecurePass123!',
            'password_confirmation' => 'DifferentPass123!',
            'name' => 'Mismatch',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['password']);

        $this->assertDatabaseMissing('users', ['email' => 'mismatch@example.com']);
    }

    public function test_registration_rejects_duplicate_email(): void
    {
        User::factory()->create(['email' => 'taken@example.com']);

        $response = $this->postJson('/api/register', [
            'email' => 'taken@example.com',
            'password' => 'SecurePass123!',
            'password_confirmation' => 'SecurePass123!',
            'name' => 'AnotherUser',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Email already registered');

        $this->assertSame(1, User::where('email', 'taken@example.com')->count());
    }

    public function test_registration_rejects_duplicate_username(): void
    {
        User::factory()->create(['username' => 'TakenName']);

        $response = $this->postJson('/api/register', [
            'email' => 'other@example.com',
            'password' => 'SecurePass123!',
            'password_confirmation' => 'SecurePass123!',
            'name' => 'TakenName',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Username already taken');
    }

    public function test_registration_validates_input_format(): void
    {
        $response = $this->postJson('/api/register', [
            'email' => 'not-an-email',
            'password' => 'short',
            'password_confirmation' => 'short',
            'name' => '',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password', 'name']);

        // Malformed payloads must never reach the database layer as 500s
        $arrayPayload = $this->postJson('/api/register', [
            'email' => ['array' => 'value'],
            'password' => 'SecurePass123!',
            'password_confirmation' => 'SecurePass123!',
            'name' => ['array' => 'value'],
        ]);

        $arrayPayload->assertStatus(422);
    }
}
