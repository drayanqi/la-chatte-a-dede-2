<?php

namespace Database\Seeders;

use App\Models\Script;
use App\Models\Tactic;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Demo tactics wiring (NOT part of DatabaseSeeder, manual-only).
 *
 * Creates two demo players (tata@tata.com, toto@toto.com) and assigns each
 * one ready tactic ("GK + 1-2-1" / "GK + 2-2") built from the engine demo
 * scripts (lachatadede-engine/src/engine/bots/demo/scripts.json), so they can
 * compete against each other.
 *
 * Run manually:
 *   php artisan db:seed --class=DemoSeeder
 *
 * Idempotent: users and scripts are created/updated in place, existing
 * tactics are reused (lineup replaced). Existing tactics ("Tactic 1") are
 * left untouched.
 */
class DemoSeeder extends Seeder
{
    use WithoutModelEvents;

    private const DEMO_PASSWORD = 'password';

    public function run(): void
    {
        $specPath = dirname(__DIR__, 3).'/lachatadede-engine/src/engine/bots/demo/scripts.json';
        $spec = json_decode((string) file_get_contents($specPath), true, 512, JSON_THROW_ON_ERROR);

        foreach ($spec as $formation) {
            $user = User::firstOrCreate(
                ['email' => $formation['owner_email']],
                [
                    'username' => strtok($formation['owner_email'], '@'),
                    'password' => self::DEMO_PASSWORD,
                    'points' => 0,
                ],
            );

            // 1 script per player, owned by the user. The demo scripts ship
            // with the engine (syntax-checked + engine-tested) and never go
            // through /validate-script, like the Easy Bot scripts.
            $scriptIds = [];
            foreach ($formation['players'] as $index => $player) {
                $script = Script::updateOrCreate(
                    ['user_id' => $user->id, 'name' => $player['script_name']],
                    ['code' => $player['code'], 'language' => 'javascript', 'is_valid' => true],
                );
                $scriptIds[$index + 1] = $script->id;
            }

            // One demo tactic per user: complete 5-slot lineup, ready for
            // matchmaking.
            $tactic = Tactic::firstOrCreate([
                'user_id' => $user->id,
                'name' => $formation['tactic_name'],
            ]);

            DB::transaction(function () use ($tactic, $formation, $scriptIds) {
                $tactic->players()->delete();
                foreach ($formation['players'] as $index => $player) {
                    $tactic->players()->create([
                        'player_slot' => $index + 1,
                        'position_x' => $player['position_x'],
                        'position_y' => $player['position_y'],
                        'script_id' => $scriptIds[$index + 1],
                    ]);
                }
            });

            $tactic->update(['is_ready' => true]);

            $this->command?->info(sprintf(
                '%s: tactic "%s" ready with scripts %s',
                $user->email,
                $formation['tactic_name'],
                implode(', ', array_column($formation['players'], 'script_name')),
            ));
        }
    }
}
