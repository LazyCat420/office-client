/**
 * toolStationMap.js — Single source of truth for tool→station routing
 * and tool→animation variant mapping.
 *
 * /lego module: Shared by useAgentEvents.js (SSE path) and eventMapper.js (batch path).
 * This eliminates duplicate mapping logic and ensures all rooms get used.
 */

import { STATION_ANIM_VARIANTS } from '../animations';
// ══════════════════════════════════════════════════════
// TOOL → STATION — exact tool name to station ID
// ══════════════════════════════════════════════════════

export const TOOL_TO_STATION = {
  // ── Research Desk (data fetching, investigation, web research) ──
  get_market_data: 'research',
  get_finnhub_news: 'research',
  get_technical_indicators: 'research',
  get_finviz_fundamentals: 'research',
  get_polygon_price_history: 'research',
  get_sec_filings: 'research',
  get_options_flow: 'research',
  get_insider_trades: 'research',
  get_congress_trades: 'research',
  get_earnings_data: 'research',
  search_wiki: 'research',
  query_hermes: 'research',
  hermes_web_research: 'research',
  search_internal_database: 'research',
  search_trading_skills: 'research',
  request_investigation: 'research',
  check_open_investigations: 'research',
  youtube_test_channel: 'research',
  // Batch event tool names from eventMapper
  price_data: 'research',
  news_fetch: 'research',
  reddit_scan: 'research',
  youtube_scan: 'research',
  fundamentals: 'research',
  technicals: 'research',
  crypto_data: 'research',
  data_check: 'research',

  // ── Trading Floor / Desk (analysis, memory, LLM, settings) ──
  write_memory_note: 'desk',
  read_memory_note: 'desk',
  check_hallucination: 'desk',
  read_profile: 'desk',
  update_preference: 'desk',
  add_agent_note: 'desk',
  get_cycle_context: 'desk',
  get_cycle_context_all: 'desk',
  calculate_stop_loss: 'desk',
  calculate_position_size: 'desk',
  calculate_risk_reward: 'desk',
  calculate_portfolio_allocation: 'desk',
  'LLM thinking': 'desk',
  llm_analysis: 'desk',
  synthesis: 'desk',

  // ── Exec Office (trade execution, portfolio, watchlist) ──
  buy_stock: 'inbox',
  sell_stock: 'inbox',
  execute_momentum_strategy: 'inbox',
  execute_value_strategy: 'inbox',
  get_portfolio_state: 'inbox',
  get_position_pnl: 'inbox',
  get_performance_metrics: 'inbox',
  add_to_watchlist: 'inbox',
  remove_from_watchlist: 'inbox',
  trade_exec: 'inbox',

  // ── War Room (debate, audit, team coordination, governance) ──
  audit_decision_quality: 'debate',
  post_finding: 'debate',
  read_team_findings: 'debate',
  propose_constitution_amendment: 'debate',
  consensus: 'debate',
  debate: 'debate',

  // ── Tool Bench (utility, config, schedules, triggers) ──
  create_or_update_schedule: 'tool_bench',
  list_active_schedules: 'tool_bench',
  set_price_trigger: 'tool_bench',
  list_active_triggers: 'tool_bench',
  cancel_price_trigger: 'tool_bench',
  save_trading_chart: 'tool_bench',
  update_youtube_channel_handle: 'tool_bench',
};

// ══════════════════════════════════════════════════════
// KEYWORD FALLBACK CLASSIFIER — for unknown/new tools
// ══════════════════════════════════════════════════════

const KEYWORD_RULES = [
  { keywords: ['search', 'fetch', 'scrape', 'get_', 'read', 'scan', 'query', 'hermes', 'wiki', 'news', 'price', 'fundamental', 'technical', 'crypto', 'completeness', 'reddit', 'youtube'], station: 'research' },
  { keywords: ['think', 'calculate', 'memory', 'note', 'profile', 'hallucination', 'sleep', 'analy', 'synth', 'infer', 'llm', 'model', 'prompt', 'token', 'generate'], station: 'desk' },
  { keywords: ['consensus', 'debate', 'compare', 'vote', 'audit', 'finding', 'amendment', 'bull', 'bear', 'agree', 'disagree'], station: 'debate' },
  { keywords: ['trade', 'order', 'execute', 'buy', 'sell', 'inbox', 'envelope', 'portfolio', 'watchlist', 'decision', 'recommend', 'submit'], station: 'inbox' },
  { keywords: ['error', 'fail', 'crash', 'retry', 'timeout', 'exception'], station: 'error' },
  { keywords: ['tool', 'api', 'call', 'request', 'schedule', 'trigger', 'config'], station: 'tool_bench' },
];

/**
 * Classify a tool name to a station ID.
 * 1. Exact match from TOOL_TO_STATION
 * 2. Keyword fallback
 * 3. Default to 'tool_bench'
 */
export function classifyToolStation(toolName) {
  if (!toolName) return 'tool_bench';

  const lower = toolName.toLowerCase();
  if (lower.includes('janitor')) return 'janitor';

  // 1. Exact lookup
  if (TOOL_TO_STATION[toolName]) return TOOL_TO_STATION[toolName];

  // 2. Keyword fallback
  for (const { keywords, station } of KEYWORD_RULES) {
    if (keywords.some(kw => lower.includes(kw))) return station;
  }

  // 3. Default
  return 'tool_bench';
}

// ══════════════════════════════════════════════════════
// TOOL → ANIMATION VARIANT — maps tool to preferred anim
// ══════════════════════════════════════════════════════
// Variants per station:
//   research:    0=shuffling papers, 1=comparing charts, 2=flipping book, 3=scanning doc
//   desk:        0=yelling bid, 1=throwing tickets, 2=hand signals, 3=jumping, 4=DANCING
//   tool_bench:  0=hammering, 1=terminal, 2=levers
//   debate:      0=gesturing, 1=table slam, 2=pacing
//   inbox:       0=boss lean, 1=signing, 2=phone call
//   error:       0=panic, 1=stressed, 2=methodical
//   smoke_break: 0=relax, 1=pacing, 2=inspect, 3=leaning, 4=chatting

export const TOOL_TO_ANIM_VARIANT = {
  // ── Research Desk ──
  get_market_data: 1,            // comparing charts
  get_polygon_price_history: 1,  // comparing charts
  get_technical_indicators: 1,   // comparing charts
  get_finnhub_news: 0,           // shuffling papers (news articles)
  get_sec_filings: 2,            // flipping book (filings)
  get_earnings_data: 0,          // shuffling papers
  search_wiki: 3,                // scanning doc
  query_hermes: 3,               // scanning doc
  hermes_web_research: 3,        // scanning doc
  search_internal_database: 2,   // flipping book
  search_trading_skills: 2,      // flipping book
  get_finviz_fundamentals: 1,    // comparing charts
  get_options_flow: 1,           // comparing charts
  get_insider_trades: 0,         // shuffling papers
  get_congress_trades: 0,        // shuffling papers
  request_investigation: 3,      // scanning doc
  check_open_investigations: 3,  // scanning doc
  youtube_test_channel: 3,       // scanning doc
  price_data: 1,
  news_fetch: 0,
  reddit_scan: 3,
  youtube_scan: 3,
  fundamentals: 1,
  technicals: 1,
  crypto_data: 1,
  data_check: 2,

  // ── Trading Floor ──
  'LLM thinking': 4,             // DANCING (celebration on the floor!)
  llm_analysis: 2,               // hand signals
  synthesis: 4,                   // DANCING
  calculate_stop_loss: 0,        // yelling bid
  calculate_position_size: 0,    // yelling bid
  calculate_risk_reward: 0,      // yelling bid
  calculate_portfolio_allocation: 1, // throwing tickets
  write_memory_note: 3,          // jumping (excited to record)
  read_memory_note: 4,           // DANCING
  check_hallucination: 1,        // throwing tickets (checking work)
  read_profile: 4,               // DANCING
  update_preference: 3,          // jumping
  add_agent_note: 2,             // hand signals
  get_cycle_context: 4,          // DANCING
  get_cycle_context_all: 4,      // DANCING

  // ── Exec Office ──
  buy_stock: 1,                  // signing (executing order)
  sell_stock: 1,                 // signing
  execute_momentum_strategy: 1,  // signing
  execute_value_strategy: 1,     // signing
  get_portfolio_state: 0,        // boss lean (reviewing)
  get_position_pnl: 0,           // boss lean
  get_performance_metrics: 0,    // boss lean
  add_to_watchlist: 2,           // phone call
  remove_from_watchlist: 2,      // phone call
  trade_exec: 1,                 // signing

  // ── War Room ──
  audit_decision_quality: 1,     // table slam
  post_finding: 0,               // gesturing
  read_team_findings: 2,         // pacing
  propose_constitution_amendment: 1, // table slam
  consensus: 0,                  // gesturing
  debate: 1,                     // table slam

  // ── Tool Bench ──
  create_or_update_schedule: 1,  // terminal
  list_active_schedules: 1,      // terminal
  set_price_trigger: 2,          // levers
  list_active_triggers: 1,       // terminal
  cancel_price_trigger: 2,       // levers
  save_trading_chart: 0,         // hammering (building)
  update_youtube_channel_handle: 1, // terminal

  // ── Error / Risk Mgmt ──
  error: 0,                      // panic
};

// ══════════════════════════════════════════════════════
// EMOJI → ANIMATION VARIANT — maps specific emojis to anims
// ══════════════════════════════════════════════════════
export function getEmojiAnimVariant(emoji, station) {
  if (!emoji) return null;

  if (station === 'research') {
    // 0=shuffling papers, 1=comparing charts, 2=flipping book, 3=scanning doc, 4=whiteboard, 5=typing, 6=talking
    if (['🧹', '🗑️', '🧽'].includes(emoji)) return 0;
    if (['📊', '📈', '📉', '🪙', '💵', '💰', '💸'].includes(emoji)) return 1;
    if (['📚', '📖', '📒', '📰'].includes(emoji)) return 2;
    if (['🔍', '🔎', '🌐', '🕷️', '🕸️'].includes(emoji)) return 3;
    if (['📝', '✏️', '🖋️'].includes(emoji)) return 4;
    if (['💻', '⌨️'].includes(emoji)) return 5;
    if (['💬', '🗣️', '👥'].includes(emoji)) return 6;
  }

  if (station === 'desk') {
    // 0=yelling bid, 1=throwing tickets, 2=hand signals, 3=jumping, 4=DANCING
    if (['🧠', '⚙️', '🤖', '💭', '💡'].includes(emoji)) return 4; // LLM/DANCING
    if (['🗣️', '📢', '📣'].includes(emoji)) return 0; // yelling
    if (['📈', '📉'].includes(emoji)) return 1; // throwing tickets
    if (['👋', '🤝', '🙌'].includes(emoji)) return 2; // hand signals
    if (['🎉', '🚀', '🔥'].includes(emoji)) return 3; // jumping
  }

  if (station === 'debate') {
    // 0=gesturing, 1=table slam, 2=pacing
    if (['🤝', '🗣️', '💬', '💭', '⚖️'].includes(emoji)) return 0; // gesturing
    if (['💥', '👊', '🙅', '❌', '🚫'].includes(emoji)) return 1; // table slam
    if (['🤔', '🚶', '👣'].includes(emoji)) return 2; // pacing
  }

  if (station === 'inbox') {
    // 0=boss lean, 1=signing, 2=phone call
    if (['✉️', '📥', '📮', '🖋️', '✍️', '📄', '📝'].includes(emoji)) return 1; // signing
    if (['📞', '📱', '☎️'].includes(emoji)) return 2; // phone call
    if (['💼', '🏢', '👑', '👔'].includes(emoji)) return 0; // boss lean
  }

  if (station === 'janitor') {
    if (emoji === '🧹') return 0;
  }

  return null;
}

/**
 * Get the animation variant for a tool at a station.
 * Uses tool mapping as a BASE, then mixes in agentId so different agents
 * doing the same tool get different animations — variety on the floor!
 */
export function getToolAnimVariant(tool, agentId, station, toolEmoji) {
  const count = STATION_ANIM_VARIANTS[station] || 1;
  if (count <= 1) return 0;

  // Agent-specific hash for variety
  let agentHash = 0;
  const id = agentId || '';
  for (let i = 0; i < id.length; i++) {
    agentHash = id.charCodeAt(i) + ((agentHash << 5) - agentHash);
  }
  agentHash = Math.abs(agentHash);

  // 1. Try emoji variant first
  const emojiVariant = getEmojiAnimVariant(toolEmoji, station);
  if (emojiVariant !== null) {
    return emojiVariant % count;
  }

  // 2. If tool has a mapped variant, use it as a base offset
  if (tool && TOOL_TO_ANIM_VARIANT[tool] !== undefined) {
    const base = TOOL_TO_ANIM_VARIANT[tool];
    // Offset by agent hash so each agent gets a different variant
    return (base + agentHash) % count;
  }

  // Fallback: pure hash-based
  let hash = 0;
  const key = id + (station || '');
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % count;
}

// ══════════════════════════════════════════════════════
// COMPLETION REACTION VARIANTS — used when status='done'
// ══════════════════════════════════════════════════════
const COMPLETION_VARIANTS = {
  research: 4,    // whiteboard (reviewing findings)
  desk: 3,        // jumping (celebration)
  tool_bench: 1,  // terminal (verifying results)
  debate: 0,      // gesturing (wrapping up)
  inbox: 0,       // boss lean (satisfied)
  error: 2,       // methodical (issue resolved)
  smoke_break: 0, // relax
  lobby: 0,       // idle
};

/**
 * Get the animation variant to play when a tool completes at a station.
 */
export function getCompletionVariant(station) {
  return COMPLETION_VARIANTS[station] ?? 0;
}
