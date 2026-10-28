'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import * as api from '@/lib/api';
import { DEFAULT_AVATAR_CONFIG } from '@/components/3d-office/agent/avatarConfig';
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

const ROLE_PROSE_PATTERNS = [
  { role: 'TECHNICAL', regex: /technical|chart pattern|indicator|price action|RSI|MACD|SMA|EMA|bollinger/i },
  { role: 'RISK', regex: /risk|shield|protect|guard/i },
  { role: 'BEHAVIORAL', regex: /sentiment|news|social|behavior|psychology/i },
  { role: 'FUNDAMENTAL', regex: /fundamental|balance sheet|earning|value/i },
  { role: 'DATA_JANITOR', regex: /janitor|clean|etl|format|parse/i },
  { role: 'PM', regex: /manager|pm|lead|coord/i },
];

function inferAgentRoleFromProse(content) {
  for (const entry of ROLE_PROSE_PATTERNS) {
    if (entry.regex.test(content)) return entry.role;
  }
  return 'QUANT';
}

function extractAgentDisplayNameFromProse(content) {
  const nameMatches = [
    content.match(/agent(?:\s+name)?(?:\s+is|\s+called)?\s+["']?([A-Za-z0-9\s_-]{3,30})["']?/i),
    content.match(/setup\s+(?:a\s+)?([A-Za-z0-9\s_-]{3,30})\s+agent/i),
    content.match(/create\s+(?:a\s+)?([A-Za-z0-9\s_-]{3,30})\s+agent/i),
  ];
  for (const match of nameMatches) {
    const raw = match?.[1]?.trim();
    if (raw && raw.length > 3 && !/^(the|this|an|a|my|new|our)$/i.test(raw)) {
      return raw.replace(/\b\w/g, c => c.toUpperCase());
    }
  }
  return 'Suggested Agent';
}

function matchMentionedTools(content, availableTools) {
  const allowedTools = [];
  if (!Array.isArray(availableTools)) return allowedTools;
  for (const t of availableTools) {
    if (!t.name) continue;
    const escapedName = t.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    if (new RegExp(`\\b${escapedName}\\b`, 'i').test(content)) {
      allowedTools.push(t.name);
    }
  }
  return allowedTools;
}

function buildAgentSystemPromptFromData(data) {
  let finalPrompt = data.system_prompt || data.prompt || '';
  if (!finalPrompt && data.identity) {
    finalPrompt = data.identity;
    if (data.guidelines) finalPrompt += `\n\n## Guidelines\n${data.guidelines}`;
    if (data.toolPolicy) finalPrompt += `\n\n## Tool Policy\n${data.toolPolicy}`;
  }
  if (finalPrompt.trim().length < 10) {
    const inferredRole = (data.role || 'QUANT').toUpperCase().replace(/\s+/g, '_');
    finalPrompt = `You are a specialized ${inferredRole} agent designed for quantitative trading analysis.`;
  }
  if (finalPrompt.length > 9500) {
    console.warn(`[OmniChat] Truncating system_prompt from ${finalPrompt.length} to 9500 chars`);
    finalPrompt = finalPrompt.slice(0, 9500) + '\n\n[Prompt truncated for length]';
  }
  return finalPrompt;
}

function buildAgentPersonaPayload(data, finalPrompt, rosterCount) {
  const resolvedTools = data.allowed_tools || data.tools || data.availableTools || data.enabledTools || [];
  return {
    name: data.name || data.display_name || 'OmniAgent Created',
    display_name: data.display_name || data.name || 'New Agent',
    role: (data.role || 'QUANT').toUpperCase().replace(/\s+/g, '_'),
    system_prompt: finalPrompt,
    allowed_tools: resolvedTools,
    execution_order: Math.min(10, Math.max(1, (rosterCount || 0) + 1)),
    is_active: data.is_active !== undefined ? data.is_active : true,
    max_tokens: data.max_tokens || 8192,
    temperature: data.temperature || 0.7,
    voice_pitch: data.voice_pitch || 1.0,
    voice_rate: data.voice_rate || 1.0,
    avatar_config: data.avatar_config || { ...DEFAULT_AVATAR_CONFIG },
  };
}

function isAgentCandidateObject(candidate) {
  return Boolean(candidate && (candidate.name || candidate.display_name || candidate.role || candidate.identity));
}

function parseFencedAgentJson(content) {
  const fencedMatch = content.match(/\x60\x60\x60(?:json)?\s*\n?([\s\S]*?)\x60\x60\x60/);
  if (!fencedMatch) return null;
  try {
    const candidate = JSON.parse(fencedMatch[1].trim());
    return isAgentCandidateObject(candidate) ? candidate : null;
  } catch (e) {
    console.warn('[OmniChat] Strategy 1 JSON parse failed:', e);
    return null;
  }
}

const CORE_TOOL_NAMES = ['search_web', 'discover_and_enable_tools', 'enable_tools', 'disable_tools', 'search_tools'];

function buildEnabledToolsList(availableTools) {
  const mapped = (availableTools || [])
    .map(t => t.name)
    .filter(Boolean)
    .map(name =>
      name.startsWith('mcp__') || name.startsWith('domain:') || CORE_TOOL_NAMES.includes(name)
        ? name
        : `mcp__lazy-agent-service__${name}`,
    );
  return [
    ...mapped,
    'discover_and_enable_tools',
    'enable_tools',
    'disable_tools',
    'search_tools',
  ];
}

function processOmniSseData(data, { fullContentRef, updateBot, setMessages, setError }) {
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
    updateBot(() => ({ status: statusMsg + tokPerSec }));
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

async function consumeOmniSseStream(reader, handlers) {
  const decoder = new TextDecoder();
  let buffer = '';
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
      try {
        const data = JSON.parse(jsonStr);
        processOmniSseData(data, handlers);
      } catch {
        // Skip unparseable
      }
    }
  }
}

function flattenToolCallingModels(modelsMap) {
  const flat = [];
  for (const [provider, modelList] of Object.entries(modelsMap || {})) {
    if (!Array.isArray(modelList)) continue;
    for (const m of modelList) {
      const tools = m.tools || [];
      if (tools.includes('Tool Calling')) {
        const name = m.name || m.value || 'unknown';
        flat.push({ provider, name, value: m.value || name, tools });
      }
    }
  }
  return flat;
}

function OmniChatAssistantMessage({ msg, tryExtractAndSaveAgent }) {
  const isDone = !msg.streaming;
  const hasContent = Boolean(msg.content);
  const showSpinner = msg.streaming && !msg.content && !msg.thinking;
  const isThinkingStream = msg.streaming && msg.status === 'thinking';
  const showBubble = Boolean(msg.content || (!msg.streaming && !msg.thinking));

  return (
    <div className="omni-chat__msg omni-chat__msg--assistant">
      <div className="omni-chat__msg-label">OmniAgent</div>

      {showSpinner && (
        <div className="omni-chat__status-indicator">
          <span className="omni-chat__status-spinner" />
          {(msg.status || 'connecting').replace(/_/g, ' ')}
        </div>
      )}

      {msg.thinking && (
        <div className="omni-chat__thinking">
          <div className="omni-chat__thinking-header">
            💭 {isThinkingStream ? 'Thinking...' : 'Thought'}
          </div>
          <div className="omni-chat__thinking-content">
            {msg.thinking}
            {isThinkingStream && <span className="omni-chat__streaming-cursor" />}
          </div>
        </div>
      )}

      {showBubble && (
        <div className="omni-chat__msg-bubble">
          {msg.content || '(No response)'}
          {msg.streaming && msg.status === 'generating' && (
            <span className="omni-chat__streaming-cursor" />
          )}
        </div>
      )}

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

function OmniChatMessageItem({ msg, tryExtractAndSaveAgent }) {
  if (msg.role === 'tool') {
    const hasArgs = msg.toolArgs && Object.keys(msg.toolArgs).length > 0;
    const formattedResult = typeof msg.toolResult === 'string'
      ? msg.toolResult
      : JSON.stringify(msg.toolResult, null, 2);
    return (
      <div className="omni-chat__tool-call">
        <div className="omni-chat__tool-call-name">
          🔧 {msg.toolName}
          {msg.toolStatus && <span style={{ opacity: 0.6, marginLeft: 6 }}>({msg.toolStatus})</span>}
        </div>
        {hasArgs && (
          <div className="omni-chat__tool-call-args">
            {JSON.stringify(msg.toolArgs, null, 2)}
          </div>
        )}
        {msg.toolResult && (
          <div className="omni-chat__tool-call-result">{formattedResult}</div>
        )}
      </div>
    );
  }

  if (msg.role === 'system') {
    return <div className="omni-chat__system-msg">{msg.content}</div>;
  }

  if (msg.role === 'assistant') {
    return <OmniChatAssistantMessage msg={msg} tryExtractAndSaveAgent={tryExtractAndSaveAgent} />;
  }

  return (
    <div className="omni-chat__msg omni-chat__msg--user">
      <div className="omni-chat__msg-label">You</div>
      <div className="omni-chat__msg-bubble">{msg.content}</div>
    </div>
  );
}

function OmniChatDraftCard({ pendingAgentDraft, setPendingAgentDraft, onCreateAgent, saveAgentFromData }) {
  if (!pendingAgentDraft) return null;
  const tools = pendingAgentDraft.allowed_tools || [];
  const rawPrompt = pendingAgentDraft.system_prompt || '';
  const promptPreview = !rawPrompt
    ? '(None)'
    : rawPrompt.length > 150
      ? rawPrompt.substring(0, 150) + '...'
      : rawPrompt;

  return (
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
        {tools.length > 0 && (
          <div className="omni-chat__draft-row">
            <span className="omni-chat__draft-label">Tools ({tools.length}):</span>
            <span className="omni-chat__draft-value">{tools.join(', ')}</span>
          </div>
        )}
        <div className="omni-chat__draft-row">
          <span className="omni-chat__draft-label">Prompt:</span>
          <span className="omni-chat__draft-prompt-preview">{promptPreview}</span>
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
  );
}

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
        const flat = flattenToolCallingModels(data.models);
        setAvailableModels(flat);
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
    const role = inferAgentRoleFromProse(content);
    const displayName = extractAgentDisplayNameFromProse(content);
    const name = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_+|_+$)/g, '') || 'suggested_agent';
    const allowedTools = matchMentionedTools(content, availableTools);
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
      const finalPrompt = buildAgentSystemPromptFromData(data);
      const agentPayload = buildAgentPersonaPayload(data, finalPrompt, rosterCount);

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

    let parsed = parseFencedAgentJson(content);

    if (!parsed) {
      const bareMatch = content.match(/(\{[\s\S]*?(?:"name"|"display_name"|"role"|"identity")[\s\S]*?\})/);
      if (bareMatch) {
        parsed = extractFirstJson(content);
      }
    }

    if (!parsed) {
      const hasCreateIntent = /(?:create|set up|configure|here is|here's|proposed|suggested)\s+(?:a|the|your|an)?\s*agent/i.test(content);
      const mentioned = matchMentionedTools(content, availableTools);
      if (hasCreateIntent && mentioned.length > 0) {
        console.log('[OmniChat] Synthesizing agent config from content...');
        parsed = synthesizeAgentFromProse(content);
      }
    }

    if (parsed) {
      console.log('[OmniChat] Extracted agent config — showing draft preview:', parsed);
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

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);

    const history = [...messages, userMsg].map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    setSending(true);
    const fullContentRef = { current: '' };
    const botIdx = { current: -1 };

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const enabledTools = buildEnabledToolsList(availableTools);
      const payload = {
        provider: activeProvider,
        model: activeModel,
        agent: 'OMNI',
        messages: [
          { role: 'system', content: buildSystemPrompt(availableTools) },
          ...history,
        ],
        functionCallingEnabled: true,
        thinkingEnabled: false,
        enabledTools,
        maxTokens: 16384,
        minContextLength: 128000,
        conversationId,
        conversationMeta: { title: 'Trading Client OmniAgent' },
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

      const reader = response.body.getReader();
      setMessages(prev => {
        botIdx.current = prev.length;
        return [...prev, { role: 'assistant', content: '', thinking: '', streaming: true, status: 'connecting' }];
      });

      const updateBot = (updater) => {
        setMessages(prev => {
          const idx = botIdx.current;
          if (idx < 0 || idx >= prev.length) return prev;
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...updater(updated[idx]) };
          return updated;
        });
      };

      await consumeOmniSseStream(reader, { fullContentRef, updateBot, setMessages, setError });
      updateBot(msg => msg.streaming ? { streaming: false, status: 'done' } : {});
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

  const canSend = Boolean(input.trim() && selectedModel && availableTools && availableTools.length > 0);

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

        {messages.map((msg, i) => (
          <OmniChatMessageItem key={i} msg={msg} tryExtractAndSaveAgent={tryExtractAndSaveAgent} />
        ))}

        <OmniChatDraftCard
          pendingAgentDraft={pendingAgentDraft}
          setPendingAgentDraft={setPendingAgentDraft}
          onCreateAgent={onCreateAgent}
          saveAgentFromData={saveAgentFromData}
        />

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
            disabled={!canSend}
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
