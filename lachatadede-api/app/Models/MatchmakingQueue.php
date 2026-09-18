<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row per user in the ranked matchmaking queue (story 4.1). The row is
 * upserted on join (unique user_id) and never deleted: 'matched',
 * 'cancelled' and 'expired' are terminal row states, a later join
 * reactivates it as 'waiting' with a fresh tactic, rating snapshot and
 * joined_at.
 */
class MatchmakingQueue extends Model
{
    use HasUuids;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'matchmaking_queue';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'tactic_id',
        'rating',
        'status',
        'match_id',
        'joined_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'joined_at' => 'datetime',
        ];
    }

    /**
     * The user holding this queue slot.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The tactic the user queued with.
     */
    public function tactic(): BelongsTo
    {
        return $this->belongsTo(Tactic::class);
    }

    /**
     * The ranked match created when this row was paired.
     */
    public function match(): BelongsTo
    {
        return $this->belongsTo(GameMatch::class, 'match_id');
    }
}
