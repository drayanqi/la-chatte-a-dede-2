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

        $ownershipError = $this->foreignScriptError($validated);
        if ($ownershipError !== null) {
            return $ownershipError;
        }

        try {
            $tactic = DB::transaction(function () use ($validated) {
                $tactic = Auth::user()->tactics()->create([
                    'name' => $validated['name'],
                ]);

                $this->replacePlayers($tactic, $validated['players'] ?? []);

                return $tactic;
            });
        } catch (QueryException $e) {
            // A referenced script can be deleted between the ownership check
            // and the insert (TOCTOU on the FK); surface as validation failure.
            return $this->foreignScriptErrorResponse();
        }

        return response()->json($this->serializeTactic($tactic->load('players')), 201);
    }

    /**
     * Update an existing tactic: name and/or the full players array.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $tactic = Auth::user()->tactics()->with('players')->find($id);

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
        // An explicitly sent null players key (middleware delivers '' as null)
        // keeps the current lineup; an empty array is a valid full clear.
        $replacePlayers = $request->has('players') && $validated['players'] !== null;

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
            'players' => ['nullable', 'array', 'max:5'],
            'players.*.player_slot' => ['required', 'integer', 'min:1', 'max:5', 'distinct'],
            'players.*.position_x' => ['required', 'numeric', 'min:0', 'max:100'],
            'players.*.position_y' => ['required', 'numeric', 'min:0', 'max:50'],
            'players.*.script_id' => ['nullable', 'uuid', 'exists:scripts,id'],
        ];
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
