<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tactics store a reusable team lineup: which AI script drives each of the
 * 5 player slots and where each slot starts on the field.
 *
 * A tactic belongs to its owner (user_id nullable for the seeded system
 * tactic used by the Easy Bot, Story 3.6). Players reference their script
 * by id with ON DELETE SET NULL: deleting a script leaves the slot
 * unassigned rather than destroying the lineup. Script code is never
 * attached to tactics (NFR9: code privacy) — only the reference.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tactics', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->nullable()->index()->constrained()->onDelete('cascade');
            $table->string('name', 100);
            $table->boolean('is_public')->default(false);
            $table->boolean('is_system')->default(false);
            $table->timestamps();
        });

        Schema::create('tactic_player', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tactic_id')->index()->constrained('tactics')->onDelete('cascade');
            $table->unsignedTinyInteger('player_slot');
            $table->float('position_x');
            $table->float('position_y');
            $table->foreignUuid('script_id')->nullable()->constrained('scripts')->nullOnDelete();
            $table->unique(['tactic_id', 'player_slot']);
        });
    }
};
