<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tactic extends Model
{
    use HasFactory, HasUuids;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'name',
        'is_public',
        'is_system',
        'is_ready',
        'elo',
        'wins',
        'losses',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_public' => 'boolean',
            'is_system' => 'boolean',
            'is_ready' => 'boolean',
            'elo' => 'integer',
            'wins' => 'integer',
            'losses' => 'integer',
        ];
    }

    /**
     * A tactic can field a match only with 5 slots, each scripted. Shared
     * rule for the ranked opponent pool (Epic 4), the ready-flag gate and
     * the pairing-time re-validation.
     */
    public function lineupIsComplete(): bool
    {
        return $this->players->count() === 5
            && $this->players->every(fn ($player) => $player->script !== null);
    }

    /**
     * Get the user that owns the tactic (null for system tactics).
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the player slots for the tactic.
     */
    public function players(): HasMany
    {
        return $this->hasMany(TacticPlayer::class);
    }
}
