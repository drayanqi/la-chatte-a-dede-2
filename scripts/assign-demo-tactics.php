<?php

/**
 * Demo tactics wiring (one-off, local/demo databases).
 *
 * For two EXISTING users (tata@tata.com, toto@toto.com) this script:
 *  - creates 5 AI scripts per user (1 per player, from
 *    lachatadede-engine/src/engine/bots/demo/scripts.json),
 *  - creates a NEW ready tactic per user ("GK + 1-2-1" / "GK + 2-2") with the
 *    5 player slots positioned and assigned to the new scripts.
 *
 * Existing tactics ("Tactic 1", StarterAI) are left untouched. Re-runnable:
 * scripts are updated in place by (user, name) and the tactic is reused
 * when it already exists (lineup replaced).
 *
 * Usage: php scripts/assign-demo-tactics.php
 */

use App\Models\Script;
use App\Models\Tactic;
use App\Models\User;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../lachatadede-api/vendor/autoload.php';

/** @var Illuminate\Foundation\Application $app */
$app = require __DIR__.'/../lachatadede-api/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$specPath = __DIR__.'/../lachatadede-engine/src/engine/bots/demo/scripts.json';
$spec = json_decode((string) file_get_contents($specPath), true, 512, JSON_THROW_ON_ERROR);

foreach ($spec as $formation) {
    $user = User::where('email', $formation['owner_email'])->firstOrFail();

    // 1 script per player, owned by the user. The demo scripts ship with the
    // engine (syntax-checked + engine-tested) and never go through
    // /validate-script, like the Easy Bot scripts.
    $scriptIds = [];
    foreach ($formation['players'] as $index => $player) {
        $script = Script::updateOrCreate(
            ['user_id' => $user->id, 'name' => $player['script_name']],
            ['code' => $player['code'], 'language' => 'javascript', 'is_valid' => true],
        );
        $scriptIds[$index + 1] = $script->id;
    }

    // One demo tactic per user: complete 5-slot lineup, ready for matchmaking.
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

    echo sprintf(
        "%s: tactic \"%s\" ready with scripts %s\n",
        $user->email,
        $formation['tactic_name'],
        implode(', ', array_column($formation['players'], 'script_name')),
    );
}
