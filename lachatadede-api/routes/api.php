<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ScriptController;
use Illuminate\Support\Facades\Route;

// Public routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

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
});
