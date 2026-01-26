<?php

namespace App\Http\Controllers;

use App\Models\Script;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
        // Validate password confirmation first
        if ($request->password !== $request->password_confirmation) {
            return response()->json([
                'message' => 'Passwords do not match',
                'errors' => [
                    'password' => ['The password confirmation does not match.'],
                ],
            ], 422);
        }

        // Check for existing email
        if (User::where('email', $request->email)->exists()) {
            return response()->json([
                'message' => 'Email already registered',
                'errors' => [
                    'email' => ['The email has already been taken.'],
                ],
            ], 422);
        }

        // Check for existing username
        if (User::where('username', $request->name)->exists()) {
            return response()->json([
                'message' => 'Username already taken',
                'errors' => [
                    'name' => ['This username is already in use.'],
                ],
            ], 422);
        }

        try {
            $validated = $request->validate([
                'email' => ['required', 'email'],
                'password' => ['required', 'min:8'],
                'name' => ['required', 'string', 'max:50'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        }

        // Create the user
        $user = User::create([
            'email' => $validated['email'],
            'username' => $validated['name'],
            'password' => $validated['password'],
            'points' => 0,
        ]);

        // Create starter AI script
        $user->scripts()->create([
            'name' => 'StarterAI.js',
            'code' => self::STARTER_AI_CODE,
            'language' => 'javascript',
        ]);

        // Create API token
        $token = $user->createToken('auth_token')->plainTextToken;

        // Set HTTP-only cookie for session persistence
        $cookie = cookie(
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

        return response()->json([
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'username' => $user->username,
                'points' => $user->points,
            ],
            'token' => $token,
        ], 201)->withCookie($cookie);
    }

    /**
     * Login an existing user.
     */
    public function login(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'email' => ['required', 'email'],
                'password' => ['required'],
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
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

        // Create new token
        $token = $user->createToken('auth_token')->plainTextToken;

        // Set HTTP-only cookie for session persistence
        $cookie = cookie(
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

        return response()->json([
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'username' => $user->username,
                'points' => $user->points,
            ],
            'token' => $token,
        ])->withCookie($cookie);
    }

    /**
     * Logout the current user.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        // Clear the auth cookie
        $cookie = cookie()->forget('auth_token');

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
     * Delete a user (self-deletion only, or any user in test/local environment).
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        // In production, only allow self-deletion
        if (config('app.env') === 'production' && $request->user()->id !== $id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $user->delete();

        return response()->json(['message' => 'User deleted successfully']);
    }
}
