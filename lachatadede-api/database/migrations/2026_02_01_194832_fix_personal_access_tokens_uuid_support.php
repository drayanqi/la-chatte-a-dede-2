<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('personal_access_tokens', function (Blueprint $table) {
            // Drop the existing morph index
            $table->dropIndex(['tokenable_type', 'tokenable_id']);

            // Change tokenable_id from BIGINT to CHAR(36) for UUID support
            $table->char('tokenable_id', 36)->change();

            // Recreate the index
            $table->index(['tokenable_type', 'tokenable_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->dropIndex(['tokenable_type', 'tokenable_id']);
            $table->unsignedBigInteger('tokenable_id')->change();
            $table->index(['tokenable_type', 'tokenable_id']);
        });
    }
};
