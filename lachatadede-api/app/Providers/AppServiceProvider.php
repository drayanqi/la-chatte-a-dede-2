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

        // Matchmaking endpoints: the 2s status poll dominates the traffic
        // and takes a lockForUpdate transaction per call, so it gets a
        // higher cap than join/cancel. Sized so two concurrent E2E users on
        // one loopback IP never trip it (2 x 30 polls/min at the 2s cadence
        // + headroom).
        RateLimiter::for('matchmaking', function (Request $request) {
            $max = $request->isMethod('GET') ? 120 : 20;

            return Limit::perMinute($max)->by($request->ip());
        });
    }
}
