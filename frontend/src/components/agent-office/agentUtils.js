/**
 * agentUtils.js
 * 
 * Shared utility functions for agent identification, home stations,
 * and station mapping. Shared by both 2D and 3D office implementations.
 */

// Agents that are chat/endpoint artifacts — not real pipeline agents
export const NON_PIPELINE_AGENTS = new Set([
  'prism-agent', 'prism_agent', 'prism',
  'local-agent', 'local_agent', 'local',
  'user_chat', 'unknown', 'system',
]);

/**
 * Normalizes and cleans raw agent names into standardized IDs.
 */
export function cleanAgentId(agentName) {
  if (!agentName) return null;
  const lower = agentName.toLowerCase().trim();
  if (NON_PIPELINE_AGENTS.has(lower)) return null;

  const clean = agentName.replace(/^CUSTOM_/, '');

  if (clean === 'SYSTEM_JANITOR_AGENT' || clean === 'DATA_JANITOR_AGENT' || clean === 'DATA_JANITOR_CRITIC_AGENT' || clean.toLowerCase().includes('janitor')) {
    return 'DATA_JANITOR';
  }
  if (clean === 'PRE_TRADE_AGENT') return 'PRE_TRADE_RISK';
  
  const cleanLower = clean.toLowerCase();
  if (cleanLower.includes('bullish') || cleanLower.includes('bull_')) return 'BULLISH_DEBATER';
  if (cleanLower.includes('bearish') || cleanLower.includes('bear_')) return 'BEARISH_DEBATER';
  
  if (cleanLower.includes('worker_')) {
    const match = clean.match(/(.*)_worker_(\d+)/i);
    if (match) {
      return `${match[1].toUpperCase()}_worker_${match[2]}`;
    }
  }
  
  return clean;
}

/**
 * Returns the home station/room for a given agent ID.
 * Supports is3D flag because 3D office has a dedicated 'janitor' station,
 * while 2D office places janitors at the 'tool_bench'.
 */
export function getHomeStation(agentId, is3D = false) {
  const idLower = (agentId || '').toLowerCase();
  if (idLower.includes('debate') || idLower.includes('debater') || idLower.includes('bull_') || idLower.includes('bear_')) {
    return 'debate'; // War Room
  }
  if (idLower.includes('risk') || idLower.includes('pre_trade')) {
    return 'error'; // Risk Management
  }
  if (idLower.includes('janitor') || idLower.includes('purge')) {
    return is3D ? 'janitor' : 'tool_bench'; // Janitors belong at Janitor Station (3D) or Tool Bench (2D)
  }
  if (idLower.includes('allocator') || idLower.includes('executor') || idLower.includes('trade_agent')) {
    return 'inbox'; // Exec Office
  }
  if (idLower.includes('research') || idLower.includes('quant') || idLower.includes('technical') || idLower.includes('analysis')) {
    return 'research'; // Research Desk
  }
  return null;
}

/**
 * Resolves the station for an agent or tool.
 */
export function getStationForAgentOrTool(agentId, toolName, classifyToolFn, is3D = false) {
  const home = getHomeStation(agentId, is3D);
  if (home) return home;
  return classifyToolFn(toolName);
}
