/**
 * prismEventMapper.js
 *
 * Translates raw Prism webhook SSE events into office-scene events.
 *
 * Prism's WebhookEventBus emits events with shape:
 *   { webhookEventId, webhookTimestamp, eventType, data }
 *
 * where eventType is one of:
 *   - generation.started   — LLM call begins
 *   - generation.completed — LLM call ends
 *   - request.tool_call.started   — tool execution begins
 *   - request.tool_call.completed — tool execution ends
 *   - request.created             — full request logged
 *
 * This mapper produces office events with shape:
 *   { type, agentId, station, tool, toolEmoji, label, status, ts }
 *
 * /lego module: Consumed by useAgentEvents.js to drive the 3D office scene.
 */

import { cleanAgentId, getStationForAgentOrTool } from './agentUtils';

/**
 * Resolve the Prism `agent` field into a cleaned office agent ID.
 * Prism agents use names like "QUANT", "PM", "OmniAgent", "FUNDAMENTAL",
 * or custom agent IDs from the AgentPersonaRegistry.
 *
 * Returns null for non-pipeline agents (those are filtered by cleanAgentId).
 */
function resolvePrismAgentId(data) {
  // Prefer explicit agent field
  const rawAgent = data.agent || data.agentId || null;
  if (rawAgent) {
    const cleaned = cleanAgentId(rawAgent);
    if (cleaned) return cleaned;
  }

  // Fallback: try to extract from conversationId or model context
  // For now, use a generic "PRISM_AGENT" when no agent name is available
  if (data.model || data.provider) {
    return 'PRISM_AGENT';
  }

  return null;
}

/**
 * Map a single Prism webhook event to an array of office events.
 *
 * @param {object} event — Raw Prism webhook event { eventType, data, ... }
 * @param {function} classifyToolStationFn — Function to classify tool→station
 * @returns {object[]} — Array of office events (may be empty)
 */
export function mapPrismEvent(event, classifyToolStationFn) {
  if (!event || !event.eventType) return [];

  const data = event.data || {};
  const ts = event.webhookTimestamp
    ? Date.parse(event.webhookTimestamp)
    : Date.now();

  switch (event.eventType) {
    // ── LLM generation started ──
    case 'generation.started': {
      const agentId = resolvePrismAgentId(data);
      if (!agentId) return [];

      const isGraphExploration = agentId.toLowerCase().includes('_tot') || agentId.toLowerCase().includes('_got');
      const toolLabel = isGraphExploration ? 'exploring graph' : 'LLM thinking';
      const animLabel = isGraphExploration ? `${agentId} exploring graph...` : `${agentId} thinking...`;
      
      // Agent walks to their thinking station (desk = Trading Floor)
      const station = getStationForAgentOrTool(agentId, toolLabel, classifyToolStationFn, true);

      return [{
        type: `${station}_start`,
        agentId,
        station,
        tool: toolLabel,
        toolEmoji: isGraphExploration ? '🌳' : '🧠',
        label: animLabel,
        status: 'start',
        ts,
        meta: {
          source: 'prism',
          eventType: event.eventType,
          model: data.model,
          provider: data.provider,
          conversationId: data.conversationId,
          agentSessionId: data.agentSessionId,
        },
      }];
    }

    // ── LLM generation completed ──
    case 'generation.completed': {
      // Try to resolve agent — newer Prism builds include agent info.
      // If no agent can be resolved, skip (the tool_call.completed events
      // will provide the done transitions instead).
      const agentId = resolvePrismAgentId(data);
      if (!agentId) return [];

      const station = getStationForAgentOrTool(agentId, 'LLM thinking', classifyToolStationFn, true);
      return [{
        type: `${station}_progress`,
        agentId,
        station,
        tool: 'LLM thinking',
        toolEmoji: '🧠',
        label: `${agentId} finished thinking`,
        status: 'progress',
        ts,
        meta: {
          source: 'prism',
          eventType: event.eventType,
          model: data.model,
          provider: data.provider,
          conversationId: data.conversationId,
        },
      }];
    }

    // ── Tool call started ──
    case 'request.tool_call.started': {
      const agentId = resolvePrismAgentId(data);
      if (!agentId) return [];

      const isGraphExploration = agentId.toLowerCase().includes('_tot') || agentId.toLowerCase().includes('_got');
      // For ToT/GoT agents, we ignore intermediate tool execution spam so they stay in 'exploring graph' state
      if (isGraphExploration) {
        return [];
      }

      const toolName = data.toolName || 'unknown';
      const toolEmoji = data.toolEmoji || null;

      // Classify which room/station this tool belongs in
      const station = getStationForAgentOrTool(agentId, toolName, classifyToolStationFn, true);

      return [{
        type: `${station}_start`,
        agentId,
        station,
        tool: toolName,
        toolEmoji,
        label: `${agentId} executing ${toolName}`,
        status: 'start',
        ts,
        meta: {
          source: 'prism',
          eventType: event.eventType,
          toolCallId: data.toolCallId,
          toolArgs: data.toolArgs,
          iteration: data.iteration,
          model: data.model,
          provider: data.provider,
          conversationId: data.conversationId,
          agentSessionId: data.agentSessionId,
        },
      }];
    }

    // ── Tool call completed ──
    case 'request.tool_call.completed': {
      const agentId = resolvePrismAgentId(data);
      if (!agentId) return [];

      const isGraphExploration = agentId.toLowerCase().includes('_tot') || agentId.toLowerCase().includes('_got');
      // For ToT/GoT agents, we ignore intermediate tool execution spam
      if (isGraphExploration) {
        return [];
      }

      const toolName = data.toolName || 'unknown';
      const toolEmoji = data.toolEmoji || null;
      const isError = data.status === 'error';

      // Stay at the same station — just update bubble
      const station = getStationForAgentOrTool(agentId, toolName, classifyToolStationFn, true);
      const status = isError ? 'error' : 'done';

      return [{
        type: `${station}_${status}`,
        agentId,
        station,
        tool: toolName,
        toolEmoji,
        label: isError
          ? `${agentId} failed ${toolName}`
          : `${agentId} completed ${toolName}`,
        status,
        ts,
        meta: {
          source: 'prism',
          eventType: event.eventType,
          toolCallId: data.toolCallId,
          durationMs: data.durationMs,
          model: data.model,
          provider: data.provider,
          conversationId: data.conversationId,
          agentSessionId: data.agentSessionId,
        },
      }];
    }

    // ── Request created (full request logged) ──
    case 'request.created': {
      const agentId = resolvePrismAgentId(data);
      if (!agentId) return [];

      // Brief progress update — agent is active at desk
      const station = getStationForAgentOrTool(agentId, null, classifyToolStationFn, true);

      return [{
        type: `${station}_progress`,
        agentId,
        station,
        tool: data.operation || 'processing',
        toolEmoji: null,
        label: `${agentId} ${data.operation || 'processing'}`,
        status: 'progress',
        ts,
        meta: {
          source: 'prism',
          eventType: event.eventType,
          model: data.model,
          provider: data.provider,
          conversationId: data.conversationId,
        },
      }];
    }

    default:
      return [];
  }
}

/**
 * Check if a parsed SSE data object is a Prism webhook event.
 * Prism events always have an `eventType` field and usually a
 * `webhookEventId` field.
 */
export function isPrismWebhookEvent(data) {
  return !!(data && data.eventType);
}
