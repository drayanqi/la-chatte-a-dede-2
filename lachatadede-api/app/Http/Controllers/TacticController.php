<?php

namespace App\Http\Controllers;

use App\Models\Tactic;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class TacticController extends Controller
{
    /**
     * List all tactics for the authenticated user, players eager-loaded.
     */
    public function index(): JsonResponse
    {
        $tactics = Auth::user()->tactics()
            ->with('players')
            ->orderBy('updated_at', 'desc')
            ->get()
            ->map(fn (Tactic $tactic) => $this->serializeTactic($tactic));

        return response()->json($tactics);
    }

    /**
     * Get a single tactic by ID.
     */
    public function show(string $id): JsonResponse
    {
        $tactic = Auth::user()->tactics()->with('players')->find($id);

        if (! $tactic) {
            return response()->json(['message' => 'Tactic not found'], 404);
        }

        return response()->json($this->serializeTactic($tactic));
    }

    /**
     * Create a new tactic with its player slots.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());

        // The secondary is the away kit — the strip worn when the primary
        // clashes with the opponent. It only means anything when it differs
        // from the primary, so the EFFECTIVE pair (incoming value or column
        // default) must be distinct. Case-insensitive: the visual collision
        // law parses hex case-insensitively, so #FF6B1A collides with #ff6b1a.
        $effectivePrimary = strtolower($validated['color_primary'] ?? '#ff6b1a');
        $effectiveSecondary = strtolower($validated['color_secondary'] ?? '#1a8cff');
        if ($effectivePrimary === $effectiveSecondary) {
            return response()->json(['message' => 'Primary and secondary colors must be different'], 422);
        }

        // Same rule as update: a tactic can only be born ready with a
        // complete lineup in the same payload.
        if (($validated['is_ready'] ?? false) === true
            && ! $this->payloadLineupComplete($validated['players'] ?? [])) {
            return response()->json(['message' => 'Tactic lineup is incomplete'], 422);
        }

        $ownershipError = $this->foreignScriptError($validated);
        if ($ownershipError !== null) {
            return $ownershipError;
        }

        try {
            $tactic = DB::transaction(function () use ($validated) {
                $tactic = Auth::user()->tactics()->create([
                    'name' => $validated['name'],
                    'is_ready' => (bool) ($validated['is_ready'] ?? false),
                    'color_primary' => $validated['color_primary'] ?? '#ff6b1a',
                    'color_secondary' => $validated['color_secondary'] ?? '#1a8cff',
                    'crest' => $validated['crest'] ?? null,
                ]);

                $this->replacePlayers($tactic, $validated['players'] ?? []);

                return $tactic;
            });
        } catch (QueryException $e) {
            // A referenced script can be deleted between the ownership check
            // and the insert (TOCTOU on the FK); surface as validation failure.
            return $this->foreignScriptErrorResponse();
        }

        // Refresh before serializing: create() leaves column-defaulted
        // attributes (elo/wins/losses) unset in the in-memory model.
        return response()->json($this->serializeTactic($tactic->refresh()->load('players')), 201);
    }

    /**
     * Update an existing tactic: name and/or the full players array.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $tactic = Auth::user()->tactics()->with('players.script')->find($id);

        if (! $tactic) {
            return response()->json(['message' => 'Tactic not found'], 404);
        }

        $validated = $request->validate($this->rules(false));

        // Only keys the client explicitly sent are updated; a full players
        // array replaces every existing slot.
        $changes = [];
        if ($request->has('name')) {
            // An explicitly sent empty name (middleware delivers '' as null)
            // keeps the current one rather than violating the NOT NULL column.
            $changes['name'] = $validated['name'] ?? $tactic->name;
        }
        if ($request->has('is_ready')) {
            $changes['is_ready'] = (bool) ($validated['is_ready'] ?? false);
        }
        // Colors have column defaults and are never null: an explicitly sent
        // null key keeps the current color, a valid hex replaces it.
        if ($request->has('color_primary')) {
            $changes['color_primary'] = $validated['color_primary'] ?? $tactic->color_primary;
        }
        if ($request->has('color_secondary')) {
            $changes['color_secondary'] = $validated['color_secondary'] ?? $tactic->color_secondary;
        }
        // The crest is nullable: an explicitly sent null clears it.
        if ($request->has('crest')) {
            $changes['crest'] = $validated['crest'];
        }
        // An explicitly sent null players key (middleware delivers '' as null)
        // keeps the current lineup; an empty array is a valid full clear.
        $replacePlayers = $request->has('players') && $validated['players'] !== null;

        // Same away-kit rule as store, on the EFFECTIVE pair — but only when
        // this request actually touches a color: a sent value combines with
        // the stored one for the key that was not sent, so partial updates
        // are covered. A rename or ready-toggle on a legacy equal-pair row
        // never chose a color and must not be vetoed by one (the Équipement
        // modal heals those rows by sending both colors).
        if ($request->has('color_primary') || $request->has('color_secondary')) {
            $effectivePrimary = strtolower($changes['color_primary'] ?? $tactic->color_primary);
            $effectiveSecondary = strtolower($changes['color_secondary'] ?? $tactic->color_secondary);
            if ($effectivePrimary === $effectiveSecondary) {
                return response()->json(['message' => 'Primary and secondary colors must be different'], 422);
            }
        }

        // Marking a tactic ready is only meaningful with a complete lineup:
        // the gate re-validates against the lineup that would result from
        // this very request (replaced players when present, else the stored
        // one). Un-readying is never gated — standing down is always allowed.
        if (($changes['is_ready'] ?? false) === true) {
            $complete = $replacePlayers
                ? $this->payloadLineupComplete($validated['players'] ?? [])
                : $tactic->lineupIsComplete();

            if (! $complete) {
                return response()->json(['message' => 'Tactic lineup is incomplete'], 422);
            }
        }

        if ($replacePlayers) {
            $ownershipError = $this->foreignScriptError($validated);
            if ($ownershipError !== null) {
                return $ownershipError;
            }
        }

        try {
            DB::transaction(function () use ($tactic, $changes, $replacePlayers, $validated) {
                if ($changes !== []) {
                    $tactic->update($changes);
                }
                if ($replacePlayers) {
                    $this->replacePlayers($tactic, $validated['players'] ?? []);
                    if ($changes === []) {
                        // Players-only update: keep updated_at in sync with the
                        // lineup change (index() orders by updated_at desc).
                        $tactic->touch();
                    }
                }
            });
        } catch (QueryException $e) {
            return $this->foreignScriptErrorResponse();
        }

        return response()->json($this->serializeTactic($tactic->load('players')));
    }

    /**
     * Delete a tactic (players are removed by the database cascade).
     */
    public function destroy(string $id): JsonResponse
    {
        $tactic = Auth::user()->tactics()->find($id);

        if (! $tactic) {
            return response()->json(['message' => 'Tactic not found'], 404);
        }

        $tactic->delete();

        return response()->json(['message' => 'Tactic deleted successfully']);
    }

    /**
     * Validation rules shared by store and update; the name only becomes
     * optional for updates (partial payload).
     *
     * @return array<string, mixed>
     */
    private function rules(bool $nameRequired = true): array
    {
        return [
            'name' => [$nameRequired ? 'required' : 'nullable', 'string', 'max:100'],
            'is_ready' => ['nullable', 'boolean'],
            'color_primary' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'color_secondary' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            // Fixed crest list (mockup v4): server-side whitelist
            'crest' => ['nullable', 'string', 'max:8', 'in:⚽,🦊,🐺,🦁,🐸,🚀,🐙,🔥,👑,🍕'],
            'players' => ['nullable', 'array', 'max:5'],
            'players.*.player_slot' => ['required', 'integer', 'min:1', 'max:5', 'distinct'],
            'players.*.position_x' => ['required', 'numeric', 'min:0', 'max:100'],
            'players.*.position_y' => ['required', 'numeric', 'min:0', 'max:50'],
            'players.*.script_id' => ['nullable', 'uuid', 'exists:scripts,id'],
        ];
    }

    /**
     * Lineup completeness of a raw players payload (validation already
     * guarantees distinct slots 1-5, at most 5 entries): complete means
     * exactly 5 slots, each with a script reference.
     *
     * @param  array<int, array<string, mixed>>  $players
     */
    private function payloadLineupComplete(array $players): bool
    {
        return count($players) === 5
            && collect($players)->every(fn ($player) => ($player['script_id'] ?? null) !== null);
    }

    /**
     * Replace every player slot of the tactic with the given payload.
     *
     * @param  array<int, array<string, mixed>>  $players
     */
    private function replacePlayers(Tactic $tactic, array $players): void
    {
        $tactic->players()->delete();

        foreach ($players as $player) {
            $tactic->players()->create([
                'player_slot' => $player['player_slot'],
                'position_x' => $player['position_x'],
                'position_y' => $player['position_y'],
                'script_id' => $player['script_id'] ?? null,
            ]);
        }
    }

    /**
     * Scripts are assigned by reference; they must belong to the tactic's
     * owner. Returns a 422 response when any script_id is foreign, null when
     * all references are owned (or absent).
     */
    private function foreignScriptError(array $validated): ?JsonResponse
    {
        $scriptIds = array_values(array_filter(
            array_column($validated['players'] ?? [], 'script_id')
        ));

        if ($scriptIds === []) {
            return null;
        }

        $ownedCount = Auth::user()->scripts()->whereIn('id', $scriptIds)->count();

        // Duplicate references to the same owned script must not fail the
        // count comparison (SQL WHERE IN deduplicates).
        if ($ownedCount !== count(array_unique($scriptIds))) {
            return $this->foreignScriptErrorResponse();
        }

        return null;
    }

    private function foreignScriptErrorResponse(): JsonResponse
    {
        return response()->json([
            'message' => 'One or more scripts do not belong to you',
            'errors' => [
                'players' => ['One or more scripts do not belong to you.'],
            ],
        ], 422);
    }

    /**
     * Serialize a tactic with its players to the public API shape
     * (camelCase; script references only — never script code, NFR9).
     *
     * @return array<string, mixed>
     */
    private function serializeTactic(Tactic $tactic): array
    {
        return [
            'id' => $tactic->id,
            'name' => $tactic->name,
            'isSystem' => (bool) $tactic->is_system,
            'isReady' => (bool) $tactic->is_ready,
            'elo' => $tactic->elo,
            'wins' => $tactic->wins,
            'losses' => $tactic->losses,
            'colorPrimary' => $tactic->color_primary,
            'colorSecondary' => $tactic->color_secondary,
            'crest' => $tactic->crest,
            'players' => $tactic->players
                ->sortBy('player_slot')
                ->values()
                ->map(fn ($player) => [
                    'playerSlot' => $player->player_slot,
                    'positionX' => $player->position_x,
                    'positionY' => $player->position_y,
                    'scriptId' => $player->script_id,
                ])
                ->all(),
        ];
    }
}
