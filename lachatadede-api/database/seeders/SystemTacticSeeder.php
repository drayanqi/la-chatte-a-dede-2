<?php

namespace Database\Seeders;

use App\Services\SystemTacticService;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class SystemTacticSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the Easy Bot system tactic (story 3.6): idempotent, safe to run
     * on every deploy.
     */
    public function run(SystemTacticService $service): void
    {
        $service->ensureEasyBotTactic();
    }
}
