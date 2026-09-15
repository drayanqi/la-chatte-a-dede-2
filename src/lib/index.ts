/**
 * Library exports
 * OWNER: Dev Team
 */

export * from './gameApiTypes';
export { apiFetch, ApiError, getApiError } from './apiClient';
export { formatTime } from './timeFormat';
export { isTypingContext } from './keyboard';
export { extractGoalTicks } from './score';
export {
  ensureGameApiJSDoc,
  hasGameApiJSDoc,
  GAME_API_JSDOC_LINE,
} from './gameScript';
export { generateGameApiDts, GAME_API_DTS } from './gameApiDts';
