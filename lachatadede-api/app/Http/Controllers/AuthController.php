<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Default starter AI script code
     */
    private const STARTER_AI_CODE = <<<'JAVASCRIPT'
/**
 * StarterAI - Your first AI script!
 *
 * This AI demonstrates basic game mechanics:
 * - Moving toward the ball
 * - Checking if closest to ball
 * - Basic positioning
 *
 * Modify this script to create your own strategy!
 */
function update(me, ball, teammates, opponents) {
  // Check if I'm the closest player to the ball
  if (me.isClosestToBall()) {
    // Move toward the ball
    me.moveTo(ball.position.x, ball.position.y);
  } else {
    // Support position - stay in my zone
    const targetX = me.teamId === 'home' ? 30 : 70;
    const targetY = 50;
    me.moveTo(targetX, targetY);
  }

  // If close to ball and facing goal, kick!
  if (me.distanceTo(ball) < 5) {
    const goalX = me.teamId === 'home' ? 100 : 0;
    me.kickBall(goalX, 50);
  }
}
JAVASCRIPT;

    /**
     * Register a new user.
     */
    public function register(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'email' => ['required', 'string', 'email', 'max:255'],
                'password' => ['required', 'string', 'min:8', 'confirmed'],
                'name' => ['required', 'string', 'max:50'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => $this->firstErrorMessage($e),
                'errors' => $e->errors(),
            ], 422);
        }

        // Check for existing email (validated input only)
        if (User::where('email', $validated['email'])->exists()) {
            return response()->json([
                'message' => 'Email already registered',
                'errors' => [
                    'email' => ['The email has already been taken.'],
                ],
            ], 422);
        }

        // Check for existing username (validated input only)
        if (User::where('username', $validated['name'])->exists()) {
            return response()->json([
                'message' => 'Username already taken',
                'errors' => [
                    'name' => ['This username is already in use.'],
                ],
            ], 422);
        }

        // Create the user and starter AI script atomically
        try {
            $user = DB::transaction(function () use ($validated) {
                $user = User::create([
                    'email' => $validated['email'],
                    'username' => $validated['name'],
                    'password' => $validated['password'],
                    'points' => 0,
                ]);

                $user->scripts()->create([
                    'name' => 'StarterAI.js',
                    'code' => self::STARTER_AI_CODE,
                    'language' => 'javascript',
                ]);

                return $user;
            });
        } catch (UniqueConstraintViolationException $e) {
            // Lost a race against a concurrent registration with same email/username
            return response()->json([
                'message' => 'Email or username already registered',
                'errors' => [
                    'email' => ['The email has already been taken.'],
                ],
            ], 422);
        }

        // Create API token
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'username' => $user->username,
                'points' => $user->points,
            ],
            'token' => $token,
        ], 201)->withCookie($this->authCookie($token));
    }

    /**
     * Login an existing user.
     */
    public function login(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'email' => ['required', 'string', 'email'],
                'password' => ['required', 'string'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => $this->firstErrorMessage($e),
                'errors' => $e->errors(),
            ], 422);
        }

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'message' => 'Invalid email or password',
                'errors' => [
                    'email' => ['The provided credentials are incorrect.'],
                ],
            ], 401);
        }

        // Revoke previous sessions so stale tokens cannot accumulate
        $user->tokens()->where('name', 'auth_token')->delete();

        // Create new token
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'username' => $user->username,
                'points' => $user->points,
            ],
            'token' => $token,
        ])->withCookie($this->authCookie($token));
    }

    /**
     * Logout the current user.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        // Clear the auth cookie (match the domain used when setting it)
        $cookie = cookie()->forget(
            'auth_token',
            '/',
            config('app.env') === 'production' ? config('app.domain') : 'localhost'
        );

        return response()->json(['message' => 'Logged out successfully'])->withCookie($cookie);
    }

    /**
     * Get the authenticated user.
     */
    public function user(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'id' => $user->id,
            'email' => $user->email,
            'username' => $user->username,
            'points' => $user->points,
        ]);
    }

    /**
     * Delete a user (self-deletion only, or any user in local/testing environments for test cleanup).
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $allowAny = in_array(config('app.env'), ['local', 'testing'], true);

        if (!$allowAny && $request->user()->id !== $id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $user = User::find($id);

        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        // Clean up tokens so they cannot outlive the user
        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'User deleted successfully']);
    }

    /**
     * Build the HTTP-only auth cookie. Kept as a secondary mechanism to the
     * bearer token stored by the SPA in localStorage.
     */
    private function authCookie(string $token): \Symfony\Component\HttpFoundation\Cookie
    {
        return cookie(
            'auth_token',
            $token,
            60 * 24 * 7, // 7 days
            '/',
            config('app.env') === 'production' ? config('app.domain') : 'localhost',
            config('app.env') === 'production', // Secure in production
            true, // HTTP-only
            false,
            'Lax' // SameSite
        );
    }

    /**
     * Extract the first validation error message for user-facing display.
     */
    private function firstErrorMessage(ValidationException $e): string
    {
        $first = collect($e->errors())->first();

        return $first[0] ?? 'Validation failed';
    }
}
