'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cleanAgentId } from './routing';
import { canonicalAgentId } from '../agent-office/shared';
import { ttsEventEmitter } from '../agent-office/ttsClient';

// Normalize any agent spelling (v3_quant_analyst, CUSTOM_V3_QUANT_ANALYST,
// V3_QUANT_ANALYST…) to one comparable key so per-agent filtering can do an
// exact match instead of fuzzy contains-checks.
function normalizeForMatch(id) {
  if (!id) return null;
  const cleaned = cleanAgentId(id);
  if (!cleaned) return null;
  return canonicalAgentId(cleaned).replace(/^V3_/, '');
}

// Maps frontend cleaned agent IDs (from useAgentEvents' cleanAgentId) back to Prism custom agent IDs.
// These must match the actual agent IDs stored in Prism conversations' settings.agent field.
// Verified by querying: curl -s 'http://10.0.0.16:7777/conversations?limit=200&type=agent'
// Actual Prism conversation agent IDs (as of 2026-06-09):
//   CUSTOM_MARKET_ALPHA (58), CUSTOM_TRADING_CYCLE_ANALYSIS_AGENT (49),
//   CUSTOM_SYSTEM_JANITOR_AGENT (40), CUSTOM_BULLISH_DEBATER (13),
//   CUSTOM_POST_CYCLE_LEARNER_AGENT (9), CUSTOM_MACRO_RISK_AGENT (9),
//   CUSTOM_FUNDAMENTAL_AGENT (9), CUSTOM_SENTIMENT_AGENT (9),
//   CUSTOM_META_AUDIT_AGENT (2), CUSTOM_QUANT_RESEARCH_AGENT (2)
const MARKDOWN_PUNCT_RE = /[*_\x60~#]/g;
const MCP_PREFIX_RE = /^mcp__lazy-(agent|tool)-service__/;

const PRISM_DIRECT_AGENT_MAP = {
  system: 'CUSTOM_SYSTEM_JANITOR_AGENT',
  janitor: 'CUSTOM_SYSTEM_JANITOR_AGENT',
  data_janitor: 'CUSTOM_SYSTEM_JANITOR_AGENT',
  quant: 'CUSTOM_QUANT_RESEARCH_AGENT',
  quant_research_agent: 'CUSTOM_QUANT_RESEARCH_AGENT',
  technical: 'CUSTOM_TECHNICAL_ANALYSIS_AGENT',
  agent: 'CUSTOM_AGENT_ARCHITECT',
  agent_architect: 'CUSTOM_AGENT_ARCHITECT',
  pre_trade_risk: 'CUSTOM_PRE_TRADE_AGENT',
  pre_trade: 'CUSTOM_PRE_TRADE_AGENT',
  bullish_debater: 'CUSTOM_BULLISH_DEBATER',
  bearish_debater: 'CUSTOM_BULLISH_DEBATER',
  retriever: 'CUSTOM_RETRIEVER_AGENT',
  verifier: 'CUSTOM_VERIFIER_AGENT',
  synthesizer: 'CUSTOM_SYNTHESIZER_AGENT',
  meta_audit: 'CUSTOM_META_AUDIT_AGENT',
  portfolio_allocator: 'CUSTOM_TRADING_CYCLE_ANALYSIS_AGENT',
};

const PRISM_FUZZY_PATTERNS = [
  { keywords: ['janitor', 'maintenance'], id: 'CUSTOM_SYSTEM_JANITOR_AGENT' },
  { keywords: ['research', 'quant'], id: 'CUSTOM_QUANT_RESEARCH_AGENT' },
  { keywords: ['technical'], id: 'CUSTOM_TECHNICAL_ANALYSIS_AGENT' },
  { keywords: ['architect'], id: 'CUSTOM_AGENT_ARCHITECT' },
  { keywords: ['budget'], id: 'CUSTOM_AGENT_BUDGET_MANAGER' },
  { keywords: ['debate', 'debater', 'bull', 'bear'], id: 'CUSTOM_BULLISH_DEBATER' },
  { keywords: ['retriever'], id: 'CUSTOM_RETRIEVER_AGENT' },
  { keywords: ['verifier'], id: 'CUSTOM_VERIFIER_AGENT' },
  { keywords: ['synthesizer'], id: 'CUSTOM_SYNTHESIZER_AGENT' },
  { keywords: ['pre_trade', 'risk'], id: 'CUSTOM_PRE_TRADE_AGENT' },
  { keywords: ['meta_audit'], id: 'CUSTOM_META_AUDIT_AGENT' },
  { keywords: ['fundamental'], id: 'CUSTOM_FUNDAMENTAL_AGENT' },
  { keywords: ['sentiment'], id: 'CUSTOM_SENTIMENT_AGENT' },
  { keywords: ['macro'], id: 'CUSTOM_MACRO_RISK_AGENT' },
  { keywords: ['learner', 'post_cycle'], id: 'CUSTOM_POST_CYCLE_LEARNER_AGENT' },
  { keywords: ['trading_cycle', 'analysis'], id: 'CUSTOM_TRADING_CYCLE_ANALYSIS_AGENT' },
];

function matchFuzzyPrismAgent(name, baseName) {
  for (const rule of PRISM_FUZZY_PATTERNS) {
    if (rule.keywords.some(kw => name.includes(kw) || baseName.includes(kw))) {
      return rule.id;
    }
  }
  return null;
}

function normalizeCustomSlug(agentName) {
  if (agentName.startsWith('CUSTOM_')) return agentName.toUpperCase();
  let slug = agentName.toUpperCase().replace(/ /g, '_').replace(/-/g, '_').replace(/_+$/, '').replace(/^_+/, '');
  while (slug.includes('__')) {
    slug = slug.replace(/__/g, '_');
  }
  return `CUSTOM_${slug}`;
}

function resolvePrismAgentId(agentName) {
  if (!agentName) return 'CUSTOM_MARKET_ALPHA';
  const name = agentName.toLowerCase();
  const workerMatch = name.match(/^(.+?)_worker_\d+$/);
  const baseName = workerMatch ? workerMatch[1] : name;

  if (baseName.startsWith('v3_')) {
    return `CUSTOM_${baseName.toUpperCase()}`;
  }
  if (PRISM_DIRECT_AGENT_MAP[name]) return PRISM_DIRECT_AGENT_MAP[name];
  if (PRISM_DIRECT_AGENT_MAP[baseName]) return PRISM_DIRECT_AGENT_MAP[baseName];

  const fuzzy = matchFuzzyPrismAgent(name, baseName);
  if (fuzzy) return fuzzy;

  return normalizeCustomSlug(agentName);
}

function appendDedupedLogEntry(prevLogs, entry, rawQuote) {
  const cleanQuote = (rawQuote || '').replace(MARKDOWN_PUNCT_RE, '');
  if (cleanQuote.length > 3 && prevLogs.some(l => l.text.includes(cleanQuote))) {
    return prevLogs;
  }
  return [...prevLogs, entry];
}

function classifyPipelineStepLog(phase, step, status, body, elapsed) {
  if (status === 'error' || phase === 'error') {
    return { text: `❌ ${step}: ${body === step ? '' : body}${elapsed}`, type: 'error' };
  }
  if (step.includes('llm_') || step.includes('LLM')) {
    return { text: `🧠 ${body}${elapsed}`, type: 'thinking' };
  }
  if (step.includes('debate') || phase === 'consensus') {
    return { text: `⚔️ ${body}${elapsed}`, type: 'info' };
  }
  if (phase === 'trading' || step.includes('trade')) {
    return { text: `💰 ${body}${elapsed}`, type: 'success' };
  }
  return { text: `📋 ${body}${elapsed}`, type: 'info' };
}

function formatPipelineEventLog(data) {
  const phase = data.phase || '';
  const step = data.step || '';
  const detail = data.detail || '';
  const status = data.status || 'ok';
  const elapsed = data.elapsed_ms ? ` (${(data.elapsed_ms / 1000).toFixed(1)}s)` : '';

  if (step.includes('PRISM_AGENT_START')) {
    return { text: `🧠 Agent started: ${data.agent || step}`, type: 'thinking' };
  }
  if (step.includes('PRISM_AGENT_END') || step.includes('LOCAL_AGENT_END')) {
    return { text: `✅ Agent completed${elapsed}`, type: 'success' };
  }
  if (status === 'error' || phase === 'error') {
    return { text: `❌ ${step}: ${detail}${elapsed}`, type: 'error' };
  }
  return classifyPipelineStepLog(phase, step, status, detail || step, elapsed);
}

function matchesPrismWebhookAgent(data, agentId, requireAgent = false) {
  const rawAgent = data.agent || (data.requestPayload && data.requestPayload.agent);
  if (!rawAgent) return !requireAgent;
  const parsedAgentId = cleanAgentId(rawAgent);
  return Boolean(parsedAgentId && parsedAgentId.toLowerCase() === agentId.toLowerCase());
}

function formatRequestCreatedLog(data) {
  const isSuccess = data.success !== false;
  const totalT = (data.inputTokens || 0) + (data.outputTokens || 0);
  const duration = data.totalTime ? `${data.totalTime.toFixed(1)}s` : '';
  const stats = totalT > 0 ? ` (${totalT} tokens${duration ? ` in ${duration}` : ''})` : '';
  return {
    text: isSuccess ? `📤 Request completed successfully${stats}` : '⚠️ Request completed with issues',
    type: isSuccess ? 'success' : 'warn',
    result: data.responsePayload?.text || null,
  };
}

function formatPrismWebhookLog(eventType, data, agentId) {
  if (eventType === 'request.tool_call.started') {
    if (!matchesPrismWebhookAgent(data, agentId)) return null;
    const cleanTool = (data.toolName || 'unknown').replace(MCP_PREFIX_RE, '');
    return { text: `🔧 Starting tool: ${cleanTool}`, type: 'tool-start', args: data.toolArgs || null };
  }
  if (eventType === 'request.tool_call.completed') {
    if (!matchesPrismWebhookAgent(data, agentId)) return null;
    const cleanTool = (data.toolName || 'unknown').replace(MCP_PREFIX_RE, '');
    const isError = data.status === 'error';
    return {
      text: isError ? `❌ Tool failed: ${cleanTool}` : `✅ Tool completed: ${cleanTool}`,
      type: isError ? 'error' : 'tool-success',
      result: data.toolResult || null,
    };
  }
  if (eventType === 'generation.started') {
    if (!matchesPrismWebhookAgent(data, agentId)) return null;
    return { text: '🧠 LLM generating response / thinking...', type: 'thinking' };
  }
  if (eventType === 'generation.completed') {
    if (!matchesPrismWebhookAgent(data, agentId, true)) return null;
    return { text: '✨ LLM generation completed', type: 'success' };
  }
  if (eventType === 'request.created') {
    if (!matchesPrismWebhookAgent(data, agentId)) return null;
    return formatRequestCreatedLog(data);
  }
  return null;
}

function isTargetAgentEvent(data, agentId) {
  const eventAgent = data.agent || data.agent_id || null;
  if (!eventAgent) return true;
  const evNorm = normalizeForMatch(eventAgent);
  const targetNorm = normalizeForMatch(agentId);
  return !(evNorm && targetNorm && evNorm !== targetNorm);
}

function parseSseLogPayload(event, agentId) {
  if (!event || event.type === 'connected' || !event.data) return null;
  const { eventType, data } = event;
  if (!isTargetAgentEvent(data, agentId)) return null;

  let formatted = null;
  if (eventType === 'agent_voice') {
    const cleanQuote = (data.quote || '').replace(MARKDOWN_PUNCT_RE, '');
    const tickerStr = data.ticker ? ` (${data.ticker})` : '';
    formatted = { text: `🗣️ Speaks${tickerStr}: "${cleanQuote}"`, type: 'info' };
  } else if (eventType === 'pipeline.event') {
    formatted = formatPipelineEventLog(data);
  } else {
    formatted = formatPrismWebhookLog(eventType, data, agentId);
  }
  if (!formatted || !formatted.text) return null;

  return {
    entry: {
      id: `${eventType}-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString(),
      type: formatted.type || 'info',
      text: formatted.text,
      args: formatted.args || null,
      result: formatted.result || null,
    },
    quote: data.quote,
  };
}

function extractThinking(msg) {
  let thinking = msg.thinking || '';
  let content = msg.content || '';
  if (content.includes('<think>')) {
    const match = content.match(/<think>([\s\S]*?)<\/think>/);
    if (match) {
      thinking = match[1].trim();
      content = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
    }
  }
  return { thinking, content };
}

function parseTitle(title) {
  if (!title) return { ticker: '', cycle: '' };
  const parts = title.split(' · ');
  return {
    ticker: parts[1] || 'GENERAL',
    cycle: parts[2] || 'SYSTEM',
  };
}

async function fetchPrismConversationsForAgent(agentId) {
  const resolved = resolvePrismAgentId(agentId);
  const agentIds = Array.isArray(resolved) ? resolved : [resolved];
  const fetchPromises = agentIds.map(async (id) => {
    try {
      const res = await fetch(`/prism-api/conversations?agent=${encodeURIComponent(id)}&limit=100&type=agent`, {
        headers: { 'x-project': 'vllm-trading-bot', 'x-username': 'lazy-trader' },
      });
      if (res.ok) {
        const data = await res.json();
        return data.items || [];
      }
    } catch (err) {
      console.error(`Error fetching conversation history for ${id}:`, err);
    }
    return [];
  });
  const results = await Promise.all(fetchPromises);
  return results.flat().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function SidebarLiveLogsTab({ logs, isRunning, logsEndRef }) {
  return (
    <div className="agent-sidebar__console">
      <div className="agent-sidebar__console-header">
        <span className="status">● {isRunning ? 'ONLINE' : 'IDLE'}</span>
        <span className="desc">tool execution log</span>
      </div>
      <div className="agent-sidebar__console-body">
        {logs.map((log) => (
          <div key={log.id} className={`agent-sidebar__console-line log-${log.type}`} style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '4px' }}>
            <div>
              <span className="timestamp">[{log.timestamp}]</span>
              <span className="text">{log.text}</span>
            </div>
            {log.args && Object.keys(log.args).length > 0 && (
              <details className="agent-sidebar__tool-details" style={{ margin: '4px 0 0 16px' }}>
                <summary className="agent-sidebar__tool-summary" style={{ padding: '4px 8px', fontSize: '0.7rem', color: '#94a3b8' }}>
                  Arguments
                </summary>
                <div className="agent-sidebar__tool-result" style={{ padding: '6px' }}>
                  <pre style={{ margin: 0, fontSize: '0.68rem', color: '#cbd5e1' }}>
                    {JSON.stringify(log.args, null, 2)}
                  </pre>
                </div>
              </details>
            )}
            {log.result && (
              <details className="agent-sidebar__tool-details" style={{ margin: '4px 0 0 16px' }}>
                <summary className="agent-sidebar__tool-summary" style={{ padding: '4px 8px', fontSize: '0.7rem', color: '#94a3b8' }}>
                  Result
                </summary>
                <div className="agent-sidebar__tool-result" style={{ padding: '6px' }}>
                  <pre style={{ margin: 0, fontSize: '0.68rem', color: '#cbd5e1' }}>
                    {typeof log.result === 'object' ? JSON.stringify(log.result, null, 2) : String(log.result)}
                  </pre>
                </div>
              </details>
            )}
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}

function SystemPromptMessageItem({ msg, showSystemPrompt, setShowSystemPrompt }) {
  return (
    <div className="agent-sidebar__message message-system">
      <button
        className="agent-sidebar__system-prompt-toggle"
        onClick={() => setShowSystemPrompt(!showSystemPrompt)}
      >
        ⚙️ System Prompt Configuration {showSystemPrompt ? '▼' : '▶'}
      </button>
      {showSystemPrompt && (
        <div className="agent-sidebar__system-prompt-container" style={{ position: 'relative' }}>
          <pre className="agent-sidebar__system-prompt-content">
            {msg.content}
          </pre>
          <button
            style={{
              marginTop: '8px',
              padding: '6px 12px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onClick={(e) => {
              const improvePrompt = `Please act as an expert system architect and prompt engineer. Take the following system prompt and improve it. Make it more detailed, technical, robust, and aligned with best practices for an autonomous AI agent.\n\nHere is the prompt:\n\n${msg.content}`;
              navigator.clipboard.writeText(improvePrompt);
              const btn = e.currentTarget;
              const originalText = btn.innerHTML;
              btn.innerHTML = '✅ Copied for Minimax!';
              setTimeout(() => { btn.innerHTML = originalText; }, 2000);
            }}
          >
            ✨ Improve with Minimax (Copy)
          </button>
        </div>
      )}
    </div>
  );
}

function ToolMessageItem({ msg }) {
  const cleanToolName = (msg.name || 'unknown_tool').replace(MCP_PREFIX_RE, '');
  const formattedContent = typeof msg.content === 'object' ? JSON.stringify(msg.content, null, 2) : String(msg.content);
  return (
    <div className="agent-sidebar__message message-tool">
      <details className="agent-sidebar__tool-details">
        <summary className="agent-sidebar__tool-summary">
          <span className="icon">🔧</span>
          <span className="label">Tool Result:</span>
          <span className="name">{cleanToolName}</span>
        </summary>
        <div className="agent-sidebar__tool-result">
          <pre>{formattedContent}</pre>
        </div>
      </details>
    </div>
  );
}

function RegularMessageItem({ msg, isLast, agentId, agentColor }) {
  const { thinking, content } = extractThinking(msg);
  const isAssistant = msg.role === 'assistant';
  return (
    <div
      className={`agent-sidebar__message ${isAssistant ? 'message-assistant' : 'message-user'}`}
      style={isAssistant ? { borderLeftColor: agentColor } : {}}
    >
      <div className="sender-tag">
        {isAssistant ? agentId.toUpperCase() : 'USER'}
      </div>
      {thinking && (
        <details className="agent-sidebar__thinking-details" open={isLast}>
          <summary className="agent-sidebar__thinking-summary">
            🧠 Reasoning Process
          </summary>
          <div className="agent-sidebar__thinking-content">
            {thinking}
          </div>
        </details>
      )}
      {content && (
        <div className="message-content">
          {content}
        </div>
      )}
      {msg.toolCalls && msg.toolCalls.map((tc, tcIdx) => {
        const cleanTcName = tc.name.replace(MCP_PREFIX_RE, '');
        return (
          <div key={`tc-${tcIdx}`} className="agent-sidebar__tool-call">
            <span className="icon">⚙️</span>
            <span className="label">Requesting tool:</span>
            <span className="name">{cleanTcName}</span>
            {tc.args && (
              <pre className="args">
                {typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args, null, 2)}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ConversationMessageItem({ msg, index, totalCount, agentId, agentColor, showSystemPrompt, setShowSystemPrompt }) {
  if (msg.role === 'system') {
    return <SystemPromptMessageItem msg={msg} showSystemPrompt={showSystemPrompt} setShowSystemPrompt={setShowSystemPrompt} />;
  }
  if (msg.role === 'tool') {
    return <ToolMessageItem msg={msg} />;
  }
  return (
    <RegularMessageItem
      msg={msg}
      isLast={index === totalCount - 1}
      agentId={agentId}
      agentColor={agentColor}
    />
  );
}

function SidebarHistoryTab({
  agentId,
  agentColor,
  isLoadingHistory,
  conversations,
  selectedConvId,
  setSelectedConvId,
  isLoadingMessages,
  convMessages,
  showSystemPrompt,
  setShowSystemPrompt,
}) {
  if (isLoadingHistory) {
    return (
      <div className="agent-sidebar__history">
        <div className="agent-sidebar__loader">
          <span className="spinner"></span> Loading session records...
        </div>
      </div>
    );
  }
  if (conversations.length === 0) {
    return (
      <div className="agent-sidebar__history">
        <div className="agent-sidebar__empty">
          No past chat history found for {agentId}.
        </div>
      </div>
    );
  }

  return (
    <div className="agent-sidebar__history">
      <div className="agent-sidebar__history-selector">
        <label htmlFor="cycle-select">Session / Cycle:</label>
        <select
          id="cycle-select"
          value={selectedConvId || ''}
          onChange={(e) => setSelectedConvId(e.target.value)}
          className="agent-sidebar__select"
        >
          {conversations.map(c => {
            const { ticker, cycle } = parseTitle(c.title);
            const formattedDate = new Date(c.updatedAt).toLocaleString(undefined, {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });
            return (
              <option key={c.id} value={c.id}>
                {ticker} ({cycle}) — {formattedDate}
              </option>
            );
          })}
        </select>
      </div>
      <div className="agent-sidebar__messages">
        {isLoadingMessages ? (
          <div className="agent-sidebar__loader">
            <span className="spinner"></span> Fetching conversation data...
          </div>
        ) : convMessages.length === 0 ? (
          <div className="agent-sidebar__empty">
            No messages in this conversation.
          </div>
        ) : (
          convMessages.map((msg, index) => (
            <ConversationMessageItem
              key={`msg-${index}`}
              msg={msg}
              index={index}
              totalCount={convMessages.length}
              agentId={agentId}
              agentColor={agentColor}
              showSystemPrompt={showSystemPrompt}
              setShowSystemPrompt={setShowSystemPrompt}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function AgentDetailsSidebar({ agentId, agentColor, onClose, isRunning }) {
  const [activeTab, setActiveTab] = useState('logs');
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);

  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [convMessages, setConvMessages] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);

  useEffect(() => {
    if (logsEndRef.current && logsEndRef.current.parentElement) {
      const parent = logsEndRef.current.parentElement;
      parent.scrollTo({ top: parent.scrollHeight, behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    if (activeTab !== 'logs' || !agentId) return;

    setLogs([{
      id: 'init',
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `Listening to pipeline events for ${agentId}...`,
    }]);

    const handleSpeechEvent = (e) => {
      const { agentId: spokenAgentId, quote, timestamp, ttsEngine } = e.detail;
      const targetCleaned = cleanAgentId(agentId);
      const spokenCleaned = cleanAgentId(spokenAgentId);
      if (!targetCleaned || !spokenCleaned || targetCleaned.toLowerCase() !== spokenCleaned.toLowerCase()) return;

      const cleanQuote = quote.replace(MARKDOWN_PUNCT_RE, '');
      const entry = {
        id: `tts-${Date.now()}-${Math.random()}`,
        timestamp,
        type: 'info',
        text: `🗣️ [${ttsEngine}] Speaks: "${cleanQuote}"`,
      };
      setLogs(prev => appendDedupedLogEntry(prev, entry, cleanQuote));
    };

    ttsEventEmitter.addEventListener('speech', handleSpeechEvent);

    const url = `/api/v1/agent-logs/stream?agent=${encodeURIComponent(agentId)}`;
    let es = null;
    try {
      es = new EventSource(url);
      es.onmessage = (e) => {
        try {
          const parsed = parseSseLogPayload(JSON.parse(e.data), agentId);
          if (parsed) {
            setLogs(prev => appendDedupedLogEntry(prev, parsed.entry, parsed.quote));
          }
        } catch (err) {
          console.error('Error parsing SSE event in sidebar:', err);
        }
      };
    } catch (err) {
      console.error('Failed to create EventSource in sidebar:', err);
    }

    return () => {
      ttsEventEmitter.removeEventListener('speech', handleSpeechEvent);
      if (es) es.close();
    };
  }, [activeTab, agentId]);

  useEffect(() => {
    if (activeTab !== 'history' || !agentId) return;

    async function fetchHistory() {
      setIsLoadingHistory(true);
      setConversations([]);
      setSelectedConvId(null);
      setConvMessages([]);
      try {
        const sorted = await fetchPrismConversationsForAgent(agentId);
        setConversations(sorted);
        if (sorted.length > 0) {
          setSelectedConvId(sorted[0].id);
        }
      } catch (err) {
        console.error('Error fetching conversation history:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    }

    fetchHistory();
  }, [activeTab, agentId]);

  useEffect(() => {
    if (activeTab !== 'history' || !selectedConvId) return;

    async function fetchMessages() {
      setIsLoadingMessages(true);
      setConvMessages([]);
      try {
        const res = await fetch(`/prism-api/conversations/${selectedConvId}`, {
          headers: { 'x-project': 'vllm-trading-bot', 'x-username': 'lazy-trader' },
        });
        if (res.ok) {
          const data = await res.json();
          setConvMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Error fetching conversation details:', err);
      } finally {
        setIsLoadingMessages(false);
      }
    }

    fetchMessages();
  }, [activeTab, selectedConvId]);

  return (
    <div className="agent-sidebar">
      <div className="agent-sidebar__header">
        <div className="agent-sidebar__header-info">
          <span className="agent-sidebar__status-badge" style={{ backgroundColor: agentColor }}></span>
          <span className="agent-sidebar__title">{agentId} details</span>
        </div>
        <button className="agent-sidebar__close" onClick={onClose} aria-label="Close panel">✕</button>
      </div>

      <div className="agent-sidebar__tabs">
        <button
          className={`agent-sidebar__tab ${activeTab === 'logs' ? 'agent-sidebar__tab--active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          Live Logs
          {isRunning && <span className="agent-sidebar__live-pulse"></span>}
        </button>
        <button
          className={`agent-sidebar__tab ${activeTab === 'history' ? 'agent-sidebar__tab--active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Chat History
        </button>
      </div>

      <div className="agent-sidebar__content">
        {activeTab === 'logs' ? (
          <SidebarLiveLogsTab logs={logs} isRunning={isRunning} logsEndRef={logsEndRef} />
        ) : (
          <SidebarHistoryTab
            agentId={agentId}
            agentColor={agentColor}
            isLoadingHistory={isLoadingHistory}
            conversations={conversations}
            selectedConvId={selectedConvId}
            setSelectedConvId={setSelectedConvId}
            isLoadingMessages={isLoadingMessages}
            convMessages={convMessages}
            showSystemPrompt={showSystemPrompt}
            setShowSystemPrompt={setShowSystemPrompt}
          />
        )}
      </div>
    </div>
  );
}
