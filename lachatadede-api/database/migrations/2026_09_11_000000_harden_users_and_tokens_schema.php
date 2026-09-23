<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Harden the auth schema:
 *
 * - users.username gains a unique index (registration checks a unique
 *   username; without the index a concurrent registration race can persist
 *   duplicates).
 * - sessions.user_id moves from bigint to uuid to match the UUID users table.
 *
 * (The personal_access_tokens.tokenable_id uuid fix ships separately in the
 * 2026_02_01_194832 migration.)
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasIndex('users', 'users_username_unique')) {
            Schema::table('users', function (Blueprint $table) {
                $table->unique('username');
            });
        }

        // The index on user_id already exists (created with the table) and
        // survives the table recreation; re-adding it would collide.
        Schema::table('sessions', function (Blueprint $table) {
            $table->uuid('user_id')->nullable()->change();
        });
    }
};
