<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Epic 4 v2 (challenge model): a tactic is a ranked fighter.
 *
 * - tactics gains is_ready (challengeable flag), elo (per-tactic, K=50,
 *   starts 1000) and wins/losses (draws are deliberately not counted —
 *   the record is W/L only, per Pelo). The (is_ready, elo) composite index
 *   serves the opponent-pool scan (WHERE is_ready ORDER BY elo).
 * - The polling queue table from the superseded story 4.1 is dropped: the
 *   challenge model has no queue — a match is created when challenged.
 * - matches.points_challenger/points_opponent become signed: they now
 *   store signed elo deltas (a loser's delta is negative).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tactics', function (Blueprint $table) {
            $table->boolean('is_ready')->default(false);
            $table->unsignedInteger('elo')->default(1000);
            $table->unsignedInteger('wins')->default(0);
            $table->unsignedInteger('losses')->default(0);
            $table->index(['is_ready', 'elo']);
        });

        Schema::dropIfExists('matchmaking_queue');

        Schema::table('matches', function (Blueprint $table) {
            $table->integer('points_challenger')->nullable()->change();
            $table->integer('points_opponent')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('matches', function (Blueprint $table) {
            $table->unsignedInteger('points_challenger')->nullable()->change();
            $table->unsignedInteger('points_opponent')->nullable()->change();
        });

        Schema::create('matchmaking_queue', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->unique()->constrained('users')->onDelete('cascade');
            $table->foreignUuid('tactic_id')->constrained('tactics')->onDelete('cascade');
            $table->integer('rating');
            $table->enum('status', ['waiting', 'matched', 'cancelled', 'expired'])->default('waiting');
            $table->index(['status', 'joined_at']);
            $table->foreignUuid('match_id')->nullable()->constrained('matches')->nullOnDelete();
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();
        });

        Schema::table('tactics', function (Blueprint $table) {
            $table->dropIndex(['is_ready', 'elo']);
            $table->dropColumn(['is_ready', 'elo', 'wins', 'losses']);
        });
    }
};
