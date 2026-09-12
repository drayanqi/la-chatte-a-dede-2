<?php

namespace App\Http\Controllers;

use App\Models\Script;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ScriptController extends Controller
{
    /**
     * List all scripts for the authenticated user.
     */
    public function index(): JsonResponse
    {
        $scripts = Auth::user()->scripts()
            ->orderBy('updated_at', 'desc')
            ->get()
            ->map(function ($script) {
                return [
                    'id' => $script->id,
                    'name' => $script->name,
                    'code' => $script->code,
                    'language' => $script->language,
                    'updated_at' => $script->updated_at->toISOString(),
                ];
            });

        return response()->json($scripts);
    }

    /**
     * Get a single script by ID.
     */
    public function show(string $id): JsonResponse
    {
        $script = Auth::user()->scripts()->find($id);

        if (!$script) {
            return response()->json(['message' => 'Script not found'], 404);
        }

        return response()->json([
            'id' => $script->id,
            'name' => $script->name,
            'code' => $script->code,
            'language' => $script->language,
            'updated_at' => $script->updated_at->toISOString(),
        ]);
    }

    /**
     * Create a new script.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:65000',
            'language' => 'nullable|string|max:50',
        ]);

        $script = Auth::user()->scripts()->create([
            'name' => $validated['name'],
            // Empty code is a legitimate value (cleared editor); Laravel's
            // ConvertEmptyStringsToNull middleware delivers it as null.
            'code' => $validated['code'] ?? '',
            'language' => $validated['language'] ?? 'javascript',
        ]);

        return response()->json([
            'id' => $script->id,
            'name' => $script->name,
            'code' => $script->code,
            'language' => $script->language,
            'updated_at' => $script->updated_at->toISOString(),
        ], 201);
    }

    /**
     * Update an existing script.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $script = Auth::user()->scripts()->find($id);

        if (!$script) {
            return response()->json(['message' => 'Script not found'], 404);
        }

        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'code' => 'nullable|string|max:65000',
            'language' => 'nullable|string|max:50',
        ]);

        // Only keys the client explicitly sent are updated. An explicitly
        // sent empty code clears the script (empty string is a real value);
        // ConvertEmptyStringsToNull delivers it as null.
        $changes = [];
        foreach (['name', 'code', 'language'] as $field) {
            if ($request->has($field)) {
                $changes[$field] = $field === 'code'
                    ? ($validated[$field] ?? '')
                    : $validated[$field];
            }
        }

        $script->update($changes);

        return response()->json([
            'id' => $script->id,
            'name' => $script->name,
            'code' => $script->code,
            'language' => $script->language,
            'updated_at' => $script->updated_at->toISOString(),
        ]);
    }

    /**
     * Delete a script.
     */
    public function destroy(string $id): JsonResponse
    {
        $script = Auth::user()->scripts()->find($id);

        if (!$script) {
            return response()->json(['message' => 'Script not found'], 404);
        }

        $script->delete();

        return response()->json(['message' => 'Script deleted successfully']);
    }
}
