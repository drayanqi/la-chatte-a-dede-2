<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\MatchController;
use App\Http\Controllers\MatchmakingController;
use App\Http\Controllers\ScriptController;
use App\Http\Controllers\TacticController;
use Illuminate\Support\Facades\Route;

// Public routes (rate limited against brute force and enumeration)
Route::middleware('throttle:auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
});

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::delete('/users/{id}', [AuthController::class, 'destroy']);

    // Scripts API
    Route::get('/scripts', [ScriptController::class, 'index']);
    Route::get('/scripts/{id}', [ScriptController::class, 'show']);
    Route::post('/scripts', [ScriptController::class, 'store']);
    Route::put('/scripts/{id}', [ScriptController::class, 'update']);
    Route::delete('/scripts/{id}', [ScriptController::class, 'destroy']);

    // Tactics API
    Route::get('/tactics', [TacticController::class, 'index']);
    Route::get('/tactics/{id}', [TacticController::class, 'show']);
    Route::post('/tactics', [TacticController::class, 'store']);
    Route::put('/tactics/{id}', [TacticController::class, 'update']);
    Route::delete('/tactics/{id}', [TacticController::class, 'destroy']);

    // Matches API
    Route::get('/matches', [MatchController::class, 'index']);
    Route::post('/matches', [MatchController::class, 'store']);
    Route::get('/matches/{id}', [MatchController::class, 'show']);
    Route::get('/matches/{id}/frames', [MatchController::class, 'frames']);

    // Ranked matchmaking API (Epic 4 v2). Simulations run synchronously in
    // the request: rate limit per IP so a runaway client cannot starve the
    // single PHP worker while a simulation holds it.
    Route::middleware('throttle:matchmaking')->group(function () {
        Route::get('/matchmaking/opponents', [MatchmakingController::class, 'opponents']);
        Route::post('/matchmaking/quick', [MatchmakingController::class, 'quick']);
        Route::post('/matchmaking/challenge', [MatchmakingController::class, 'challenge']);
    });
});
