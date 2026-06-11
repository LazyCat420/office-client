/**
 * shared/index.js — Barrel export for utilities shared between 2D and 3D office.
 *
 * Both the legacy 2D AgentOffice (agent-office/) and the active 3D AgentOffice3D
 * (3d-office/) depend on the same core modules for agent identification, event
 * mapping, and voice synthesis. This barrel provides a single import point so
 * downstream consumers don't need to know individual file paths.
 *
 * Usage:
 *   import { cleanAgentId, triggerAgentSpeech, mapEvent } from '../agent-office/shared';
 */

// ── Agent identification and station routing ──
export {
  cleanAgentId,
  getHomeStation,
  getStationForAgentOrTool,
  NON_PIPELINE_AGENTS,
} from '../agentUtils';

// ── Voice Constants ──
export {
  resolveArchetype,
  getFallbackQuote,
} from '../voiceConstants';

// ── Audio Context Management ──
export {
  isAudioEnabled,
} from '../audioContextManager';

// ── TTS Client ──
export {
  triggerAgentSpeech,
  computeVolume,
  getVoiceForAgent,
} from '../ttsClient';

// ── Backend event → office event mapping ──
export {
  mapEvent,
  mapAllEvents,
  getActiveAgents,
  getStationForTool,
} from '../eventMapper';

// ── Prism webhook event → office event mapping ──
export {
  mapPrismEvent,
  isPrismWebhookEvent,
} from '../prismEventMapper';

