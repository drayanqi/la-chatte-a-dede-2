<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tactics', function (Blueprint $table) {
            $table->string('color_primary', 7)->default('#ff6b1a');
            $table->string('color_secondary', 7)->default('#1a8cff');
            $table->string('crest', 8)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('tactics', function (Blueprint $table) {
            $table->dropColumn(['color_primary', 'color_secondary', 'crest']);
        });
    }
};
