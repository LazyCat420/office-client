/**
 * eventMapper.js
 * 
 * Translates raw backend pipeline events into office-scene events.
 * The backend emits events with shape:
 *   { ts, phase, step, detail, status, data, elapsed_ms }
 * 
 * This mapper produces office events with shape:
 *   { type, agentId, station, tool, label, status, startedAt, finishedAt, meta }
 */

// ── Station classification by phase + step keywords ──

const PHASE_TO_STATION = {
  // Collection phases → Research Desk
  collecting: 'research',
  collecting_data: 'research',
  data_collection: 'research',
  scraping: 'research',
  // Analysis phases → Trading Floor
  analyzing: 'desk',
  analysis: 'desk',
  llm: 'desk',
  inference: 'desk',
  synthesis: 'desk',
  // Trade execution → Exec Office
  trading: 'inbox',
  trade: 'inbox',
  traded: 'inbox',
  // Debate/consensus → War Room
  consensus: 'debate',
  debate: 'debate',
  compare: 'debate',
  gated: 'debate',
  // Post-cycle → Exec Office
  persisted: 'inbox',
  evaluated: 'inbox',
  closed: 'inbox',
  done: 'inbox',
  // Lifecycle → Lobby
  queued: 'lobby',
  started: 'lobby',
  stopped: 'lobby',
  paused: 'lobby',
  resumed: 'lobby',
  // Maintenance → Tool Bench
  purge: 'tool_bench',
  utility: 'tool_bench',
  // Error
  error: 'error',
};

const STEP_KEYWORDS_TO_STATION = [
  // Most specific first
  { keywords: ['fundamental', 'technical', 'price', 'crypto', 'news', 'reddit', 'youtube', 'completeness', 'scrape', 'fetch', 'search'], station: 'research' },
  { keywords: ['janitor', 'purge', 'cleanup', 'tool', 'api'], station: 'tool_bench' },
  { keywords: ['debate', 'consensus', 'compare', 'vote', 'bull', 'bear'], station: 'debate' },
  { keywords: ['trade', 'order', 'execute', 'decision', 'recommend', 'envelope'], station: 'inbox' },
  { keywords: ['risk', 'veto', 'pre_trade'], station: 'error' },
  // Generic fallback — lowest priority
  { keywords: ['analy', 'synth', 'infer', 'llm', 'model', 'prompt', 'generate'], station: 'desk' },
  { keywords: ['error', 'fail', 'retry', 'timeout'], station: 'error' },
];

const VALID_STATIONS = new Set(['research', 'desk', 'debate', 'inbox', 'error', 'lobby', 'tool_bench']);

function classifyStation(phase, step, detail, data_type, room) {
  // 0. Explicit backend room override (highest trust)
  if (room && VALID_STATIONS.has(room)) return room;
  
  // 1. Structured data_type label (second highest trust)
  if (data_type) {
    const DATA_TYPE_TO_STATION = {
      price_data: 'research', fundamental_data: 'research',
      technical_data: 'research', crypto_data: 'research',
      news_data: 'research', reddit_data: 'research',
      youtube_data: 'research',
      llm_analysis: 'desk', synthesis: 'desk', inference: 'desk',
      debate: 'debate', consensus: 'debate', compare: 'debate',
      trade_execution: 'inbox', order: 'inbox', decision: 'inbox',
      risk_check: 'error', pre_trade_veto: 'error',
      cleanup: 'tool_bench', janitor: 'tool_bench', purge: 'tool_bench',
    };
    if (DATA_TYPE_TO_STATION[data_type]) return DATA_TYPE_TO_STATION[data_type];
  }

  // 2. Try step + detail keywords first to get precise room routing
  const combined = `${step || ''} ${detail || ''}`.toLowerCase();
  for (const { keywords, station } of STEP_KEYWORDS_TO_STATION) {
    if (keywords.some(kw => combined.includes(kw))) return station;
  }

  // 3. Fall back to phase-based routing if no keyword matches
  const phaseLower = (phase || '').toLowerCase();
  for (const [key, station] of Object.entries(PHASE_TO_STATION)) {
    if (phaseLower.includes(key)) return station;
  }

  return 'tool_bench'; // default
}

// ── Agent ID extraction ──
// Extract a ticker symbol from backend event fields.
// Backend emits steps like "yfinance_NVDA", "agents_AAPL", "rlm_config_c_TSLA"
// and details like "NVDA: 180 prices, 5 fundamentals..."
// Helper to extract the ticker context from backend events
function extractTicker(event) {
  const { step, detail, data } = event;
  if (data?.ticker) return data.ticker;
  if (step) {
    const parts = step.split('_');
    const last = parts[parts.length - 1];
    if (last && /^[A-Z]{1,5}$/.test(last)) return last;
  }
  if (detail) {
    const detailMatch = detail.match(/^([A-Z]{1,5})[:\s]/);
    if (detailMatch) return detailMatch[1];
  }
  return '';
}

function extractAgentId(event) {
  // Prism-sourced events have structured category/action
  const source = event.source || event.meta?.source;
  const category = event.category || event.meta?.category;
  if (source === 'prism' && category) {
    return category.toUpperCase().replace(/-/g, '_');
  }

  const ticker = extractTicker(event);
  const station = classifyStation(
    event.phase,
    event.step,
    event.detail,
    event.data?.data_type || event.data_type,
    event.data?.room || event.room
  );
  
  const stepLower = (event.step || '').toLowerCase();
  const detailLower = (event.detail || '').toLowerCase();
  const phaseLower = (event.phase || '').toLowerCase();
  
  // 1. Janitor / Cleanup tasks
  if (
    stepLower.includes('janitor') ||
    detailLower.includes('janitor') ||
    phaseLower.includes('janitor') ||
    stepLower.includes('purge') ||
    detailLower.includes('purge')
  ) {
    return 'DATA_JANITOR';
  }
  
  // 2. Risk Management
  if (
    stepLower.includes('risk') ||
    detailLower.includes('risk') ||
    stepLower.includes('veto') ||
    detailLower.includes('veto') ||
    stepLower.includes('pre_trade') ||
    detailLower.includes('pre_trade')
  ) {
    // Distinguish between pre-trade risk and macro risk
    if (stepLower.includes('macro') || detailLower.includes('macro')) {
      return 'MACRO_RISK_AGENT';
    }
    return 'PRE_TRADE_RISK';
  }
  
  // 3. Portfolio Allocator
  if (
    stepLower.includes('allocator') ||
    detailLower.includes('allocator') ||
    stepLower.includes('allocation') ||
    detailLower.includes('allocation')
  ) {
    return 'PORTFOLIO_ALLOCATOR';
  }
  
  // 4. Debate / Consensus
  if (station === 'debate') {
    if (stepLower.includes('bear') || detailLower.includes('bear') || phaseLower.includes('bear')) {
      return 'BEARISH_DEBATER';
    }
    return 'BULLISH_DEBATER'; // advocate gets mapped to BEARISH_DEBATER/BULLISH_DEBATER via mapEvent below
  }
  
  // 5. Dynamic Agent Name Matching (for standard pipeline agents)
  const knownAgents = [
    'cycle_trading_analyst',
    'fundamental_agent',
    'sentiment_agent',
    'trading_cycle_analysis_agent',
    'technical_analysis_agent',
    'market_alpha',
    'retriever_agent',
    'verifier_agent',
    'synthesizer_agent',
    'meta_audit_agent'
  ];

  for (const name of knownAgents) {
    if (stepLower.includes(name) || detailLower.includes(name) || phaseLower.includes(name)) {
      return name.toUpperCase();
    }
  }

  // 6. Generic regex for any custom "_agent" or "_analyst"
  const agentMatch = stepLower.match(/([a-z0-9_]+_(?:agent|analyst))/);
  if (agentMatch) {
    return agentMatch[1].toUpperCase();
  }

  const detailMatch = detailLower.match(/([a-z0-9_]+_(?:agent|analyst))/);
  if (detailMatch) {
    return detailMatch[1].toUpperCase();
  }
  
  // 7. Research Desk (Data collection / workers)
  if (station === 'research' && ticker) {
    let hash = 0;
    for (let i = 0; i < ticker.length; i++) {
      hash += ticker.charCodeAt(i);
    }
    const workerId = (hash % 2) + 1;
    return `QUANT_RESEARCH_AGENT_worker_${workerId}`;
  }
  
  // 8. Default to QUANT_RESEARCH_AGENT
  return 'QUANT_RESEARCH_AGENT';
}

// ── Tool name extraction ──
function extractToolName(event) {
  const { step, detail } = event;
  const stepLower = (step || '').toLowerCase();
  
  if (stepLower.includes('price')) return 'price_data';
  if (stepLower.includes('news')) return 'news_fetch';
  if (stepLower.includes('reddit')) return 'reddit_scan';
  if (stepLower.includes('youtube')) return 'youtube_scan';
  if (stepLower.includes('fundamental')) return 'fundamentals';
  if (stepLower.includes('technical')) return 'technicals';
  if (stepLower.includes('crypto')) return 'crypto_data';
  if (stepLower.includes('completeness')) return 'data_check';
  if (stepLower.includes('analy')) return 'llm_analysis';
  if (stepLower.includes('synth')) return 'synthesis';
  if (stepLower.includes('consensus')) return 'consensus';
  if (stepLower.includes('debate')) return 'debate';
  if (stepLower.includes('trade')) return 'trade_exec';
  
  return step || 'unknown';
}

// ── Status mapping ──
function mapStatus(backendStatus) {
  switch (backendStatus) {
    case 'ok': return 'done';
    case 'error': return 'error';
    case 'running': return 'start';
    case 'skipped': return 'done';
    case 'info': return 'progress';
    default: return 'progress';
  }
}

/**
 * Map a single backend event to office event(s).
 * Returns an ARRAY — debate events produce 2 events (primary + advocate).
 */
export function mapEvent(event) {
  if (!event || event.step === 'heartbeat') {
    return [];
  }
  const station = classifyStation(
    event.phase,
    event.step,
    event.detail,
    event.data?.data_type || event.data_type,
    event.data?.room || event.room
  );
  const agentId = extractAgentId(event);
  const tool = extractToolName(event);
  const status = mapStatus(event.status);

  const primary = {
    type: `${station}_${status}`,
    agentId,
    station,
    tool,
    label: event.detail || event.step || '',
    status,
    startedAt: status === 'start' ? Date.parse(event.ts) : null,
    finishedAt: status === 'done' ? Date.parse(event.ts) : null,
    ts: Date.parse(event.ts) || Date.now(),
    meta: {
      phase: event.phase,
      step: event.step,
      elapsed_ms: event.elapsed_ms,
      data: event.data,
      rawStatus: event.status,
      source: event.source || event.meta?.source,
      category: event.category || event.meta?.category,
    },
  };

  // Debate events spawn a synthetic devil's advocate agent
  if (station === 'debate') {
    let advocateId = `${agentId}_adv`;
    if (agentId === 'BULLISH_DEBATER') advocateId = 'BEARISH_DEBATER';
    else if (agentId === 'BEARISH_DEBATER') advocateId = 'BULLISH_DEBATER';
    else if (agentId === 'system') advocateId = 'advocate';

    const advocate = {
      ...primary,
      agentId: advocateId,
      tool: tool === 'consensus' ? '🐻 COUNTER' : tool,
      label: `${advocateId}: counter-argument`,
    };
    return [primary, advocate];
  }

  return [primary];
}

/**
 * Map an entire array of backend events to office events,
 * producing a deduplicated set of active agents and their current states.
 */
export function mapAllEvents(events) {
  if (!events || !events.length) return { officeEvents: [], agents: {} };

  const officeEvents = events.flatMap(mapEvent);
  
  // Build agent state map (last known state per agent)
  const agents = {};
  for (const ev of officeEvents) {
    if (!agents[ev.agentId]) {
      agents[ev.agentId] = {
        id: ev.agentId,
        station: 'lobby',
        tool: null,
        label: '',
        status: 'idle',
        history: [],
      };
    }
    
    const agent = agents[ev.agentId];
    agent.station = ev.station;
    agent.tool = ev.tool;
    agent.label = ev.label;
    agent.status = ev.status;
    agent.lastTs = ev.ts;
    
    // Keep last 5 actions in history
    agent.history.push({ tool: ev.tool, station: ev.station, status: ev.status, ts: ev.ts });
    if (agent.history.length > 5) agent.history.shift();
  }

  return { officeEvents, agents };
}

/**
 * Given the full agent map, determine which agents are "active"
 * (had an event in the last N seconds).
 */
export function getActiveAgents(agents, windowMs = 60000) {
  const now = Date.now();
  const active = {};
  for (const [id, agent] of Object.entries(agents)) {
    const lastTime = agent.lastActionTime || agent.lastTs;
    if (lastTime && (now - lastTime) < windowMs) {
      active[id] = agent;
    }
  }
  return active;
}

export function getStationForTool(toolName) {
  const toolLower = (toolName || '').toLowerCase();
  if (
    toolLower.includes('search') ||
    toolLower.includes('fetch') ||
    toolLower.includes('scrape') ||
    toolLower.includes('read') ||
    toolLower.includes('get_') ||
    toolLower.includes('scan') ||
    toolLower.includes('wikipedia') ||
    toolLower.includes('pypi') ||
    toolLower.includes('arxiv')
  ) {
    return 'research';
  }
  if (
    toolLower.includes('think') ||
    toolLower.includes('sleep') ||
    toolLower.includes('calculate')
  ) {
    return 'desk';
  }
  if (
    toolLower.includes('consensus') ||
    toolLower.includes('debate') ||
    toolLower.includes('compare') ||
    toolLower.includes('vote')
  ) {
    return 'debate';
  }
  if (
    toolLower.includes('trade') ||
    toolLower.includes('order') ||
    toolLower.includes('execute') ||
    toolLower.includes('inbox') ||
    toolLower.includes('envelope')
  ) {
    return 'inbox';
  }
  if (toolLower.includes('error') || toolLower.includes('fail') || toolLower.includes('crash')) {
    return 'error';
  }
  return 'tool_bench';
}
