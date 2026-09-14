<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds the is_valid flag to scripts (Story 3.4): the game engine validates
 * user AI code via POST /validate-script when it is saved. Default false
 * means "not validated by the engine yet" (e.g. engine unreachable at save
 * time, or an intentionally empty script).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('scripts', function (Blueprint $table) {
            $table->boolean('is_valid')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('scripts', function (Blueprint $table) {
            $table->dropColumn('is_valid');
        });
    }
};
