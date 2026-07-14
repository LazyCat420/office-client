'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import * as api from '@/lib/api';
import './omniChat.css';

const PRISM_API = '/prism-api';

/**
 * Extracts the first matching JSON object in a string by checking curly braces balance.
 * Returns the parsed JSON if it contains agent config signature fields.
 */
function extractFirstJson(str) {
  const startIdx = str.indexOf('{');
  if (startIdx === -1) return null;

  let depth = 0;
  for (let i = startIdx; i < str.length; i++) {
    if (str[i] === '{') {
      depth++;
    } else if (str[i] === '}') {
      depth--;
      if (depth === 0) {
        const potentialJson = str.slice(startIdx, i + 1);
        try {
          const parsed = JSON.parse(potentialJson);
          if (parsed.name || parsed.display_name || parsed.role || parsed.identity) {
            return parsed;
          }
        } catch {
          // keep looking
        }
      }
    }
  }
  return null;
}

function buildSystemPrompt(tools) {
  const toolList = (tools || []).map(t => `- ${t.name}: ${t.description || t.label || t.name}`).join('\n');

  return `You are OmniAgent, an expert AI assistant embedded inside a quantitative trading platform called TradingClient.

Your ONLY job is to help the user design, configure, and create trading agents. You have deep knowledge of this system's available tools and agent roles.

## Available Agent Roles
- QUANT — Quantitative analysis, signals, and strategy
- TECHNICAL — Chart patterns, indicators, technical analysis, price action
- FUNDAMENTAL — Earnings, balance sheets, valuation
- RISK — Position sizing, drawdown protection, portfolio risk
- BEHAVIORAL — Sentiment, news, social signals, psychology
- DATA_JANITOR — Data cleaning, normalization, ETL
- PM — Portfolio manager, coordination, orchestration

## Available Tools
${toolList}

## Your Output Format
When the user asks you to set up, create, or configure an agent, you MUST respond with a valid JSON config block at the end of your response in this exact format:

\`\`\`json
{
  "name": "snake_case_unique_name",
  "display_name": "Human Readable Name",
  "role": "ROLE_NAME",
  "system_prompt": "A detailed system prompt for this agent describing its job, behavior, and constraints.",
  "allowed_tools": ["tool_name_1", "tool_name_2"],
  "max_tokens": 8192,
  "temperature": 0.3
}
\`\`\`

Rules:
- "name" must be snake_case, no spaces, derived from what the agent DOES (e.g. "technical_analysis_agent", NOT the user's question)
- "display_name" must be a short human-readable title (e.g. "Technical Analysis Agent")
- "allowed_tools" must only contain tool names from the Available Tools list above
- "system_prompt" must be a detailed, actionable prompt that tells the agent exactly how to behave
- Always pick the role that best fits the agent's purpose
- Always explain your reasoning BEFORE the JSON block
- Never include tools that are not in the Available Tools list`;
}

const SUGGESTIONS = [
  'What tools should I give a risk management agent?',
  'Help me set up a technical analysis agent with the right tools',
  'Which tools are best for a sentiment analysis workflow?',
  'Suggest a tool configuration for fundamental stock analysis',
];

/**
 * OmniChat — Embedded chat panel connected to the Prism OmniAgent.
 * Fetches available models from /prism-api/config-local, lets user pick one,
 * and streams via SSE through the /prism-api/agent endpoint.
 */
export default function OmniChat({ onCreateAgent, onRefreshRoster, onAgentSaved, rosterCount }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [conversationId] = useState(() => `trading-omni-${Date.now()}`);
  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);
  const textareaRef = useRef(null);

  // -- Roster & Tools --
  const [availableTools, setAvailableTools] = useState([]);
  const [pendingAgentDraft, setPendingAgentDraft] = useState(null);

  // ── Model selection ──
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(''); // "provider::modelName"
  const [modelsLoading, setModelsLoading] = useState(true);

  // Fetch models from Prism on mount
  useEffect(() => {
    async function loadModels() {
      setModelsLoading(true);
      try {
        const res = await fetch(`${PRISM_API}/config-local`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const models = data.models || {};
        const flat = [];
        for (const [provider, modelList] of Object.entries(models)) {
          if (!Array.isArray(modelList)) continue;
          for (const m of modelList) {
            // Only show models with Tool Calling capability
            const tools = m.tools || [];
            if (tools.includes('Tool Calling')) {
              flat.push({
                provider,
                name: m.name || m.value || 'unknown',
                value: m.value || m.name || 'unknown',
                tools,
              });
            }
          }
        }
        setAvailableModels(flat);
        // Auto-select first model with Tool Calling
        if (flat.length > 0 && !selectedModel) {
          setSelectedModel(`${flat[0].provider}::${flat[0].name}`);
        }
      } catch (err) {
        console.error('[OmniChat] Failed to load models:', err);
        setError('Failed to load available models from Prism');
      }
      setModelsLoading(false);
    }
    loadModels();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load tools on mount to help with synthesis and suggestion mapping
  useEffect(() => {
    api.getAgentTools().then(data => {
      if (data?.tools) {
        setAvailableTools(data.tools);
      }
    });
  }, []);

  // Parse selected model into provider + model name
  const { activeProvider, activeModel } = useMemo(() => {
    if (!selectedModel) return { activeProvider: '', activeModel: '' };
    const [provider, ...rest] = selectedModel.split('::');
    return { activeProvider: provider, activeModel: rest.join('::') };
  }, [selectedModel]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError('');
  }, []);

  const synthesizeAgentFromProse = useCallback((content) => {
    // 1. Infer role from text
    let role = 'QUANT';
    if (/technical|chart pattern|indicator|price action|RSI|MACD|SMA|EMA|bollinger/i.test(content)) {
      role = 'TECHNICAL';
    } else if (/risk|shield|protect|guard/i.test(content)) {
      role = 'RISK';
    } else if (/sentiment|news|social|behavior|psychology/i.test(content)) {
      role = 'BEHAVIORAL';
    } else if (/fundamental|balance sheet|earning|value/i.test(content)) {
      role = 'FUNDAMENTAL';
    } else if (/janitor|clean|etl|format|parse/i.test(content)) {
      role = 'DATA_JANITOR';
    } else if (/manager|pm|lead|coord/i.test(content)) {
      role = 'PM';
    }

    // 2. Extract name / display_name
    let displayName = 'Suggested Agent';
    const nameMatches = [
      content.match(/agent(?:\s+name)?(?:\s+is|\s+called)?\s+["']?([A-Za-z0-9\s_-]{3,30})["']?/i),
      content.match(/setup\s+(?:a\s+)?([A-Za-z0-9\s_-]{3,30})\s+agent/i),
      content.match(/create\s+(?:a\s+)?([A-Za-z0-9\s_-]{3,30})\s+agent/i)
    ];
    for (const match of nameMatches) {
      if (match && match[1] && match[1].trim().length > 3) {
        const title = match[1].trim();
        if (!/^(the|this|an|a|my|new|our)$/i.test(title)) {
          displayName = title.replace(/\b\w/g, c => c.toUpperCase());
          break;
        }
      }
    }

    const name = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_+|_+$)/g, '') || 'suggested_agent';

    // 3. Find allowed_tools by matching mentioned names against whitelist
    const allowedTools = [];
    if (Array.isArray(availableTools)) {
      for (const t of availableTools) {
        if (!t.name) continue;
        const escapedName = t.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedName}\\b`, 'i');
        if (regex.test(content)) {
          allowedTools.push(t.name);
        }
      }
    }

    // 4. Generate a CLEAN system prompt — do NOT use the full LLM response
    //    Instead, generate a concise role-specific prompt
    const roleLabel = role.toLowerCase().replace('_', ' ');
    const toolsClause = allowedTools.length > 0
      ? ` You have access to the following tools: ${allowedTools.join(', ')}.`
      : '';
    const systemPrompt = `You are ${displayName}, a specialized ${roleLabel} agent for a quantitative trading platform. Your job is to analyze financial data and provide actionable insights relevant to your role.${toolsClause} Be thorough, data-driven, and precise in your analysis.`;

    return {
      name,
      display_name: displayName,
      role,
      system_prompt: systemPrompt,
      allowed_tools: allowedTools,
      max_tokens: 8192,
      temperature: 0.7,
    };
  }, [availableTools]);

  const saveAgentFromData = useCallback(async (data) => {
    try {
      // Assemble system prompt, supporting fallback for identity/guidelines/toolPolicy
      let finalPrompt = data.system_prompt || data.prompt || '';
      if (!finalPrompt && data.identity) {
        finalPrompt = data.identity;
        if (data.guidelines) {
          finalPrompt += `\n\n## Guidelines\n${data.guidelines}`;
        }
        if (data.toolPolicy) {
          finalPrompt += `\n\n## Tool Policy\n${data.toolPolicy}`;
        }
      }
      
      // Enforce backend validation limit (system_prompt >= 10 chars)
      if (finalPrompt.trim().length < 10) {
        const inferredRole = (data.role || 'QUANT').toUpperCase().replace(/\s+/g, '_');
        finalPrompt = `You are a specialized ${inferredRole} agent designed for quantitative trading analysis.`;
      }

      // Safety truncation — backend limit is 50K, but keep prompts reasonable
      if (finalPrompt.length > 9500) {
        console.warn(`[OmniChat] Truncating system_prompt from ${finalPrompt.length} to 9500 chars`);
        finalPrompt = finalPrompt.slice(0, 9500) + '\n\n[Prompt truncated for length]';
      }

      const agentPayload = {
        name: data.name || data.display_name || 'OmniAgent Created',
        display_name: data.display_name || data.name || 'New Agent',
        role: (data.role || 'QUANT').toUpperCase().replace(/\s+/g, '_'),
        system_prompt: finalPrompt,
        allowed_tools: data.allowed_tools || data.tools || data.availableTools || data.enabledTools || [],
        execution_order: Math.min(10, Math.max(1, (rosterCount || 0) + 1)),
        is_active: data.is_active !== undefined ? data.is_active : true,
        max_tokens: data.max_tokens || 8192,
        temperature: data.temperature || 0.7,
        voice_pitch: data.voice_pitch || 1.0,
        voice_rate: data.voice_rate || 1.0,
        avatar_config: data.avatar_config || {
          skin_color: '#fde68a',
          hair_color: '#1e293b',
          outfit_color: '#3b82f6',
          accent_color: '#f59e0b',
          accessory: null,
        },
      };

      console.log('[OmniChat] Saving agent persona with payload:', agentPayload);
      const result = await api.createAgentPersona(agentPayload);
      console.log('[OmniChat] Agent saved response:', result);

      if (result) {
        onAgentSaved?.(result);
        onRefreshRoster?.();
        setMessages(prev => [...prev, {
          role: 'system',
          content: `✅ Agent "${agentPayload.display_name}" saved to roster!`,
        }]);
      } else {
        setError('Failed to save agent to roster. Check system logs.');
        setMessages(prev => [...prev, {
          role: 'system',
          content: `❌ Failed to save agent "${agentPayload.display_name}". Please check the logs.`,
        }]);
      }
    } catch (err) {
      console.error('[OmniChat] Failed to save agent:', err);
      const detail = err.message || 'Failed to save agent';
      setError(detail);
      setMessages(prev => [...prev, {
        role: 'system',
        content: `❌ Save failed: ${detail}`,
      }]);
    }
  }, [onAgentSaved, onRefreshRoster, rosterCount]);

  const tryExtractAndSaveAgent = useCallback((content) => {
    if (!content) return;

    let parsed = null;

    // Strategy 1: Fenced code block (```json ... ``` or ``` ... ```)
    const fencedMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fencedMatch) {
      try {
        const candidate = JSON.parse(fencedMatch[1].trim());
        if (candidate.name || candidate.display_name || candidate.role || candidate.identity) {
          parsed = candidate;
        }
      } catch (e) {
        console.warn('[OmniChat] Strategy 1 JSON parse failed:', e);
      }
    }

    // Strategy 2: Find a bare JSON object containing "name", "display_name", "role", or "identity"
    if (!parsed) {
      const bareMatch = content.match(/(\{[\s\S]*?(?:"name"|"display_name"|"role"|"identity")[\s\S]*?\})/);
      if (bareMatch) {
        parsed = extractFirstJson(content);
      }
    }

    // Strategy 3: Synthesis fallback if response discusses agents
    if (!parsed) {
      const hasCreateIntent = /(?:create|set up|configure|here is|here's|proposed|suggested)\s+(?:a|the|your|an)?\s*agent/i.test(content);
      const hasMentionedTools = (availableTools || []).some(t => t.name && new RegExp(`\\b${t.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i').test(content));
      if (hasCreateIntent && hasMentionedTools) {
        console.log('[OmniChat] Synthesizing agent config from content...');
        parsed = synthesizeAgentFromProse(content);
      }
    }

    if (parsed) {
      console.log('[OmniChat] Extracted agent config — showing draft preview:', parsed);
      // Show the draft card for user confirmation instead of auto-saving
      setPendingAgentDraft(parsed);
    }
  }, [synthesizeAgentFromProse, availableTools]);

  const sendMessage = useCallback(async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text || sending) return;

    if (!activeProvider || !activeModel) {
      setError('Please select a model first');
      return;
    }

    setPendingAgentDraft(null);
    setInput('');
    setError('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Add user message
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);

    // Build message history for Prism API
    const history = [...messages, userMsg].map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    setSending(true);

    const fullContentRef = { current: '' };

    // Track bot message index via a mutable ref so all setMessages closures
    // reference the same up-to-date value.
    const botIdx = { current: -1 };

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      // Explicit tool scope. Without enabledTools this request fell through
      // to the OMNI persona's wildcard and the gateway injected its ENTIRE
      // tool catalog (~229 tools) into the run — the exact context bloat the
      // trading whitelist exists to prevent. The list is the same trading
      // toolset the UI already fetched for suggestion mapping, normalized the
      // way trading-client's stream.py does, plus the discovery meta-tools so
      // the agent can still pull in extras on demand.
      const CORE_TOOL_NAMES = ['search_web', 'discover_and_enable_tools', 'enable_tools', 'disable_tools', 'search_tools'];
      const enabledTools = [
        ...(availableTools || [])
          .map(t => t.name)
          .filter(Boolean)
          .map(name =>
            name.startsWith('mcp__') || name.startsWith('domain:') || CORE_TOOL_NAMES.includes(name)
              ? name
              : `mcp__lazy-tool-service__${name}`,
          ),
        'discover_and_enable_tools',
        'enable_tools',
        'disable_tools',
        'search_tools',
      ];

      const payload = {
        provider: activeProvider,
        model: activeModel,
        agent: 'OMNI',
        messages: [
          { role: 'system', content: buildSystemPrompt(availableTools) },
          ...history,
        ],
        functionCallingEnabled: true,
        // Interactive chat: a person is watching the stream, and Qwen-class
        // models spend most of the turn in the <think> block when this is on.
        thinkingEnabled: false,
        enabledTools,
        maxTokens: 16384,
        minContextLength: 128000,
        conversationId,
        conversationMeta: {
          title: 'Trading Client OmniAgent',
        },
        project: 'trading-client',
        harness: 'standard',
        topology: 'hierarchical',
        autoApprove: true,
        maxIterations: 10,
        maxWorkerIterations: 10,
      };

      const response = await fetch('/api/prism-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${response.status}`);
      }

      // Always treat /agent as SSE stream (it always returns text/event-stream)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let chunkCount = 0;

      // Add placeholder bot message
      setMessages(prev => {
        botIdx.current = prev.length;
        return [...prev, { role: 'assistant', content: '', thinking: '', streaming: true, status: 'connecting' }];
      });

      // Helper to update the bot message safely
      const updateBot = (updater) => {
        setMessages(prev => {
          const idx = botIdx.current;
          if (idx < 0 || idx >= prev.length) return prev;
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...updater(updated[idx]) };
          return updated;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          let data;
          try {
            data = JSON.parse(jsonStr);
          } catch {
            continue; // Skip unparseable
          }

          chunkCount++;

          if (data.type === 'chunk') {
            const chunkContent = data.content || '';
            fullContentRef.current += chunkContent;
            updateBot(msg => ({
              content: msg.content + chunkContent,
              status: 'generating',
            }));
          } else if (data.type === 'thinking') {
            updateBot(msg => ({
              thinking: (msg.thinking || '') + (data.content || ''),
              status: 'thinking',
            }));
          } else if (data.type === 'status') {
            const statusMsg = data.message || '';
            const tokPerSec = data.tokPerSec ? ` (${data.tokPerSec.toFixed(1)} tok/s)` : '';
            updateBot(() => ({
              status: statusMsg + tokPerSec,
            }));
          } else if (data.type === 'tool_execution') {
            const tool = data.tool || {};
            setMessages(prev => [...prev, {
              role: 'tool',
              toolName: tool.name || data.name || 'unknown',
              toolArgs: tool.args || data.args || {},
              toolStatus: data.status || 'executing',
              toolResult: tool.result,
            }]);
          } else if (data.type === 'done') {
            updateBot(() => ({ streaming: false, status: 'done' }));
          } else if (data.type === 'error') {
            setError(data.message || 'Stream error');
            updateBot(() => ({ streaming: false, status: 'error' }));
          }
        }
      }

      // Mark streaming complete when reader finishes
      updateBot(msg => msg.streaming ? { streaming: false, status: 'done' } : {});

      // Try to extract and save agent from the response
      tryExtractAndSaveAgent(fullContentRef.current);

    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[OmniChat] Error:', err);
      setError(err.message || 'Failed to connect to OmniAgent');
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }, [input, sending, messages, conversationId, activeProvider, activeModel, tryExtractAndSaveAgent]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const stopGeneration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setSending(false);
    setMessages(prev => {
      const updated = [...prev];
      const lastIdx = updated.length - 1;
      if (lastIdx >= 0 && updated[lastIdx].streaming) {
        updated[lastIdx] = {
          ...updated[lastIdx],
          streaming: false,
          content: updated[lastIdx].content + '\n\n*(Stopped)*',
          status: 'stopped',
        };
      }
      return updated;
    });
  }, []);

  return (
    <div className="omni-chat">
      {/* Header */}
      <div className="omni-chat__header">
        <div className="omni-chat__header-icon">🔴</div>
        <div className="omni-chat__header-info">
          <div className="omni-chat__header-title">OmniAgent</div>
          <div className="omni-chat__header-subtitle">
            Ask for tool suggestions, agent configs, or help building workflows
          </div>
        </div>
        {onCreateAgent && (
          <button className="omni-chat__create-btn" onClick={onCreateAgent}>
            + Create Agent
          </button>
        )}
        {messages.length > 0 && (
          <button className="omni-chat__clear-btn" onClick={clearChat}>
            Clear
          </button>
        )}
      </div>

      {/* Model selector */}
      <div className="omni-chat__model-bar">
        <label className="omni-chat__model-label">Model</label>
        <select
          className="omni-chat__model-select"
          value={selectedModel}
          onChange={e => setSelectedModel(e.target.value)}
          disabled={modelsLoading || sending}
        >
          {modelsLoading && <option value="">Loading models...</option>}
          {!modelsLoading && availableModels.length === 0 && (
            <option value="">No models available</option>
          )}
          {availableModels.map(m => (
            <option key={`${m.provider}::${m.name}`} value={`${m.provider}::${m.name}`}>
              {m.name} ({m.provider})
            </option>
          ))}
        </select>
        {(!availableTools || availableTools.length === 0) && (
          <span className="omni-chat__tools-loading" style={{ marginLeft: '8px', fontSize: '11px', color: '#64748b' }}>
            Loading tools...
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="omni-chat__error">⚠️ {error}</div>
      )}

      {/* Messages */}
      <div className="omni-chat__messages">
        {messages.length === 0 && !sending && (
          <div className="omni-chat__empty">
            <div className="omni-chat__empty-icon">🧠</div>
            <div className="omni-chat__empty-title">OmniAgent Assistant</div>
            <div className="omni-chat__empty-text">
              Ask OmniAgent to help you pick tools for your agents, suggest configurations,
              or spin up new agent workflows.
            </div>
            <div className="omni-chat__suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  className="omni-chat__suggestion"
                  onClick={() => sendMessage(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === 'tool') {
            return (
              <div key={i} className="omni-chat__tool-call">
                <div className="omni-chat__tool-call-name">
                  🔧 {msg.toolName}
                  {msg.toolStatus && <span style={{ opacity: 0.6, marginLeft: 6 }}>({msg.toolStatus})</span>}
                </div>
                {msg.toolArgs && Object.keys(msg.toolArgs).length > 0 && (
                  <div className="omni-chat__tool-call-args">
                    {JSON.stringify(msg.toolArgs, null, 2)}
                  </div>
                )}
                {msg.toolResult && (
                  <div className="omni-chat__tool-call-result">
                    {typeof msg.toolResult === 'string' ? msg.toolResult : JSON.stringify(msg.toolResult, null, 2)}
                  </div>
                )}
              </div>
            );
          }

          if (msg.role === 'system') {
            return (
              <div key={i} className="omni-chat__system-msg">
                {msg.content}
              </div>
            );
          }

          if (msg.role === 'assistant') {
            const isDone = !msg.streaming;
            const hasContent = Boolean(msg.content);
            return (
              <div key={i} className="omni-chat__msg omni-chat__msg--assistant">
                <div className="omni-chat__msg-label">OmniAgent</div>

                {/* Status indicator (shows while waiting for content) */}
                {msg.streaming && !msg.content && !msg.thinking && (
                  <div className="omni-chat__status-indicator">
                    <span className="omni-chat__status-spinner" />
                    {(msg.status || 'connecting').replace(/_/g, ' ')}
                  </div>
                )}

                {/* Thinking block */}
                {msg.thinking && (
                  <div className="omni-chat__thinking">
                    <div className="omni-chat__thinking-header">
                      💭 {msg.streaming && msg.status === 'thinking' ? 'Thinking...' : 'Thought'}
                    </div>
                    <div className="omni-chat__thinking-content">
                      {msg.thinking}
                      {msg.streaming && msg.status === 'thinking' && (
                        <span className="omni-chat__streaming-cursor" />
                      )}
                    </div>
                  </div>
                )}

                {/* Response text */}
                {(msg.content || (!msg.streaming && !msg.thinking)) && (
                  <div className="omni-chat__msg-bubble">
                    {msg.content || '(No response)'}
                    {msg.streaming && msg.status === 'generating' && (
                      <span className="omni-chat__streaming-cursor" />
                    )}
                  </div>
                )}

                {/* Save as Agent button — shown on completed responses */}
                {isDone && hasContent && (
                  <button
                    className="omni-chat__save-agent-btn"
                    onClick={() => tryExtractAndSaveAgent(msg.content)}
                  >
                    🤖 Save as Agent
                  </button>
                )}
              </div>
            );
          }

          // User message
          return (
            <div key={i} className="omni-chat__msg omni-chat__msg--user">
              <div className="omni-chat__msg-label">You</div>
              <div className="omni-chat__msg-bubble">{msg.content}</div>
            </div>
          );
        })}

        {/* Agent Draft Preview Card */}
        {pendingAgentDraft && (
          <div className="omni-chat__draft-card">
            <div className="omni-chat__draft-header">
              <span className="omni-chat__draft-sparkle">✨</span>
              <div className="omni-chat__draft-title-container">
                <div className="omni-chat__draft-title">Proposed Agent Config</div>
                <div className="omni-chat__draft-subtitle">Would you like to save this agent to the roster?</div>
              </div>
              <button className="omni-chat__draft-close" onClick={() => setPendingAgentDraft(null)}>×</button>
            </div>
            <div className="omni-chat__draft-details">
              <div className="omni-chat__draft-row">
                <span className="omni-chat__draft-label">Name:</span>
                <span className="omni-chat__draft-value">{pendingAgentDraft.display_name || pendingAgentDraft.name}</span>
              </div>
              <div className="omni-chat__draft-row">
                <span className="omni-chat__draft-label">Role:</span>
                <span className="omni-chat__draft-value">{pendingAgentDraft.role || 'QUANT'}</span>
              </div>
              {pendingAgentDraft.allowed_tools && pendingAgentDraft.allowed_tools.length > 0 && (
                <div className="omni-chat__draft-row">
                  <span className="omni-chat__draft-label">Tools ({pendingAgentDraft.allowed_tools.length}):</span>
                  <span className="omni-chat__draft-value">{pendingAgentDraft.allowed_tools.join(', ')}</span>
                </div>
              )}
              <div className="omni-chat__draft-row">
                <span className="omni-chat__draft-label">Prompt:</span>
                <span className="omni-chat__draft-prompt-preview">
                  {pendingAgentDraft.system_prompt ? (
                    pendingAgentDraft.system_prompt.length > 150
                      ? pendingAgentDraft.system_prompt.substring(0, 150) + '...'
                      : pendingAgentDraft.system_prompt
                  ) : '(None)'}
                </span>
              </div>
            </div>
            <div className="omni-chat__draft-actions">
              <button
                className="omni-chat__btn omni-chat__btn--secondary"
                onClick={() => {
                  onCreateAgent?.(pendingAgentDraft);
                  setPendingAgentDraft(null);
                }}
              >
                🛠️ Edit First
              </button>
              <button
                className="omni-chat__btn omni-chat__btn--primary"
                onClick={() => {
                  saveAgentFromData(pendingAgentDraft);
                  setPendingAgentDraft(null);
                }}
              >
                💾 Save to Roster
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="omni-chat__input-area">
        <textarea
          ref={textareaRef}
          className="omni-chat__input"
          placeholder="Ask OmniAgent anything..."
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={sending}
        />
        {sending ? (
          <button className="omni-chat__send-btn" onClick={stopGeneration}>
            ■ Stop
          </button>
        ) : (
          <button
            className="omni-chat__send-btn"
            onClick={() => sendMessage()}
            disabled={!input.trim() || !selectedModel || !availableTools || availableTools.length === 0}
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
