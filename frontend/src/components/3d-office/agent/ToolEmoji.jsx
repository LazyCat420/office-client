import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSpring, animated } from '@react-spring/three';
import { Html } from '@react-three/drei';

// ── Emoji lookup table ──
const EMOJI_MAP = {
  heartbeat: '💓', started: '🚀', completed: '✅', progress: '🔄',
  envelope: '✉️', search: '🔍', fetch: '📥', scrape: '🕷️',
  read: '📖', scan: '📡', think: '🧠', calculate: '🧮',
  debate: '🗣️', consensus: '🤝', vote: '🗳️', trade: '📈',
  order: '📝', execute: '⚡', error: '❌', fail: '💥',
  lobby: '🚪', 'smoke break': '🚬', 'idle wander': '🚶',
  llm: '🧠', gpt: '🧠', claude: '🧠', gemini: '🧠',
  price: '💰', news: '📰', reddit: '🤖', youtube: '📺',
  fundamental: '📊', technical: '📉', crypto: '🪙',
  analysis: '🔬', synthesis: '🧪', data: '📁',
  curation: '📋', config: '⚙️', escalation: '🔺', glance: '👁️',
  // Direct tool name mappings from tool_schemas.json
  get_market_data: '📊📈', get_finnhub_news: '📰🗞️',
  get_technical_indicators: '📉📐', get_finviz_fundamentals: '📋🏢',
  get_polygon_price_history: '📈💹', get_sec_filings: '📄🏛️',
  get_options_flow: '🔀💸', get_insider_trades: '🕵️‍♂️💰',
  get_congress_trades: '🏛️💸', get_earnings_data: '💰📅',
  search_wiki: '📖🔍', query_hermes: '🔍🤖', hermes_web_research: '🌐🤖',
  search_internal_database: '🗄️🔍', search_trading_skills: '📚🧠',
  write_memory_note: '✏️🧠', read_memory_note: '📝🧠',
  check_hallucination: '🔬🤖', audit_decision_quality: '🔎⚖️',
  buy_stock: '🟢💹', sell_stock: '🔴💹',
  execute_momentum_strategy: '🚀📈', execute_value_strategy: '💎📉',
  calculate_stop_loss: '🛑📉', calculate_position_size: '📐💰',
  calculate_risk_reward: '⚖️🎯', calculate_portfolio_allocation: '🧮💼',
  get_portfolio_state: '💼📊', get_position_pnl: '💵📈',
  get_performance_metrics: '📊🎯', set_price_trigger: '🔔🎯',
  post_finding: '📤📝', read_team_findings: '📥👥',
  request_investigation: '🔍🕵️‍♂️', check_open_investigations: '📋🕵️‍♂️',
  read_profile: '👤⚙️', update_preference: '⚙️📝',
  add_agent_note: '🗒️✍️', add_to_watchlist: '👁️📝',
  remove_from_watchlist: '❌🗑️', propose_constitution_amendment: '📜✍️',
  get_cycle_context: '🔄🧠', get_cycle_context_all: '🔄🌐',
  save_trading_chart: '📊💾', youtube_test_channel: '📺🧪',
  'LLM thinking': '🧠⚙️',
};

function getBestEmoji(toolName, toolEmoji) {
  if (toolEmoji && typeof toolEmoji === 'string' && toolEmoji.length <= 8 && !/^[a-zA-Z0-9_]+$/.test(toolEmoji)) {
    return toolEmoji;
  }
  const name = (toolName || toolEmoji || '').toLowerCase();
  if (!name) return '🔧';
  if (EMOJI_MAP[toolName]) return EMOJI_MAP[toolName];
  if (EMOJI_MAP[name]) return EMOJI_MAP[name];
  for (const [key, value] of Object.entries(EMOJI_MAP)) {
    if (name.includes(key)) return value;
  }
  return '🔧';
}

function isImageUrl(str) {
  return typeof str === 'string' && (str.startsWith('http://') || str.startsWith('https://'));
}

/**
 * ToolEmoji — small floating badge above the dancing agent's head.
 * Shows the tool emoji/image in a circular badge that bobs gently.
 * The agent body stays visible and dances — this is just a small indicator.
 */
export function ToolEmoji({ toolEmoji, toolName, visible, agentColor }) {
  const badgeRef = useRef();
  const color = agentColor || '#6366f1';

  const emoji = useMemo(() => {
    if (isImageUrl(toolEmoji)) return null;
    return getBestEmoji(toolName, toolEmoji);
  }, [toolEmoji, toolName]);

  const imageUrl = useMemo(() => isImageUrl(toolEmoji) ? toolEmoji : null, [toolEmoji]);

  const { scale } = useSpring({
    scale: visible ? 1 : 0,
    config: { mass: 1, tension: 280, friction: 18 },
  });

  useFrame((state) => {
    if (!badgeRef.current || !visible) return;
    const t = state.clock.getElapsedTime();
    // Gentle float bob above the agent's head
    badgeRef.current.position.y = 1.35 + Math.sin(t * 2.5) * 0.06;
  });

  if (!visible) return null;

  return (
    <animated.group scale={scale} ref={badgeRef} position={[0, 1.35, 0]}>
      {/* Small floating emoji badge via HTML — guaranteed to render */}
      <Html
        center
        style={{ pointerEvents: 'none' }}
        zIndexRange={[0, 0]}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${color}44, ${color}22)`,
          border: `1.5px solid ${color}88`,
          boxShadow: `0 2px 8px ${color}33, 0 0 12px ${color}22`,
          backdropFilter: 'blur(4px)',
        }}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={toolName || 'tool'}
              style={{ width: '18px', height: '18px', borderRadius: '3px', objectFit: 'contain' }}
              crossOrigin="anonymous"
            />
          ) : (
            <span style={{ fontSize: '14px', lineHeight: 1, userSelect: 'none' }}>
              {emoji || '🔧'}
            </span>
          )}
        </div>
      </Html>
    </animated.group>
  );
}
