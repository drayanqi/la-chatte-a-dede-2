<?php

namespace App\Services;

use App\Models\Tactic;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class SystemTacticService
{
    /**
     * The Easy Bot system tactic (story 3.6): the opponent AI of every
     * practice match. Shared by the seeder and the match endpoint so both
     * produce the same rows.
     *
     * Bot scripts, in tactic slot order (1-5). Source of truth is the engine
     * fixture directory (lachatadede-engine/src/engine/bots/easy/); this JSON
     * copy is guarded against drift by the engine-sync test in
     * tests/Feature/Matches/EasyBotTest.php.
     */
    private const SCRIPT_ROLES = ['goalkeeper', 'defender1', 'defender2', 'attacker1', 'attacker2'];

    /**
     * Home-side slot geometry (story 3.2): GameEngineService mirrors the bot
     * tactic across the halfway line when building the engine payload.
     */
    private const FORMATION = [[8.0, 25.0], [25.0, 15.0], [25.0, 35.0], [40.0, 15.0], [40.0, 35.0]];

    /**
     * Resolve the system tactic driving the Easy Bot, creating it on demand
     * so the endpoint also works on a freshly migrated database (e.g. E2E
     * runs, which migrate without seeding). Idempotent.
     */
    public function ensureEasyBotTactic(): Tactic
    {
        try {
            return $this->ensureOnce();
        } catch (UniqueConstraintViolationException) {
            // Lost the system-user create race against a concurrent first
            // match (e.g. parallel E2E workers): everything exists now —
            // resolve again from the committed state.
            return $this->ensureOnce();
        }
    }

    private function ensureOnce(): Tactic
    {
        return DB::transaction(function () {
            // lockForUpdate serializes concurrent first calls: the second
            // transaction waits here, then sees what the first committed.
            $existing = Tactic::where('is_system', true)->lockForUpdate()->first();

            if ($existing && $this->isComplete($existing)) {
                // Self-heal stale content: a database seeded by an older
                // iteration keeps outdated script code (in the wild: empty
                // `function update(game) {}` stubs that freeze the bot for
                // the whole match). Refresh the rows in place — never
                // recreate the tactic, matches reference its id.
                $this->syncScriptContent($existing);

                return $existing;
            }

            if ($existing) {
                // A crash mid-creation left a partial tactic; rebuild it so
                // one bad row cannot 502 every future practice match.
                $existing->delete();
            }

            // scripts.user_id is NOT NULL: a dedicated system user owns the
            // bot scripts; the tactic itself belongs to no one.
            $systemUser = User::firstWhere('email', 'system-bot@lachatadede.local')
                ?? User::create([
                    'email' => 'system-bot@lachatadede.local',
                    'username' => 'EasyBot',
                    'password' => bin2hex(random_bytes(16)),
                ]);

            $tactic = Tactic::create([
                'name' => 'Easy Bot',
                'is_system' => true,
                'is_public' => true,
            ]);

            $scripts = $this->canonicalScripts();

            foreach (self::SCRIPT_ROLES as $index => $role) {
                $script = $systemUser->scripts()->create([
                    'name' => 'EasyBot-'.ucfirst($role),
                    'code' => $scripts[$role],
                    'language' => 'javascript',
                    // The bot scripts ship with the engine and pass its test
                    // suite; they never go through /validate-script.
                    'is_valid' => true,
                ]);
                $tactic->players()->create([
                    'player_slot' => $index + 1,
                    'position_x' => self::FORMATION[$index][0],
                    'position_y' => self::FORMATION[$index][1],
                    'script_id' => $script->id,
                ]);
            }

            return $tactic;
        });
    }

    /**
     * The system tactic is usable only with all 5 slots scripted.
     */
    private function isComplete(Tactic $tactic): bool
    {
        return $tactic->players()->count() === 5
            && $tactic->players()->whereNull('script_id')->doesntExist();
    }

    /**
     * The canonical bot scripts (seeder JSON copy of the engine fixtures,
     * drift-guarded by the EasyBot feature tests).
     *
     * @return array<string, string>
     */
    private function canonicalScripts(): array
    {
        return json_decode(
            (string) file_get_contents(database_path('seeders/data/easy-bot-scripts.json')),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );
    }

    /**
     * Refresh the bot scripts in place when they drifted from the canonical
     * JSON (older seeds never rewrote existing rows). Slot order maps to
     * SCRIPT_ROLES. Idempotent: fresh rows are left untouched.
     */
    private function syncScriptContent(Tactic $tactic): void
    {
        $canonical = $this->canonicalScripts();

        $players = $tactic->players()->with('script')->orderBy('player_slot')->get();
        foreach ($players as $player) {
            $role = self::SCRIPT_ROLES[$player->player_slot - 1] ?? null;
            if ($role === null || $player->script === null) {
                continue;
            }

            $name = 'EasyBot-'.ucfirst($role);
            if ($player->script->code !== $canonical[$role] || $player->script->name !== $name) {
                $player->script->update([
                    'name' => $name,
                    'code' => $canonical[$role],
                    // Bot scripts ship with the engine and pass its test
                    // suite; they never go through /validate-script.
                    'is_valid' => true,
                ]);
            }
        }
    }
}
