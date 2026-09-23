<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Matches record a simulated 5v5 game between two tactics.
 *
 * Schema variance from database-schema.md's `match` table (deliberate,
 * story 3.5): the planning schema models multiplayer ranked matches only
 * (both users and tactics NOT NULL). Practice mode needs nullable opponent
 * sides plus mode/status/frames_file columns, so this table is the superset
 * that Epic 4 reuses with mode='ranked'.
 *
 * frames_file stores the simulation output path relative to the Laravel
 * storage root (e.g. "simulations/{match_id}.json"): the engine writes the
 * frames wherever the /simulate payload's output_path points (shared storage
 * mount in docker), so an engine-side absolute path would not be portable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('matches', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('challenger_id')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->foreignUuid('opponent_id')->nullable()->index()->constrained('users')->nullOnDelete();
            $table->foreignUuid('challenger_tactic')->nullable()->index()->constrained('tactics')->nullOnDelete();
            $table->foreignUuid('opponent_tactic')->nullable()->index()->constrained('tactics')->nullOnDelete();
            $table->enum('mode', ['practice', 'ranked'])->default('practice');
            $table->unsignedInteger('seed');
            $table->foreignUuid('bot_tactic')->nullable()->index()->constrained('tactics')->nullOnDelete();
            $table->unsignedInteger('score_challenger')->default(0);
            $table->unsignedInteger('score_opponent')->default(0);
            $table->enum('result', ['challenger_win', 'opponent_win', 'draw'])->nullable();
            $table->unsignedInteger('points_challenger')->nullable();
            $table->unsignedInteger('points_opponent')->nullable();
            $table->unsignedInteger('duration_frames')->default(0);
            $table->enum('status', ['pending', 'completed', 'failed'])->default('pending');
            $table->string('frames_file')->nullable();
            $table->timestamps();
        });
    }
};
