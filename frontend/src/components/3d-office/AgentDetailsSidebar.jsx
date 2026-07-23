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
function resolvePrismAgentId(agentName) {
  if (!agentName) return 'CUSTOM_MARKET_ALPHA';
  const name = agentName.toLowerCase();
  
  // Strip worker sub-IDs (e.g. QUANT_RESEARCH_AGENT_worker_1 → quant_research_agent)
  // Prism only knows about parent agents, not frontend-created worker sub-IDs.
  const workerMatch = name.match(/^(.+?)_worker_\d+$/);
  const baseName = workerMatch ? workerMatch[1] : name;

  // V3 pipeline agents register in Prism as CUSTOM_<OFFICE_ID> verbatim
  // (verified live 2026-07-22: CUSTOM_V3_QUANT_ANALYST, CUSTOM_V3_JUNIOR_ANALYST,
  // CUSTOM_V3_DECISION_SYNTHESIZER, …). Resolve them BEFORE the fuzzy rules
  // below, which used to misroute e.g. V3_QUANT_ANALYST into the legacy
  // CUSTOM_QUANT_RESEARCH_AGENT bucket — a big cause of "every agent shows
  // the same chat history".
  if (baseName.startsWith('v3_')) {
    return `CUSTOM_${baseName.toUpperCase()}`;
  }

  // Map cleaned IDs back to ACTUAL Prism conversation agent IDs
  // These IDs were verified by querying the live Prism API
  const AGENT_MAP = {
    // Janitor variants → single Prism agent
    'system': 'CUSTOM_SYSTEM_JANITOR_AGENT',
    'janitor': 'CUSTOM_SYSTEM_JANITOR_AGENT',
    'data_janitor': 'CUSTOM_SYSTEM_JANITOR_AGENT',
    // Quant research
    'quant': 'CUSTOM_QUANT_RESEARCH_AGENT',
    'quant_research_agent': 'CUSTOM_QUANT_RESEARCH_AGENT',
    // Technical analysis
    'technical': 'CUSTOM_TECHNICAL_ANALYSIS_AGENT',
    'technical_analysis_agent': 'CUSTOM_TECHNICAL_ANALYSIS_AGENT',
    // Agent architect
    'agent': 'CUSTOM_AGENT_ARCHITECT',
    'agent_architect': 'CUSTOM_AGENT_ARCHITECT',
    // Pre-trade / risk
    'pre_trade_risk': 'CUSTOM_PRE_TRADE_AGENT',
    'pre_trade': 'CUSTOM_PRE_TRADE_AGENT',
    // Debate — ALL debate conversations in Prism use CUSTOM_BULLISH_DEBATER (single bucket)
    'bullish_debater': 'CUSTOM_BULLISH_DEBATER',
    'bearish_debater': 'CUSTOM_BULLISH_DEBATER',
    // Market alpha
    'market_alpha': 'CUSTOM_MARKET_ALPHA',
    // Specialist agents
    'retriever': 'CUSTOM_RETRIEVER_AGENT',
    'retriever_agent': 'CUSTOM_RETRIEVER_AGENT',
    'verifier': 'CUSTOM_VERIFIER_AGENT',
    'verifier_agent': 'CUSTOM_VERIFIER_AGENT',
    'synthesizer': 'CUSTOM_SYNTHESIZER_AGENT',
    'synthesizer_agent': 'CUSTOM_SYNTHESIZER_AGENT',
    'meta_audit': 'CUSTOM_META_AUDIT_AGENT',
    'meta_audit_agent': 'CUSTOM_META_AUDIT_AGENT',
    // Agents that have conversations in Prism but were previously missing
    'trading_cycle_analysis_agent': 'CUSTOM_TRADING_CYCLE_ANALYSIS_AGENT',
    'fundamental_agent': 'CUSTOM_FUNDAMENTAL_AGENT',
    'sentiment_agent': 'CUSTOM_SENTIMENT_AGENT',
    'macro_risk_agent': 'CUSTOM_MACRO_RISK_AGENT',
    'post_cycle_learner_agent': 'CUSTOM_POST_CYCLE_LEARNER_AGENT',
    'portfolio_allocator': 'CUSTOM_TRADING_CYCLE_ANALYSIS_AGENT',
  };

  // Try direct match with full name first, then base name (without worker suffix)
  if (AGENT_MAP[name]) return AGENT_MAP[name];
  if (AGENT_MAP[baseName]) return AGENT_MAP[baseName];

  // Fuzzy matching for partial names
  if (name.includes('janitor') || name.includes('maintenance') || baseName.includes('janitor')) {
    return 'CUSTOM_SYSTEM_JANITOR_AGENT';
  }
  if (name.includes('research') || name.includes('quant') || baseName.includes('quant')) {
    return 'CUSTOM_QUANT_RESEARCH_AGENT';
  }
  if (name.includes('technical')) {
    return 'CUSTOM_TECHNICAL_ANALYSIS_AGENT';
  }
  if (name.includes('architect')) {
    return 'CUSTOM_AGENT_ARCHITECT';
  }
  if (name.includes('budget')) {
    return 'CUSTOM_AGENT_BUDGET_MANAGER';
  }
  if (name.includes('debate') || name.includes('debater') || name.includes('bull') || name.includes('bear')) {
    return 'CUSTOM_BULLISH_DEBATER';
  }
  if (name.includes('retriever')) {
    return 'CUSTOM_RETRIEVER_AGENT';
  }
  if (name.includes('verifier')) {
    return 'CUSTOM_VERIFIER_AGENT';
  }
  if (name.includes('synthesizer')) {
    return 'CUSTOM_SYNTHESIZER_AGENT';
  }
  if (name.includes('pre_trade') || name.includes('risk')) {
    return 'CUSTOM_PRE_TRADE_AGENT';
  }
  if (name.includes('meta_audit')) {
    return 'CUSTOM_META_AUDIT_AGENT';
  }
  if (name.includes('fundamental')) {
    return 'CUSTOM_FUNDAMENTAL_AGENT';
  }
  if (name.includes('sentiment')) {
    return 'CUSTOM_SENTIMENT_AGENT';
  }
  if (name.includes('macro')) {
    return 'CUSTOM_MACRO_RISK_AGENT';
  }
  if (name.includes('learner') || name.includes('post_cycle')) {
    return 'CUSTOM_POST_CYCLE_LEARNER_AGENT';
  }
  if (name.includes('trading_cycle') || name.includes('analysis')) {
    return 'CUSTOM_TRADING_CYCLE_ANALYSIS_AGENT';
  }
  
  if (agentName.startsWith('CUSTOM_')) return agentName.toUpperCase();
  
  let slug = agentName.toUpperCase().replace(/ /g, '_').replace(/-/g, '_').replace(/_+$/, '').replace(/^_+/, '');
  while (slug.includes('__')) {
    slug = slug.replace(/__/g, '_');
  }
  return `CUSTOM_${slug}`;
}



export function AgentDetailsSidebar({ agentId, agentColor, onClose, isRunning }) {
  const [activeTab, setActiveTab] = useState('logs'); // 'logs' or 'history'
  
  // Real-time Logs state
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);

  // Chat History state
  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [convMessages, setConvMessages] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current && logsEndRef.current.parentElement) {
      const parent = logsEndRef.current.parentElement;
      parent.scrollTo({ top: parent.scrollHeight, behavior: 'smooth' });
    }
  }, [logs]);

  // Real-time Logs EventSource Stream and local TTS listener
  useEffect(() => {
    if (activeTab !== 'logs' || !agentId) return;

    setLogs([{
      id: 'init',
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      text: `Listening to pipeline events for ${agentId}...`
    }]);

    const handleSpeechEvent = (e) => {
      const { agentId: spokenAgentId, quote, timestamp, ttsEngine } = e.detail;
      const targetCleaned = cleanAgentId(agentId);
      const spokenCleaned = cleanAgentId(spokenAgentId);

      if (targetCleaned && spokenCleaned && targetCleaned.toLowerCase() === spokenCleaned.toLowerCase()) {
        const cleanQuote = quote.replace(/[*_`~#]/g, '');
        const text = `🗣️ [${ttsEngine}] Speaks: "${cleanQuote}"`;
        
        setLogs(prev => {
          // Deduplicate to prevent double-logs from local TTS vs backend SSE
          const isDuplicate = cleanQuote.length > 3 && prev.some(l => l.text.includes(cleanQuote));
          if (isDuplicate) return prev;

          return [...prev, {
            id: `tts-${Date.now()}-${Math.random()}`,
            timestamp,
            type: 'info',
            text
          }];
        });
      }
    };

    ttsEventEmitter.addEventListener('speech', handleSpeechEvent);

    // Use our own backend SSE endpoint that polls trading-service pipeline events.
    // The old /api/v1/prism/stream proxied to Prism's webhook stream which emits zero events.
    const url = `/api/v1/agent-logs/stream?agent=${encodeURIComponent(agentId)}`;
    let es = null;
    try {
      es = new EventSource(url);
      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.type === 'connected') return;

          const { eventType, data } = event;
          if (!data) return;

          // Defense-in-depth: the server stream filters per-agent, but any
          // event that names a DIFFERENT agent must never render here. Events
          // with no agent identity are trusted to the server's filter.
          const eventAgent = data.agent || data.agent_id || null;
          if (eventAgent) {
            const evNorm = normalizeForMatch(eventAgent);
            const targetNorm = normalizeForMatch(agentId);
            if (evNorm && targetNorm && evNorm !== targetNorm) return;
          }

          const timestamp = new Date().toLocaleTimeString();
          let text = '';
          let type = 'info';
          let args = null;
          let result = null;

          if (eventType === 'agent_voice') {
            const cleanQuote = (data.quote || '').replace(/[*_`~#]/g, '');
            const agentName = data.agent || 'Agent';
            const cleanName = cleanAgentId(agentName) || agentName;
            const tickerStr = data.ticker ? ` (${data.ticker})` : '';
            text = `🗣️ Speaks${tickerStr}: "${cleanQuote}"`;
            type = 'info';
          }
          // Handle pipeline events from our backend SSE
          else if (eventType === 'pipeline.event') {
            const phase = data.phase || '';
            const step = data.step || '';
            const detail = data.detail || '';
            const status = data.status || 'ok';
            const elapsed = data.elapsed_ms ? ` (${(data.elapsed_ms / 1000).toFixed(1)}s)` : '';

            // Format based on phase/step
            if (step.includes('PRISM_AGENT_START')) {
              text = `🧠 Agent started: ${data.agent || step}`;
              type = 'thinking';
            } else if (step.includes('PRISM_AGENT_END') || step.includes('LOCAL_AGENT_END')) {
              text = `✅ Agent completed${elapsed}`;
              type = 'success';
            } else if (status === 'error' || phase === 'error') {
              text = `❌ ${step}: ${detail}${elapsed}`;
              type = 'error';
            } else if (step.includes('llm_') || step.includes('LLM')) {
              text = `🧠 ${detail || step}${elapsed}`;
              type = 'thinking';
            } else if (step.includes('debate') || phase === 'consensus') {
              text = `⚔️ ${detail || step}${elapsed}`;
              type = 'info';
            } else if (phase === 'trading' || step.includes('trade')) {
              text = `💰 ${detail || step}${elapsed}`;
              type = 'success';
            } else {
              text = `📋 ${detail || step}${elapsed}`;
              type = 'info';
            }
          }
          // Handle Prism webhook events (backward compat if stream ever starts working)
          else if (eventType === 'request.tool_call.started') {
            const rawAgent = data.agent || (data.requestPayload && data.requestPayload.agent);
            if (rawAgent) {
              const parsedAgentId = cleanAgentId(rawAgent);
              if (!parsedAgentId || parsedAgentId.toLowerCase() !== agentId.toLowerCase()) return;
            }
            const tool = data.toolName || 'unknown';
            const cleanTool = tool.replace('mcp__lazy-tool-service__', '');
            text = `🔧 Starting tool: ${cleanTool}`;
            type = 'tool-start';
            args = data.toolArgs || null;
          } else if (eventType === 'request.tool_call.completed') {
            const rawAgent = data.agent || (data.requestPayload && data.requestPayload.agent);
            if (rawAgent) {
              const parsedAgentId = cleanAgentId(rawAgent);
              if (!parsedAgentId || parsedAgentId.toLowerCase() !== agentId.toLowerCase()) return;
            }
            const tool = data.toolName || 'unknown';
            const cleanTool = tool.replace('mcp__lazy-tool-service__', '');
            const isError = data.status === 'error';
            text = isError ? `❌ Tool failed: ${cleanTool}` : `✅ Tool completed: ${cleanTool}`;
            type = isError ? 'error' : 'tool-success';
            result = data.toolResult || null;
          } else if (eventType === 'generation.started') {
            const rawAgent = data.agent || (data.requestPayload && data.requestPayload.agent);
            if (rawAgent) {
              const parsedAgentId = cleanAgentId(rawAgent);
              if (!parsedAgentId || parsedAgentId.toLowerCase() !== agentId.toLowerCase()) return;
            }
            text = `🧠 LLM generating response / thinking...`;
            type = 'thinking';
          } else if (eventType === 'generation.completed') {
            const rawAgent = data.agent || (data.requestPayload && data.requestPayload.agent);
            if (rawAgent) {
              const parsedAgentId = cleanAgentId(rawAgent);
              if (!parsedAgentId || parsedAgentId.toLowerCase() !== agentId.toLowerCase()) return;
            } else {
              // Ignore generation.completed events that do not carry agent context
              return;
            }
            text = `✨ LLM generation completed`;
            type = 'success';
          } else if (eventType === 'request.created') {
            const rawAgent = data.agent || (data.requestPayload && data.requestPayload.agent);
            if (rawAgent) {
              const parsedAgentId = cleanAgentId(rawAgent);
              if (!parsedAgentId || parsedAgentId.toLowerCase() !== agentId.toLowerCase()) return;
            }
            const isSuccess = data.success !== false;
            const inputT = data.inputTokens || 0;
            const outputT = data.outputTokens || 0;
            const totalT = inputT + outputT;
            const duration = data.totalTime ? `${data.totalTime.toFixed(1)}s` : '';
            const stats = totalT > 0 ? ` (${totalT} tokens${duration ? ` in ${duration}` : ''})` : '';
            text = isSuccess ? `📤 Request completed successfully${stats}` : `⚠️ Request completed with issues`;
            type = isSuccess ? 'success' : 'warn';
            if (data.responsePayload && data.responsePayload.text) {
              result = data.responsePayload.text;
            }
          }

          if (text) {
            setLogs(prev => {
              // Deduplicate to prevent double-logs from local TTS vs backend SSE
              const cleanQuote = (data.quote || '').replace(/[*_`~#]/g, '');
              const isDuplicate = cleanQuote.length > 3 && prev.some(l => l.text.includes(cleanQuote));
              if (isDuplicate) return prev;

              return [...prev, {
                id: `${eventType}-${Date.now()}-${Math.random()}`,
                timestamp,
                type,
                text,
                args,
                result
              }];
            });
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

  // Load History list
  useEffect(() => {
    if (activeTab !== 'history' || !agentId) return;

    async function fetchHistory() {
      setIsLoadingHistory(true);
      setConversations([]);
      setSelectedConvId(null);
      setConvMessages([]);
      
      try {
        const resolved = resolvePrismAgentId(agentId);
        const agentIds = Array.isArray(resolved) ? resolved : [resolved];
        
        const fetchPromises = agentIds.map(async (id) => {
          try {
            // `agent=` is an EXACT equality filter in Prism (it also pulls the
            // agent's own sub-agent conversations). The old `search=` was a
            // substring text match that returned other agents' conversations.
            const res = await fetch(`/prism-api/conversations?agent=${encodeURIComponent(id)}&limit=100&type=agent`, {
              headers: {
                'x-project': 'vllm-trading-bot',
                'x-username': 'lazy-trader'
              }
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
        const allItems = results.flat();
        
        // Sort newest first
        const sorted = allItems.sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        
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

  // Load Messages for selected conversation
  useEffect(() => {
    if (activeTab !== 'history' || !selectedConvId) return;

    async function fetchMessages() {
      setIsLoadingMessages(true);
      setConvMessages([]);
      try {
        const res = await fetch(`/prism-api/conversations/${selectedConvId}`, {
          headers: {
            'x-project': 'vllm-trading-bot',
            'x-username': 'lazy-trader'
          }
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

  // Helper to extract thoughts and main text content
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

  // Parse conversation metadata title
  function parseTitle(title) {
    if (!title) return { ticker: '', cycle: '' };
    const parts = title.split(' · ');
    return {
      ticker: parts[1] || 'GENERAL',
      cycle: parts[2] || 'SYSTEM'
    };
  }

  return (
    <div className="agent-sidebar">
      {/* Sidebar Header */}
      <div className="agent-sidebar__header">
        <div className="agent-sidebar__header-info">
          <span className="agent-sidebar__status-badge" style={{ backgroundColor: agentColor }}></span>
          <span className="agent-sidebar__title">{agentId} details</span>
        </div>
        <button className="agent-sidebar__close" onClick={onClose} aria-label="Close panel">✕</button>
      </div>

      {/* Sidebar Tabs */}
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

      {/* Sidebar Content */}
      <div className="agent-sidebar__content">
        {activeTab === 'logs' ? (
          /* LIVE LOGS TAB */
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
        ) : (
          /* CHAT HISTORY TAB */
          <div className="agent-sidebar__history">
            {isLoadingHistory ? (
              <div className="agent-sidebar__loader">
                <span className="spinner"></span> Loading session records...
              </div>
            ) : conversations.length === 0 ? (
              <div className="agent-sidebar__empty">
                No past chat history found for {agentId}.
              </div>
            ) : (
              <>
                {/* Conversation selector */}
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
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                      });
                      return (
                        <option key={c.id} value={c.id}>
                          {ticker} ({cycle}) — {formattedDate}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Message list */}
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
                    convMessages.map((msg, index) => {
                      const { role } = msg;
                      
                      // COLLAPSIBLE SYSTEM PROMPT (usually first message or meta)
                      if (role === 'system') {
                        return (
                          <div key={`msg-${index}`} className="agent-sidebar__message message-system">
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
                                    gap: '6px'
                                  }}
                                  onClick={(e) => {
                                    const improvePrompt = `Please act as an expert system architect and prompt engineer. Take the following system prompt and improve it. Make it more detailed, technical, robust, and aligned with best practices for an autonomous AI agent.\n\nHere is the prompt:\n\n${msg.content}`;
                                    navigator.clipboard.writeText(improvePrompt);
                                    
                                    const btn = e.currentTarget;
                                    const originalText = btn.innerHTML;
                                    btn.innerHTML = '✅ Copied for Minimax!';
                                    setTimeout(() => {
                                      btn.innerHTML = originalText;
                                    }, 2000);
                                  }}
                                >
                                  ✨ Improve with Minimax (Copy)
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // TOOL CALLS & RESPONSES RENDERING
                      if (role === 'tool') {
                        const toolName = msg.name || 'unknown_tool';
                        const cleanToolName = toolName.replace('mcp__lazy-tool-service__', '');
                        return (
                          <div key={`msg-${index}`} className="agent-sidebar__message message-tool">
                            <details className="agent-sidebar__tool-details">
                              <summary className="agent-sidebar__tool-summary">
                                <span className="icon">🔧</span>
                                <span className="label">Tool Result:</span>
                                <span className="name">{cleanToolName}</span>
                              </summary>
                              <div className="agent-sidebar__tool-result">
                                <pre>
                                  {typeof msg.content === 'object' 
                                    ? JSON.stringify(msg.content, null, 2) 
                                    : String(msg.content)}
                                </pre>
                              </div>
                            </details>
                          </div>
                        );
                      }

                      // REGULAR MESSAGE RENDERER
                      const { thinking, content } = extractThinking(msg);
                      const isAssistant = role === 'assistant';

                      return (
                        <div 
                          key={`msg-${index}`} 
                          className={`agent-sidebar__message ${isAssistant ? 'message-assistant' : 'message-user'}`}
                          style={isAssistant ? { borderLeftColor: agentColor } : {}}
                        >
                          <div className="sender-tag">
                            {isAssistant ? agentId.toUpperCase() : 'USER'}
                          </div>

                          {/* Render Thought Process */}
                          {thinking && (
                            <details className="agent-sidebar__thinking-details" open={index === convMessages.length - 1}>
                              <summary className="agent-sidebar__thinking-summary">
                                🧠 Reasoning Process
                              </summary>
                              <div className="agent-sidebar__thinking-content">
                                {thinking}
                              </div>
                            </details>
                          )}

                          {/* Render Main Content */}
                          {content && (
                            <div className="message-content">
                              {content}
                            </div>
                          )}

                          {/* Inline tool calls that assistant sent */}
                          {msg.toolCalls && msg.toolCalls.map((tc, tcIdx) => {
                            const cleanTcName = tc.name.replace('mcp__lazy-tool-service__', '');
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
                    })
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
