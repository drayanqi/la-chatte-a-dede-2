<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TacticPlayer extends Model
{
    use HasFactory, HasUuids;

    /**
     * The table associated with the model (singular compound name).
     *
     * @var string
     */
    protected $table = 'tactic_player';

    /**
     * Player rows have no lifecycle of their own; no timestamps columns.
     *
     * @var bool
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'tactic_id',
        'player_slot',
        'position_x',
        'position_y',
        'script_id',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'player_slot' => 'integer',
            'position_x' => 'float',
            'position_y' => 'float',
        ];
    }

    /**
     * Get the tactic this player slot belongs to.
     */
    public function tactic(): BelongsTo
    {
        return $this->belongsTo(Tactic::class);
    }

    /**
     * Get the AI script driving this slot (null when unassigned).
     */
    public function script(): BelongsTo
    {
        return $this->belongsTo(Script::class);
    }
}
