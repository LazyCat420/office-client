import { useState, useEffect, useRef, useCallback } from 'react';
import { processEvent, arriveAgent, moveAgent, releaseSlot, resetOccupancy, AGENT_STATES, clearBubble, claimSlot } from './stateMachine';
import { mapEvent } from '../../agent-office/shared';
import { classifyToolStation } from './toolStationMap';
import { soundManager } from '../SoundManager';
import { GESTURE_DURATIONS } from '../animations';
import demandTracker from './demandTracker';

const WALK_DURATION_MS = 15000;
const BUBBLE_TIMEOUT_MS = 4000;
const GESTURE_DURATION_MS = 2400; // One-shot reaction gestures (wave/cheer/facepalm)
const AGENT_EXPIRE_MS = 30000;  // Remove agents after 30s of no events
const EXIT_DELAY_MS = 3500;
const EXIT_FADE_MS = 600;
const SMOKE_BREAK_CHANCE = 0.15; // 15% chance of smoke break after completing work
const SMOKE_BREAK_MIN_TASKS = 3; // Minimum tasks before eligible for smoke break

// Live TTS is throttled so a busy multi-ticker cycle doesn't queue dozens of
// utterances that lag far behind the visuals.
const VOICE_MIN_GAP_MS = 2500;
// Only these agents' final reports are spoken aloud (the decision-makers);
// worker analysts get animations + barks but stay quiet to avoid a wall of TTS.
const HIGH_SIGNAL_SPEAKERS = new Set([
  'v3_board_of_directors',
  'v3_decision_synthesizer',
  'v3_regime_engine',
]);
// Decision-makers seal their verdict into an envelope; everyone else's
// agent_done plays the "writing a report" gesture.
const SEALERS = new Set([
  'v3_board_of_directors',
  'v3_decision_synthesizer',
]);

import { cleanAgentId, canonicalAgentId, getHomeStation, getStationForAgentOrTool as sharedGetStationForAgentOrTool } from '../../agent-office/shared';

export { cleanAgentId };

const getStationForAgentOrTool = (agentId, toolName) =>
  sharedGetStationForAgentOrTool(agentId, toolName, classifyToolStation, true);

// Canonical ids of the real V3 pipeline roster (see canonicalAgentId).
// V1 names that receive no events in a V3 cycle (DATA_JANITOR,
// PRE_TRADE_RISK, PORTFOLIO_ALLOCATOR) were dropped; the debaters still
// receive events via the bull/bear aliases.
const PIPELINE_AGENTS = [
  'QUANT_RESEARCH_AGENT',
  'V3_QUANT_ANALYST',
  'V3_JUNIOR_ANALYST',
  'V3_FUNDAMENTAL_ANALYST',
  'V3_REGIME_ENGINE',
  'V3_BOARD_OF_DIRECTORS',
  'V3_PORTFOLIO_MANAGER',
  'V3_DECISION_SYNTHESIZER',
  'V3_DEBATE_JUDGE',
  'BULLISH_DEBATER',
  'BEARISH_DEBATER',
];

// Returns a handle whose close() always closes the CURRENT EventSource —
// after an error-triggered reconnect the original instance is stale, so
// callers must not hold a direct EventSource reference.
function openSSEWithBackoff(url, onMessage, cancelRef, backoffMs = 1000) {
  let delay = backoffMs;
  let currentEs = null;
  function connect() {
    if (cancelRef.current) return;
    const es = new EventSource(url);
    currentEs = es;
    es.onmessage = onMessage;
    es.onerror = () => {
      es.close();
      if (!cancelRef.current) {
        setTimeout(connect, Math.min(delay, 30000));
        delay = Math.min(delay * 2, 30000);
      }
    };
    es.onopen = () => { delay = backoffMs; }; // reset on success
  }
  connect();
  return {
    close() {
      if (currentEs) currentEs.close();
    },
  };
}

const INACTIVE_STATUSES = ['idle', 'done', 'error', 'stopped', 'interrupted'];
const ERROR_EMOJIS = ['❌', '⏰', '🛑', '💥'];

function isCycleActiveStatus(status) {
  return Boolean(status && !INACTIVE_STATUSES.includes(status));
}

function clearTimerMap(timerMapRef) {
  for (const timer of Object.values(timerMapRef.current)) {
    clearTimeout(timer);
  }
  timerMapRef.current = {};
}

function playWalkingBark(agentId, targetStation) {
  if (targetStation === 'debate') {
    soundManager.playSC('debate', { chance: 0.6, agentId, reason: 'heading to debate' });
  } else if (targetStation === 'exit_door') {
    soundManager.playSC('idle', { chance: 0.25, agentId, reason: 'clocking out' });
  } else {
    soundManager.playSC('move', { chance: 0.35, agentId, reason: 'on the move' });
  }
}

function playWorkingBark(agentId, station) {
  if (station === 'research') {
    soundManager.playSC('research', { chance: 0.25, agentId, reason: 'researching' });
  } else {
    soundManager.playSC('work', { chance: 0.2, agentId, reason: 'working' });
  }
}

function playTransitionSound(agentId, agentState, isNew) {
  if (isNew || agentState.state === AGENT_STATES.SPAWNING) {
    soundManager.playSC('spawn', { chance: 0.7, agentId, reason: 'reporting in' });
  } else if (agentState.state === AGENT_STATES.FIRED) {
    soundManager.playSC('fired', { agentId, reason: 'fired' });
  } else if (agentState.state === AGENT_STATES.WALKING) {
    playWalkingBark(agentId, agentState.targetStation);
  } else if (agentState.state === AGENT_STATES.WORKING) {
    playWorkingBark(agentId, agentState.station);
  }

  if (agentState.bubbleType === 'error') {
    soundManager.playSC('error', { chance: 0.8, agentId, reason: 'hit an error' });
  } else if (agentState.bubbleType === 'success') {
    soundManager.playSC('success', { chance: 0.4, agentId, reason: 'task complete' });
  }
}

function safeCanonicalTarget(richTarget) {
  if (!richTarget) return null;
  try {
    return canonicalAgentId(String(richTarget).toUpperCase());
  } catch {
    return null;
  }
}

function resolveReactionGesture(agentState, isNew) {
  if (isNew || agentState.state === AGENT_STATES.SPAWNING) return 'wave';
  if (agentState.bubbleType === 'success') return 'cheer';
  if (agentState.bubbleType === 'error') return 'facepalm';
  return null;
}

function resolveTransitionGesture(agentState, isNew, richKind, richAgent, richTarget) {
  if (richKind === 'agent_done' && richAgent) {
    const target = safeCanonicalTarget(richTarget);
    let gesture = 'report';
    if (SEALERS.has(richAgent)) gesture = 'seal';
    else if (target) gesture = 'present';
    return { gesture, talkingTo: target };
  }
  return { gesture: resolveReactionGesture(agentState, isNew), talkingTo: null };
}

function scheduleGestureCleanup(agentId, duration, gestureTimersRef, setAgents) {
  if (gestureTimersRef.current[agentId]) {
    clearTimeout(gestureTimersRef.current[agentId]);
  }
  gestureTimersRef.current[agentId] = setTimeout(() => {
    setAgents(prev => {
      if (!prev[agentId] || !prev[agentId].gesture) return prev;
      const { gesture: _g, gestureUntil: _gu, talkingTo: _tt, handoffTo: _ht, handoffAt: _ha, ...rest } = prev[agentId];
      return { ...prev, [agentId]: rest };
    });
    delete gestureTimersRef.current[agentId];
  }, duration + 100);
}

function scheduleWalkAndBubbleTimers(agentId, agentState, walkTimersRef, exitTimersRef, bubbleTimersRef, setAgents) {
  if (walkTimersRef.current[agentId]) {
    clearTimeout(walkTimersRef.current[agentId]);
    delete walkTimersRef.current[agentId];
  }
  if (exitTimersRef.current[agentId]) {
    clearTimeout(exitTimersRef.current[agentId]);
    delete exitTimersRef.current[agentId];
  }

  if (agentState.state === AGENT_STATES.WALKING && agentState.station) {
    const capturedTarget = agentState.targetStation;
    walkTimersRef.current[agentId] = setTimeout(() => {
      setAgents(prev => {
        const cur = prev[agentId];
        if (!cur || cur.state !== AGENT_STATES.WALKING || cur.targetStation !== capturedTarget) return prev;
        return { ...prev, [agentId]: arriveAgent(cur) };
      });
    }, WALK_DURATION_MS);
  }

  if (agentState.bubble) {
    if (bubbleTimersRef.current[agentId]) {
      clearTimeout(bubbleTimersRef.current[agentId]);
    }
    bubbleTimersRef.current[agentId] = setTimeout(() => {
      setAgents(prev => {
        if (!prev[agentId]) return prev;
        return { ...prev, [agentId]: clearBubble(prev[agentId]) };
      });
      delete bubbleTimersRef.current[agentId];
    }, BUBBLE_TIMEOUT_MS);
  }
}

const RICH_BARK_TABLE = {
  debate_vote: (agentId) => ({ cat: 'debate', opts: { chance: 0.4, agentId, reason: 'casting a vote' } }),
  debate_clash: (agentId) => ({ cat: 'debate', opts: { chance: 0.7, agentId, reason: 'clashing in debate' } }),
  debate_pitch: (agentId) => ({ cat: 'debate', opts: { chance: 0.3, agentId, reason: 'pitching a case' } }),
  debate_verdict: (_a, data) => ({
    cat: data.vetoed ? 'error' : 'success',
    opts: { chance: 0.6, agentId: 'V3_DEBATE_JUDGE', reason: data.vetoed ? 'verdict: vetoed' : 'verdict delivered' },
  }),
  board_convened: () => ({ cat: 'work', opts: { chance: 0.5, agentId: 'V3_BOARD_OF_DIRECTORS', reason: 'board convening' } }),
  contradiction_shadow: () => ({ cat: 'debate', opts: { chance: 0.5, agentId: 'V3_DEBATE_JUDGE', reason: 'contradiction flagged' } }),
  trade_filled: () => ({ cat: 'success', opts: { chance: 0.9, agentId: 'V3_PORTFOLIO_MANAGER', reason: 'trade executed' } }),
};

function playRichChoreographyBark(kind, data, barkAgent) {
  const builder = RICH_BARK_TABLE[kind];
  if (!builder) return;
  const { cat, opts } = builder(barkAgent, data);
  soundManager.playSC(cat, opts);
}

function buildVerdictVoiceQuote(data, ticker) {
  if (data.vetoed) {
    return `${ticker}: the jury has vetoed. Trade blocked for excessive risk.`;
  }
  return `${ticker}: verdict is ${data.action} at ${data.confidence} percent. Winner, the ${data.winning_side} case.`;
}

function buildTradeFilledQuote(data, ticker) {
  if (data.side && data.qty) {
    return `${String(data.side).toUpperCase()} ${data.qty} ${ticker}. Order filled.`;
  }
  return `${ticker}: order filled.`;
}

function buildRichVoiceLine(kind, data, primaryOe) {
  const ticker = data.ticker || '';
  if (kind === 'agent_done' && HIGH_SIGNAL_SPEAKERS.has(data.agent) && data.summary) {
    return { agentId: primaryOe.agentId, quote: data.summary };
  }
  if (kind === 'debate_verdict') {
    return { agentId: 'V3_DEBATE_JUDGE', quote: buildVerdictVoiceQuote(data, ticker) };
  }
  if (kind === 'board_convened') {
    const chair = data.persona ? `. Chair: ${data.persona}` : '';
    return { agentId: 'V3_BOARD_OF_DIRECTORS', quote: `Convening the board on ${ticker}${chair}.` };
  }
  if (kind === 'trade_filled') {
    return { agentId: 'V3_PORTFOLIO_MANAGER', quote: buildTradeFilledQuote(data, ticker) };
  }
  if (kind === 'contradiction_shadow' && data.summary) {
    return { agentId: 'V3_DEBATE_JUDGE', quote: `Noting a contradiction on ${ticker}. ${data.summary}` };
  }
  return null;
}

function seedPipelineAgents(prevAgents) {
  let updated = { ...prevAgents };
  for (const agentId of PIPELINE_AGENTS) {
    if (updated[agentId]) continue;
    const home = getHomeStation(agentId, true);
    if (!home) continue;
    updated = processEvent(updated, {
      type: `${home}_start`,
      agentId,
      station: home,
      tool: null,
      label: `${agentId} standing by`,
      status: 'start',
      ts: Date.now(),
    });
  }
  return updated;
}

function applyReportListenerGesture(updated, rawEvent, officeEvents, gestureTimersRef, setAgents) {
  const rd = rawEvent.data;
  if (!rd || rd.kind !== 'agent_done' || !rd.target || !officeEvents[0]) return;
  const listenerId = safeCanonicalTarget(rd.target);
  const reporterId = officeEvents[0].agentId;
  if (!listenerId || listenerId === reporterId || !updated[listenerId]) return;

  const dur = GESTURE_DURATIONS.listen || GESTURE_DURATION_MS;
  updated[listenerId] = {
    ...updated[listenerId],
    gesture: 'listen',
    gestureUntil: Date.now() + dur,
    talkingTo: reporterId,
  };
  if (gestureTimersRef.current[listenerId]) clearTimeout(gestureTimersRef.current[listenerId]);
  gestureTimersRef.current[listenerId] = setTimeout(() => {
    setAgents(prev => {
      if (!prev[listenerId] || prev[listenerId].gesture !== 'listen') return prev;
      const { gesture: _g, gestureUntil: _gu, talkingTo: _tt, ...rest } = prev[listenerId];
      return { ...prev, [listenerId]: rest };
    });
    delete gestureTimersRef.current[listenerId];
  }, dur + 100);
}

function isHistoricalBatch(newEvents, now) {
  if (newEvents.length === 0) return false;
  return newEvents.every(ev => {
    const evTs = ev.ts ? Date.parse(ev.ts) : 0;
    return evTs > 0 && (now - evTs) > 30000;
  });
}

function rebaseOrGarbageCollectAgents(updated, newEvents, walkTimersRef, exitTimersRef) {
  const now = Date.now();
  if (isHistoricalBatch(newEvents, now)) {
    for (const [id, agent] of Object.entries(updated)) {
      if (id !== 'system') {
        updated[id] = { ...agent, lastActionTime: now };
      }
    }
    return;
  }

  for (const [id, agent] of Object.entries(updated)) {
    if (id === 'system' || getHomeStation(id, true)) continue;
    const elapsed = now - (agent.lastActionTime || 0);
    const expireMs = agent.state === AGENT_STATES.WORKING ? 120000 : 15000;
    if (elapsed > expireMs) {
      releaseSlot(agent.station, agent.slot);
      delete updated[id];
      if (walkTimersRef.current[id]) clearTimeout(walkTimersRef.current[id]);
      if (exitTimersRef.current[id]) clearTimeout(exitTimersRef.current[id]);
    }
  }
}

function processSingleRawEvent(updated, rawEvent, applyTimers, emitRichFeedback, gestureTimersRef, setAgents) {
  const officeEvents = mapEvent(rawEvent);
  for (const oe of officeEvents) {
    const isNewAgent = !updated[oe.agentId];
    updated = processEvent(updated, oe);
    if (oe.skipped && updated[oe.agentId]?.bubbleType === 'success') {
      updated[oe.agentId] = { ...updated[oe.agentId], bubbleType: 'info' };
    }
    applyTimers(oe.agentId, updated[oe.agentId], {
      isNew: isNewAgent,
      richKind: rawEvent.data?.kind,
      richAgent: rawEvent.data?.agent,
      richTarget: rawEvent.data?.target,
    });
    if (oe.station) {
      demandTracker.recordEvent(oe.station);
    }
  }
  applyReportListenerGesture(updated, rawEvent, officeEvents, gestureTimersRef, setAgents);
  emitRichFeedback(rawEvent, officeEvents[0]);
  return updated;
}

function parseSystemStreamLog(log) {
  if (!log || log.subsystem !== 'AGENT' || !log.message) return null;
  let rawAgent = null;
  let body = log.message;
  const bracketMatch = log.message.match(/^\[([^\]]+)\]\s+(.*)$/);
  if (bracketMatch) {
    rawAgent = bracketMatch[1];
    body = bracketMatch[2];
  } else {
    const v3Match = log.message.match(/^(?:🔬|✅|❌|⏰|🛑|💥)\s+[^:]+:\s+V3\s+([^\s]+)\s+(.*)$/);
    if (!v3Match) return null;
    rawAgent = v3Match[1];
  }
  const agentId = canonicalAgentId(cleanAgentId(rawAgent));
  return agentId ? { agentId, body } : null;
}

function isStartBody(body) {
  return body.includes('Starting agent execution') || body.includes('Starting local agent loop') || body.includes('starting...');
}

function isReasoningBody(body) {
  return body.includes('Executing LLM reasoning step') || body.includes('reasoning step');
}

function isToolContextBody(body) {
  return body.includes('Selecting optimal tools') || body.includes('Pruning tool context') || body.includes('Pruning context');
}

function isFinishBody(body) {
  if (body.includes('Finished successfully') || body.includes('Completed local agent loop') || body.includes('✅')) {
    return true;
  }
  return ERROR_EMOJIS.some(emoji => body.includes(emoji));
}

function isExecutionFailedBody(body) {
  return body.includes('Execution failed') || body.includes('Execution timed out') || body.includes('failed via Prism');
}

function buildToolExecutionEvent(agentId, body) {
  const toolMatch = body.match(/(?:Requesting|Executed) tool '([^']+)'/);
  if (!toolMatch) return null;
  const tool = toolMatch[1];
  const station = getStationForAgentOrTool(agentId, tool);
  const isStart = body.includes('Requesting tool');
  const lower = body.toLowerCase();
  const isError = lower.includes('failed') || lower.includes('error');
  const suffix = isStart ? 'start' : (isError ? 'error' : 'done');
  const verb = isStart ? 'executing' : (isError ? 'failed' : 'completed');
  return {
    type: `${station}_${suffix}`,
    agentId,
    station,
    tool,
    label: `${agentId} ${verb} ${tool}`,
    status: suffix,
    ts: Date.now(),
  };
}

function buildFinishEvent(agentId, body, homeStation) {
  const station = homeStation || 'smoke_break';
  const isError = ERROR_EMOJIS.some(emoji => body.includes(emoji));
  const suffix = isError ? 'error' : 'done';
  return {
    mappedEvent: {
      type: `${station}_${suffix}`,
      agentId,
      station,
      tool: null,
      label: `${agentId} ${isError ? 'failed' : 'completed'} run`,
      status: suffix,
      ts: Date.now(),
    },
    eligibleForSmokeBreak: !homeStation && !isError,
  };
}

function mapSystemLogBodyToEvent(agentId, body, homeStation) {
  const defaultStation = homeStation || 'research';
  if (isStartBody(body)) {
    return { mappedEvent: { type: `${defaultStation}_start`, agentId, station: defaultStation, tool: 'LLM thinking', label: `${agentId} starting execution`, status: 'start', ts: Date.now() }, eligibleForSmokeBreak: false };
  }
  if (isReasoningBody(body)) {
    return { mappedEvent: { type: `${defaultStation}_start`, agentId, station: defaultStation, tool: 'LLM thinking', label: `${agentId} reasoning...`, status: 'start', ts: Date.now() }, eligibleForSmokeBreak: false };
  }
  if (body.includes('Requesting tool') || body.includes('Executed tool')) {
    return { mappedEvent: buildToolExecutionEvent(agentId, body), eligibleForSmokeBreak: false };
  }
  if (isToolContextBody(body)) {
    return { mappedEvent: { type: `${defaultStation}_start`, agentId, station: defaultStation, tool: 'Selecting tools', label: `${agentId} optimizing context`, status: 'start', ts: Date.now() }, eligibleForSmokeBreak: false };
  }
  if (body.includes('Delegating agentic loop to Prism')) {
    return { mappedEvent: { type: 'inbox_start', agentId, station: 'inbox', tool: 'Delegating', label: `${agentId} delegating to Prism`, status: 'start', ts: Date.now() }, eligibleForSmokeBreak: false };
  }
  if (isFinishBody(body)) {
    return buildFinishEvent(agentId, body, homeStation);
  }
  if (isExecutionFailedBody(body)) {
    return { mappedEvent: { type: 'error_error', agentId, station: 'error', tool: 'error', label: `${agentId} execution failed`, status: 'error', ts: Date.now() }, eligibleForSmokeBreak: false };
  }
  if (body.includes('Fired due to poor performance') || body.includes('Agent fired')) {
    return { mappedEvent: { type: 'window_error', agentId, station: 'window', tool: 'error', label: `${agentId} fired!`, status: 'error', ts: Date.now() }, eligibleForSmokeBreak: false };
  }
  return { mappedEvent: null, eligibleForSmokeBreak: false };
}

function maybeScheduleSmokeBreak(agentId, eligible, taskCountRef, cancelled, setAgents, applyTimers) {
  if (!eligible) return;
  taskCountRef.current[agentId] = (taskCountRef.current[agentId] || 0) + 1;
  if (taskCountRef.current[agentId] < SMOKE_BREAK_MIN_TASKS || Math.random() >= SMOKE_BREAK_CHANCE) return;
  taskCountRef.current[agentId] = 0;
  setTimeout(() => {
    if (cancelled.current) return;
    setAgents(prevAgents => {
      const smokeEvent = { type: 'smoke_break_start', agentId, station: 'smoke_break', tool: 'break', label: `${agentId} taking a break`, status: 'start', ts: Date.now() };
      const updated = processEvent({ ...prevAgents }, smokeEvent);
      applyTimers(agentId, updated[agentId]);
      return updated;
    });
  }, 500);
}

function resolveAdvocateAgentId(agentId) {
  if (agentId === 'BEARISH_DEBATER') return 'BULLISH_DEBATER';
  if (agentId === 'system') return 'advocate';
  return 'BEARISH_DEBATER';
}

function applyMappedSystemEvent(prevAgents, mappedEvent, applyTimers) {
  let updated = processEvent({ ...prevAgents }, mappedEvent);
  applyTimers(mappedEvent.agentId, updated[mappedEvent.agentId]);
  if (mappedEvent.station === 'debate') {
    const advocateId = resolveAdvocateAgentId(mappedEvent.agentId);
    const advEvent = {
      ...mappedEvent,
      agentId: advocateId,
      tool: mappedEvent.tool === 'consensus' ? '🐻 COUNTER' : mappedEvent.tool,
      label: `${advocateId}: counter-argument`,
    };
    updated = processEvent(updated, advEvent);
    applyTimers(advocateId, updated[advocateId]);
  }
  return updated;
}

function stepNonHomeAgentExpiration(id, agent, updated, now, exitTimersRef, setAgents) {
  if (agent.state === AGENT_STATES.EXITING) {
    releaseSlot(agent.station, agent.slot);
    delete updated[id];
    return true;
  }
  if (agent.station === 'exit_door' || agent.targetStation === 'exit_door') return false;
  const elapsed = now - (agent.lastActionTime || 0);
  const expireMs = agent.state === AGENT_STATES.WORKING ? 120000 : 15000;
  if (elapsed <= expireMs || agent.state === AGENT_STATES.WALKING) return false;

  const moved = moveAgent({ ...agent, id }, 'exit_door', null, 'exit', 'done');
  updated[id] = { ...agent, ...moved, state: AGENT_STATES.WALKING, targetStation: 'exit_door' };
  if (exitTimersRef.current[id]) clearTimeout(exitTimersRef.current[id]);
  exitTimersRef.current[id] = setTimeout(() => {
    setAgents(curr => (curr[id] ? { ...curr, [id]: arriveAgent(curr[id]) } : curr));
    delete exitTimersRef.current[id];
  }, WALK_DURATION_MS);
  return true;
}

function stepHomeAgentIdleReset(id, agent, home, updated, now, isRunning) {
  if (!isRunning || agent.state === AGENT_STATES.EXITING || agent.state === AGENT_STATES.FIRED) return false;
  const elapsed = now - (agent.lastActionTime || 0);
  if (elapsed <= 5 * 60 * 1000) return false;
  if (agent.station === home && agent.state === AGENT_STATES.IDLE) return false;
  releaseSlot(agent.station, agent.slot);
  const newSlot = claimSlot(home);
  updated[id] = { ...agent, station: home, state: AGENT_STATES.IDLE, slot: newSlot, lastActionTime: now };
  return true;
}

function tickIdleAgentGC(prev, isRunning, exitTimersRef, setAgents) {
  const now = Date.now();
  let changed = false;
  const updated = { ...prev };
  for (const [id, agent] of Object.entries(updated)) {
    if (id === 'system') continue;
    const home = getHomeStation(id, true);
    if (!home) {
      if (stepNonHomeAgentExpiration(id, agent, updated, now, exitTimersRef, setAgents)) changed = true;
    } else if (stepHomeAgentIdleReset(id, agent, home, updated, now, isRunning)) {
      changed = true;
    }
  }
  return changed ? updated : prev;
}

function runCycleEndCelebration(status, setAgents, cycleEndTimersRef) {
  soundManager.playSC(status === 'done' ? 'success' : 'error', {
    agentId: 'system',
    reason: status === 'done' ? 'cycle complete' : 'cycle failed',
  });
  const endGesture = status === 'done' ? 'cheer' : 'facepalm';
  setAgents(prev => {
    const updated = {};
    const gestureUntil = Date.now() + GESTURE_DURATION_MS;
    for (const [id, agent] of Object.entries(prev)) {
      updated[id] = agent.state === AGENT_STATES.WALKING ? agent : { ...agent, gesture: endGesture, gestureUntil };
    }
    return updated;
  });
  cycleEndTimersRef.current.push(setTimeout(() => {
    setAgents(prev => {
      const updated = {};
      for (const [id, agent] of Object.entries(prev)) {
        const { gesture: _g, gestureUntil: _gu, ...rest } = agent;
        updated[id] = agent.station !== 'smoke_break'
          ? moveAgent(rest, 'smoke_break', null, 'break', 'done')
          : { ...rest, state: AGENT_STATES.WORKING, station: 'smoke_break' };
      }
      return updated;
    });
  }, GESTURE_DURATION_MS));
  cycleEndTimersRef.current.push(setTimeout(() => {
    setAgents(prev => {
      const updated = {};
      for (const [id, agent] of Object.entries(prev)) {
        updated[id] = arriveAgent(agent);
      }
      return updated;
    });
  }, GESTURE_DURATION_MS + WALK_DURATION_MS + 500));
}

async function fetchOverridesMap() {
  try {
    const res = await fetch('/api/agent-overrides');
    if (!res.ok) return {};
    const data = await res.json();
    return data.overrides || {};
  } catch {
    return {};
  }
}

async function revertSingleOverrideIfIdle(agentId, override, setAgents) {
  if (!override.defaultRoom) return;
  const currentDemand = demandTracker.getDemand(override.room);
  const homeDemand = demandTracker.getDemand(override.defaultRoom);
  if (currentDemand !== 0 || homeDemand <= 0) return;
  try {
    await fetch('/api/agent-overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, _delete: true }),
    });
  } catch {
    return;
  }
  setAgents(prev => {
    const agent = prev[agentId];
    if (!agent) return prev;
    const moved = moveAgent(
      agent,
      override.defaultRoom,
      'auto_revert',
      `Heading back — no work in ${override.room.replace('_', ' ')}`,
      'start'
    );
    return { ...prev, [agentId]: moved };
  });
}

async function checkAndRevertOverrides(setAgents) {
  const overrides = await fetchOverridesMap();
  for (const [agentId, override] of Object.entries(overrides)) {
    await revertSingleOverrideIfIdle(agentId, override, setAgents);
  }
}

async function loadPersistedOverrides(setAgents) {
  const overrides = await fetchOverridesMap();
  const entries = Object.entries(overrides);
  if (entries.length === 0) return;
  setAgents(prev => {
    const updated = { ...prev };
    for (const [agentId, override] of entries) {
      const agent = updated[agentId];
      if (agent && agent.station !== override.room) {
        updated[agentId] = moveAgent(
          agent,
          override.room,
          'override_loaded',
          `Resuming override at ${override.room.replace('_', ' ')}`,
          'start'
        );
      }
    }
    return updated;
  });
}

export function useAgentEvents(events, status, { onVoiceEvent } = {}) {
  const [agents, setAgents] = useState({});
  const isRunning = isCycleActiveStatus(status);
  const isRunningRef = useRef(isRunning);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);

  const processedCountRef = useRef(0);
  const walkTimersRef = useRef({});
  const exitTimersRef = useRef({});
  const bubbleTimersRef = useRef({});
  const gestureTimersRef = useRef({});
  const idleTimerRef = useRef(null);
  const taskCountRef = useRef({});
  const lastVoiceAtRef = useRef(0);
  const resetGuardStatusRef = useRef(status);
  const cycleEndStatusRef = useRef(status);
  const cycleEndTimersRef = useRef([]);

  const mountedRef = useRef(false);
  const [sceneMounted, setSceneMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      mountedRef.current = true;
      setSceneMounted(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const applyTimers = useCallback((agentId, agentState, { isNew = false, richKind = null, richAgent = null, richTarget = null } = {}) => {
    if (!agentState) return;
    playTransitionSound(agentId, agentState, isNew);

    const { gesture, talkingTo } = resolveTransitionGesture(agentState, isNew, richKind, richAgent, richTarget);
    if (gesture && agentState.state !== AGENT_STATES.WALKING) {
      const duration = GESTURE_DURATIONS[gesture] || GESTURE_DURATION_MS;
      agentState.gesture = gesture;
      agentState.gestureUntil = Date.now() + duration;
      if (talkingTo) {
        agentState.talkingTo = talkingTo;
        agentState.handoffTo = talkingTo;
        agentState.handoffAt = Date.now();
      }
      scheduleGestureCleanup(agentId, duration, gestureTimersRef, setAgents);
    }

    scheduleWalkAndBubbleTimers(agentId, agentState, walkTimersRef, exitTimersRef, bubbleTimersRef, setAgents);
  }, []);

  const emitRichFeedback = useCallback((rawEvent, primaryOe) => {
    const data = rawEvent?.data;
    if (!data || !data.kind || !primaryOe) return;
    const evTs = rawEvent.ts ? Date.parse(rawEvent.ts) : Date.now();
    if (Date.now() - evTs > 30000) return;

    playRichChoreographyBark(data.kind, data, primaryOe.agentId);
    if (!onVoiceEvent) return;

    const voiceLine = buildRichVoiceLine(data.kind, data, primaryOe);
    if (!voiceLine) return;

    const now = Date.now();
    if (now - lastVoiceAtRef.current < VOICE_MIN_GAP_MS) return;
    lastVoiceAtRef.current = now;
    const voiceEvent = { type: 'agent_voice', agentId: voiceLine.agentId, quote: voiceLine.quote };
    setTimeout(() => onVoiceEvent(voiceEvent), 0);
  }, [onVoiceEvent]);

  useEffect(() => {
    return () => {
      clearTimerMap(walkTimersRef);
      clearTimerMap(exitTimersRef);
      clearTimerMap(bubbleTimersRef);
      clearTimerMap(gestureTimersRef);
      for (const timer of cycleEndTimersRef.current) clearTimeout(timer);
      cycleEndTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if ((status === 'idle' || status === 'starting') && resetGuardStatusRef.current !== status) {
      setAgents({});
      processedCountRef.current = 0;
      resetOccupancy();
      taskCountRef.current = {};
      demandTracker.reset();
      clearTimerMap(walkTimersRef);
      clearTimerMap(exitTimersRef);
      clearTimerMap(bubbleTimersRef);
      clearTimerMap(gestureTimersRef);
    }

    const wasIdle = INACTIVE_STATUSES.includes(resetGuardStatusRef.current);
    if (wasIdle && isCycleActiveStatus(status)) {
      setAgents(seedPipelineAgents);
    }
    resetGuardStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!events || events.length === 0) return;
    if (!mountedRef.current) {
      const raf = requestAnimationFrame(() => { processedCountRef.current = 0; });
      return () => cancelAnimationFrame(raf);
    }
    if (events.length < processedCountRef.current) {
      processedCountRef.current = 0;
    }
    const newEvents = events.slice(processedCountRef.current);
    if (newEvents.length === 0) return;
    processedCountRef.current = events.length;

    setAgents(prevAgents => {
      let updated = { ...prevAgents };
      for (const rawEvent of newEvents) {
        updated = processSingleRawEvent(updated, rawEvent, applyTimers, emitRichFeedback, gestureTimersRef, setAgents);
      }
      rebaseOrGarbageCollectAgents(updated, newEvents, walkTimersRef, exitTimersRef);
      return updated;
    });
  }, [events, sceneMounted, applyTimers, emitRichFeedback]);

  useEffect(() => {
    if (!isRunning || !mountedRef.current) return;
    const cancelled = { current: false };
    let es = null;
    try {
      es = openSSEWithBackoff('/api/v1/system/stream', (e) => {
        if (cancelled.current) return;
        try {
          const parsed = parseSystemStreamLog(JSON.parse(e.data));
          if (!parsed) return;
          const homeStation = getHomeStation(parsed.agentId, true);
          const { mappedEvent, eligibleForSmokeBreak } = mapSystemLogBodyToEvent(parsed.agentId, parsed.body, homeStation);
          maybeScheduleSmokeBreak(parsed.agentId, eligibleForSmokeBreak, taskCountRef, cancelled, setAgents, applyTimers);
          if (mappedEvent) {
            setAgents(prevAgents => applyMappedSystemEvent(prevAgents, mappedEvent, applyTimers));
          }
        } catch {}
      }, cancelled);
    } catch {}

    return () => {
      cancelled.current = true;
      if (es) es.close();
    };
  }, [isRunning, sceneMounted, applyTimers]);

  useEffect(() => {
    if (idleTimerRef.current) clearInterval(idleTimerRef.current);
    idleTimerRef.current = setInterval(() => {
      setAgents(prev => tickIdleAgentGC(prev, isRunningRef.current, exitTimersRef, setAgents));
    }, 2000);
    return () => clearInterval(idleTimerRef.current);
  }, []);

  useEffect(() => {
    const isDone = status === 'done' || status === 'error';
    const wasDone = cycleEndStatusRef.current === 'done' || cycleEndStatusRef.current === 'error';
    if (!isDone && wasDone) {
      for (const timer of cycleEndTimersRef.current) clearTimeout(timer);
      cycleEndTimersRef.current = [];
    }
    if (isDone && !wasDone) {
      runCycleEndCelebration(status, setAgents, cycleEndTimersRef);
    }
    cycleEndStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!isRunning) resetOccupancy();
  }, [isRunning]);

  useEffect(() => {
    const interval = setInterval(() => { checkAndRevertOverrides(setAgents); }, 30_000);
    return () => clearInterval(interval);
  }, [setAgents]);

  useEffect(() => {
    const timer = setTimeout(() => { loadPersistedOverrides(setAgents); }, 2000);
    return () => clearTimeout(timer);
  }, [setAgents]);

  return { agents, setAgents, isRunning };
}
