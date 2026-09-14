import ivm from 'isolated-vm';
import type { FastifyInstance } from 'fastify';
import { MEMORY_LIMIT_MB, SCRIPT_INIT_TIMEOUT_MS } from '../engine/constants.js';
import { extractErrorLine } from '../engine/IsolatedScriptRunner.js';
import {
  PREAMBLE_LINE_OFFSET,
  SCRIPT_PREAMBLE,
  SCRIPT_SHIM,
} from '../engine/contextBuilder.js';

export interface ScriptValidationIssue {
  message: string;
  line?: number;
}

export interface ScriptValidationResult {
  valid: boolean;
  errors: ScriptValidationIssue[];
}

export interface ValidateScriptBody {
  code: string;
  language: string;
}

/**
 * Validates user AI code by compiling and initializing it in a throwaway
 * isolate (backend-architecture.md "POST /validate-script"). A script is valid
 * when it compiles, its top level executes without error, and it defines an
 * `update` function.
 *
 * The compiled bundle is identical to the match runtime's (console preamble +
 * user code + shim), so validation accepts exactly what a match accepts —
 * e.g. a top-level `console.log` is a no-op here just as it is in a match.
 * Syntax error line numbers are corrected by PREAMBLE_LINE_OFFSET.
 */
export function validateScriptCode(
  code: string,
  language: string,
  options: { memoryLimitMb?: number; initTimeoutMs?: number } = {},
): ScriptValidationResult {
  if (language !== 'javascript') {
    return { valid: false, errors: [{ message: `unsupported language: ${language}` }] };
  }
  const isolate = new ivm.Isolate({ memoryLimit: options.memoryLimitMb ?? MEMORY_LIMIT_MB });
  try {
    const context = isolate.createContextSync();
    const bundle = `${SCRIPT_PREAMBLE}${code}${SCRIPT_SHIM}`;
    const compiled = isolate.compileScriptSync(bundle, { filename: 'player-script.js' });
    compiled.runSync(context, { timeout: options.initTimeoutMs ?? SCRIPT_INIT_TIMEOUT_MS });
    if (context.evalSync('typeof update') !== 'function') {
      return {
        valid: false,
        errors: [{ message: 'missing update function: define function update(game) { ... }' }],
      };
    }
    return { valid: true, errors: [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const line = extractErrorLine(err, PREAMBLE_LINE_OFFSET) ?? undefined;
    const issue: ScriptValidationIssue =
      line === undefined ? { message } : { message, line };
    return { valid: false, errors: [issue] };
  } finally {
    isolate.dispose();
  }
}

/**
 * Validates the POST /validate-script payload. Returns an empty array when the
 * payload is valid, otherwise the problems found.
 */
export function validateScriptPayload(body: unknown): string[] {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return ['body must be a JSON object'];
  }
  const b = body as Record<string, unknown>;
  const errors: string[] = [];
  if (typeof b.code !== 'string') {
    errors.push('code must be a string');
  }
  if (b.language !== undefined && typeof b.language !== 'string') {
    errors.push('language must be a string');
  }
  return errors;
}

export async function validateRoutes(app: FastifyInstance): Promise<void> {
  app.post('/validate-script', async (request, reply) => {
    const validationErrors = validateScriptPayload(request.body);
    if (validationErrors.length > 0) {
      return reply.code(422).send({ success: false, error: validationErrors.join('; ') });
    }
    const { code, language } = request.body as ValidateScriptBody;
    const result = validateScriptCode(code, language ?? 'javascript');
    return result;
  });
}
