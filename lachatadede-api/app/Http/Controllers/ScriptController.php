<?php

namespace App\Http\Controllers;

use App\Models\Script;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

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
                    'is_valid' => $script->is_valid,
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

        return response()->json($this->scriptPayload($script));
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

        $code = $validated['code'] ?? '';
        $language = $validated['language'] ?? 'javascript';

        Log::warning('PROBE-CODE-RECEIVED', ['code' => $code]);

        $validation = $this->validateWithEngine($code, $language);
        if ($validation['engine_reachable'] && !$validation['valid']) {
            return response()->json([
                'message' => 'Script validation failed',
                'errors' => $validation['errors'],
            ], 422);
        }

        $script = Auth::user()->scripts()->create([
            'name' => $validated['name'],
            // Empty code is a legitimate value (cleared editor); Laravel's
            // ConvertEmptyStringsToNull middleware delivers it as null.
            'code' => $code,
            'language' => $language,
            'is_valid' => $validation['valid'],
        ]);

        return response()->json($this->withWarning(
            $this->scriptPayload($script),
            $validation,
            $code
        ), 201);
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

        // Revalidate whenever the code or the language changed: the engine
        // judges the (code, language) pair, so flipping only the language can
        // invalidate a stored script. A pure rename must not touch the status.
        $codeChanged = array_key_exists('code', $changes);
        $languageChanged = array_key_exists('language', $changes);
        $code = $codeChanged ? ($changes['code'] ?? '') : $script->code;
        if ($codeChanged || $languageChanged) {
            $validation = $this->validateWithEngine($code, $changes['language'] ?? $script->language);
            if ($validation['engine_reachable'] && !$validation['valid']) {
                return response()->json([
                    'message' => 'Script validation failed',
                    'errors' => $validation['errors'],
                ], 422);
            }
            $changes['is_valid'] = $validation['valid'];
        } else {
            $validation = ['engine_reachable' => true, 'valid' => $script->is_valid, 'errors' => []];
        }

        $script->update($changes);

        try {
            $script->refresh();
        } catch (ModelNotFoundException) {
            // The script was deleted concurrently while validation ran
            // (the engine call can take up to 10s).
            return response()->json(['message' => 'Script not found'], 404);
        }

        return response()->json($this->withWarning(
            $this->scriptPayload($script),
            $validation,
            $code
        ));
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

    /**
     * Response body for a single script.
     *
     * @param Script $script
     * @return array<string, mixed>
     */
    private function scriptPayload(Script $script): array
    {
        return [
            'id' => $script->id,
            'name' => $script->name,
            'code' => $script->code,
            'language' => $script->language,
            'is_valid' => $script->is_valid,
            'updated_at' => $script->updated_at->toISOString(),
        ];
    }

    /**
     * Validates script code with the game engine (POST /validate-script,
     * 10s timeout). Never blocks editing offline: when the engine cannot be
     * reached the caller stores the script as unvalidated instead. Failures
     * are logged server-side and reported with an accurate user-facing
     * warning (unreachable vs HTTP error vs malformed response).
     *
     * @return array{valid: bool, errors: array<int, array<string, mixed>>, engine_reachable: bool, warning?: string}
     */
    private function validateWithEngine(string $code, string $language): array
    {
        // An empty script is a legitimate value (cleared editor): there is
        // nothing to validate. The engine treats it as an idle player.
        if (trim($code) === '') {
            return ['valid' => false, 'errors' => [], 'engine_reachable' => false];
        }

        $url = rtrim((string) config('services.game_engine.url'), '/') . '/validate-script';

        try {
            $response = Http::timeout(10)->post($url, [
                'code' => $code,
                'language' => $language,
            ]);
        } catch (Throwable $e) {
            Log::warning('Game engine unreachable during script validation', [
                'url' => $url,
                'error' => $e->getMessage(),
            ]);
            return ['valid' => false, 'errors' => [], 'engine_reachable' => false];
        }

        if (!$response->successful()) {
            Log::warning('Game engine validation request failed', [
                'url' => $url,
                'status' => $response->status(),
            ]);
            return [
                'valid' => false,
                'errors' => [],
                'engine_reachable' => false,
                'warning' => "AI validation service error (HTTP {$response->status()}); script saved as unvalidated",
            ];
        }

        $body = $response->json();
        if (!is_array($body)) {
            Log::warning('Game engine validation returned a non-JSON body', ['url' => $url]);
            return [
                'valid' => false,
                'errors' => [],
                'engine_reachable' => false,
                'warning' => 'AI validation service returned an invalid response; script saved as unvalidated',
            ];
        }

        return [
            'valid' => (bool) ($body['valid'] ?? false),
            'errors' => is_array($body['errors'] ?? null) ? $body['errors'] : [],
            'engine_reachable' => true,
        ];
    }

    /**
     * Adds the degradation warning when the engine could not produce a
     * validation result and there was code to validate.
     *
     * @param array<string, mixed> $payload
     * @param array{valid: bool, errors: array<int, array<string, mixed>>, engine_reachable: bool, warning?: string} $validation
     * @return array<string, mixed>
     */
    private function withWarning(array $payload, array $validation, string $code): array
    {
        if (!$validation['engine_reachable'] && trim($code) !== '') {
            $payload['warning'] = $validation['warning']
                ?? 'AI validation service unreachable; script saved as unvalidated';
        }

        return $payload;
    }
}
