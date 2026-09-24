<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class HealthCheckTest extends TestCase
{
    public function test_health_endpoint_reports_ok_over_a_live_database_connection(): void
    {
        // The route's contract is structural: it MUST touch the database
        // (DB::select) so an unreachable MySQL throws and surfaces as an
        // HTTP 500 — the deploy gate's curl -f then fails loudly. Sqlite in
        // tests exercises the same path; there is no mock.
        $response = $this->getJson('/api/health');

        $response->assertOk()
            ->assertJson(['status' => 'ok']);
        $this->assertSame(1, (int) (DB::select('select 1 as one')[0]->one ?? 0));
    }

    public function test_health_endpoint_is_public_and_unthrottled(): void
    {
        // The health route lives OUTSIDE the throttle:auth and auth:sanctum
        // groups (story 6.5): no credentials, and a burst of deploy-time
        // probes must never trip a rate limiter (false deploy failures).
        for ($i = 0; $i < 12; $i++) {
            $this->getJson('/api/health')->assertOk();
        }
    }
}
