<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A simulated match between two tactics.
 *
 * Named GameMatch (not Match) because `match` is a reserved PHP 8 keyword.
 * The challenger is the user who started the match; the opponent side is
 * nullable for practice games (bot only). Rating points stay null until
 * Epic 4 (ranked).
 */
class GameMatch extends Model
{
    use HasUuids;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'matches';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'challenger_id',
        'opponent_id',
        'challenger_tactic',
        'opponent_tactic',
        'mode',
        'seed',
        'bot_tactic',
        'score_challenger',
        'score_opponent',
        'result',
        'points_challenger',
        'points_opponent',
        'duration_frames',
        'status',
        'frames_file',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'seed' => 'integer',
            'score_challenger' => 'integer',
            'score_opponent' => 'integer',
            'points_challenger' => 'integer',
            'points_opponent' => 'integer',
            'duration_frames' => 'integer',
        ];
    }

    /**
     * Get the user who started the match.
     */
    public function challenger(): BelongsTo
    {
        return $this->belongsTo(User::class, 'challenger_id');
    }

    /**
     * Get the opposing user (null for practice matches).
     */
    public function opponent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'opponent_id');
    }

    /**
     * Get the tactic fielded by the challenger.
     */
    public function challengerTactic(): BelongsTo
    {
        return $this->belongsTo(Tactic::class, 'challenger_tactic');
    }

    /**
     * Get the tactic fielded by the opponent (ranked matches).
     */
    public function opponentTactic(): BelongsTo
    {
        return $this->belongsTo(Tactic::class, 'opponent_tactic');
    }

    /**
     * Get the system tactic driving the bot (practice matches).
     */
    public function botTactic(): BelongsTo
    {
        return $this->belongsTo(Tactic::class, 'bot_tactic');
    }

    /**
     * Matches the user started (practice challenger side; ranked reuse).
     */
    public function scopeOwnedBy(Builder $query, User $user): Builder
    {
        return $query->where('challenger_id', $user->id);
    }

    /**
     * Matches the user took part in on EITHER side (Epic 4 v2, AC: 4.2 #4):
     * a challenge is unilateral — the offline opponent must still find the
     * match in their history.
     */
    public function scopeForUser(Builder $query, User $user): Builder
    {
        return $query->where(function (Builder $q) use ($user) {
            $q->where('challenger_id', $user->id)
                ->orWhere('opponent_id', $user->id);
        });
    }
}
