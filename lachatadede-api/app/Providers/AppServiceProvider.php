<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Auth endpoints are rate limited per IP against brute force and
        // enumeration. AUTH_THROTTLE_MAX can be raised for local/E2E runs.
        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute((int) env('AUTH_THROTTLE_MAX', 10))->by($request->ip());
        });

        // Matchmaking endpoints (Epic 4 v2): opponents listing + quick/challenge
        // posts. The ranked simulation runs synchronously in the request, so a
        // client must not hammer these while a simulation holds the worker:
        // per-IP caps keep a runaway client from starving it.
        RateLimiter::for('matchmaking', function (Request $request) {
            $max = $request->isMethod('GET') ? 120 : 20;

            return Limit::perMinute($max)->by($request->ip());
        });
    }
}
