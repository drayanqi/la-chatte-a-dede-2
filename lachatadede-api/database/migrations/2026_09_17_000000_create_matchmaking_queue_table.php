<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The ranked matchmaking queue: one row per user waiting for an opponent
 * (Story 4.1). Joining upserts the row (a user holds at most one — unique
 * user_id); pairing flips BOTH participants' rows to 'matched' and stamps
 * the created GameMatch id; timeout and cancel mark the row 'expired' /
 * 'cancelled'.
 *
 * Rows are never deleted: "removed from queue" (AC #3/#4) means the status
 * leaves 'waiting' — the row survives every terminal state for audit, and a
 * later join reactivates it (status back to 'waiting', fresh tactic, rating
 * snapshot and joined_at).
 *
 * rating snapshots users.points at enqueue time: pairing prefers the
 * waiting candidate with the smallest rating difference. The joined_at
 * cutoff (now - 30s) is what makes an entry stale for both pairing and the
 * lazy expiry performed by the status poll.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('matchmaking_queue', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->unique()->constrained('users')->onDelete('cascade');
            $table->foreignUuid('tactic_id')->constrained('tactics')->onDelete('cascade');
            $table->integer('rating');
            $table->enum('status', ['waiting', 'matched', 'cancelled', 'expired'])->default('waiting');
            // The pairing scan filters on (status, joined_at) and sorts by
            // joined_at; rows are never deleted (audit), so without this
            // index every join full-scans the table's whole history.
            $table->index(['status', 'joined_at']);
            $table->foreignUuid('match_id')->nullable()->constrained('matches')->nullOnDelete();
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('matchmaking_queue');
    }
};
