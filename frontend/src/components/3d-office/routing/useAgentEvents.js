import { useState, useEffect, useRef, useCallback } from 'react';
import { processEvent, arriveAgent, moveAgent, releaseSlot, resetOccupancy, AGENT_STATES, clearBubble, claimSlot } from './stateMachine';
import { mapEvent, mapPrismEvent, isPrismWebhookEvent } from '../../agent-office/shared';
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

export function useAgentEvents(events, status, { onVoiceEvent } = {}) {
  const [agents, setAgents] = useState({});
  const isRunning = status && !['idle', 'done', 'error', 'stopped', 'interrupted'].includes(status);
  // Live mirror for mount-once intervals (the 2s GC below) — capturing
  // isRunning directly in that closure froze its first-render value.
  const isRunningRef = useRef(isRunning);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  
  const processedCountRef = useRef(0);
  const walkTimersRef = useRef({});
  const exitTimersRef = useRef({});
  const bubbleTimersRef = useRef({});
  const gestureTimersRef = useRef({});
  const idleTimerRef = useRef(null);
  const taskCountRef = useRef({}); // Track completed tasks per agent for smoke break
  const lastVoiceAtRef = useRef(0); // Throttle live TTS triggers (see emitRichFeedback)
  const resetGuardStatusRef = useRef(status); // For reset guard (separate from cycle-end ref)

  // ── Scene mount guard ──
  // On cold remount (hard refresh), the Canvas/DOM isn't ready on the first
  // render frame. We wait one rAF before processing events or opening SSE.
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

    // ── StarCraft SFX — react to the state transition we just applied.
    // playSC has per-category cooldowns + probability gates, so a busy
    // office stays lively without becoming a cacophony.
    // `isNew` fires on genuine agent creation: processEvent transitions a
    // freshly-created agent out of SPAWNING (into WALKING/WORKING) in the same
    // tick, so keying the spawn bark off the committed state almost never hit.
    if (isNew || agentState.state === AGENT_STATES.SPAWNING) {
      soundManager.playSC('spawn', { chance: 0.7 });
    } else if (agentState.state === AGENT_STATES.FIRED) {
      soundManager.playSC('fired');
    } else if (agentState.state === AGENT_STATES.WALKING) {
      if (agentState.targetStation === 'debate') soundManager.playSC('debate', { chance: 0.6 });
      else if (agentState.targetStation === 'exit_door') soundManager.playSC('idle', { chance: 0.25 });
      else soundManager.playSC('move', { chance: 0.35 });
    } else if (agentState.state === AGENT_STATES.WORKING && agentState.station === 'research') {
      soundManager.playSC('research', { chance: 0.25 });
    } else if (agentState.state === AGENT_STATES.WORKING) {
      soundManager.playSC('work', { chance: 0.2 });
    }
    if (agentState.bubbleType === 'error') soundManager.playSC('error', { chance: 0.8 });
    else if (agentState.bubbleType === 'success') soundManager.playSC('success', { chance: 0.4 });

    // ── Gesture — a visible pose for the same transition the bark announces,
    // so the office reads accurately even between barks. Stamped directly on
    // the not-yet-committed agent object (we're inside the setAgents updater),
    // cleared by timer like bubbles.
    // Structured paperwork gestures (report/seal) take priority over the
    // reaction gestures; an agent finishing its analysis is literally writing a
    // report / sealing a verdict, which reads better than a generic cheer.
    let gesture = null;
    let talkingTo = null;
    if (richKind === 'agent_done' && richAgent) {
      gesture = SEALERS.has(richAgent) ? 'seal' : 'report';
      // Face the colleague this agent reports to while presenting its work.
      if (richTarget) {
        try { talkingTo = canonicalAgentId(String(richTarget).toUpperCase()); } catch { talkingTo = null; }
      }
    }
    if (!gesture) {
      if (isNew || agentState.state === AGENT_STATES.SPAWNING) gesture = 'wave';
      else if (agentState.bubbleType === 'success') gesture = 'cheer';
      else if (agentState.bubbleType === 'error') gesture = 'facepalm';
    }

    if (gesture && agentState.state !== AGENT_STATES.WALKING) {
      const duration = GESTURE_DURATIONS[gesture] || GESTURE_DURATION_MS;
      agentState.gesture = gesture;
      agentState.gestureUntil = Date.now() + duration;
      if (talkingTo) agentState.talkingTo = talkingTo;
      if (gestureTimersRef.current[agentId]) clearTimeout(gestureTimersRef.current[agentId]);
      gestureTimersRef.current[agentId] = setTimeout(() => {
        setAgents(prev => {
          if (!prev[agentId] || !prev[agentId].gesture) return prev;
          const { gesture: _g, gestureUntil: _gu, talkingTo: _tt, ...rest } = prev[agentId];
          return { ...prev, [agentId]: rest };
        });
        delete gestureTimersRef.current[agentId];
      }, duration + 100);
    }

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
          if (!prev[agentId]) return prev;
          if (prev[agentId].state !== AGENT_STATES.WALKING) return prev;
          if (prev[agentId].targetStation !== capturedTarget) return prev;
          return { ...prev, [agentId]: arriveAgent(prev[agentId]) };
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
  }, []);

  // ── Live voice + SFX for Phase-1 structured events ──
  // The polled feed now carries the backend's `data.kind` payloads (agent_done,
  // debate_*, board_convened). Turn the high-signal ones into spoken TTS lines
  // (via the same onVoiceEvent path the dead prism SSE used to feed) plus extra
  // StarCraft barks for debate/board beats. This is what makes agents "talk".
  const emitRichFeedback = useCallback((rawEvent, primaryOe) => {
    const data = rawEvent?.data;
    if (!data || !data.kind || !primaryOe) return;
    const kind = data.kind;

    // Only the live tail should react — a historical replay batch stays silent.
    const evTs = rawEvent.ts ? Date.parse(rawEvent.ts) : Date.now();
    if (Date.now() - evTs > 30000) return;

    // Extra StarCraft barks for the debate/board choreography.
    if (kind === 'debate_vote') soundManager.playSC('debate', { chance: 0.4 });
    else if (kind === 'debate_clash') soundManager.playSC('debate', { chance: 0.7 });
    else if (kind === 'debate_verdict') soundManager.playSC(data.vetoed ? 'error' : 'success', { chance: 0.6 });
    else if (kind === 'board_convened') soundManager.playSC('work', { chance: 0.5 });

    // Spoken TTS — decision-makers only, throttled so the queue never backs up.
    if (!onVoiceEvent) return;
    let agentId = null;
    let quote = null;
    const ticker = data.ticker || '';
    if (kind === 'agent_done' && HIGH_SIGNAL_SPEAKERS.has(data.agent) && data.summary) {
      agentId = primaryOe.agentId;
      quote = data.summary;
    } else if (kind === 'debate_verdict') {
      agentId = 'V3_DEBATE_JUDGE';
      quote = data.vetoed
        ? `${ticker}: the jury has vetoed. Trade blocked for excessive risk.`
        : `${ticker}: verdict is ${data.action} at ${data.confidence} percent. Winner, the ${data.winning_side} case.`;
    } else if (kind === 'board_convened') {
      agentId = 'V3_BOARD_OF_DIRECTORS';
      quote = `Convening the board on ${ticker}${data.persona ? `. Chair: ${data.persona}` : ''}.`;
    }
    if (!agentId || !quote) return;

    const now = Date.now();
    if (now - lastVoiceAtRef.current < VOICE_MIN_GAP_MS) return;
    lastVoiceAtRef.current = now;
    // emitRichFeedback runs inside the setAgents updater; handleVoiceEvent calls
    // setAgents itself, so defer it out of the current update to avoid nesting.
    const voiceEvent = { type: 'agent_voice', agentId, quote };
    setTimeout(() => onVoiceEvent(voiceEvent), 0);
  }, [onVoiceEvent]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of Object.values(walkTimersRef.current)) clearTimeout(timer);
      for (const timer of Object.values(exitTimersRef.current)) clearTimeout(timer);
      for (const timer of Object.values(bubbleTimersRef.current)) clearTimeout(timer);
      for (const timer of Object.values(gestureTimersRef.current)) clearTimeout(timer);
    };
  }, []);

  // ── Known pipeline agent roles to pre-seed at their home stations ──

  // ── Reset on new cycle (matches 2D AgentOffice pattern) ──
  useEffect(() => {
    if (status === 'idle' || status === 'starting') {
      if (resetGuardStatusRef.current !== status) {
        setAgents({});
        processedCountRef.current = 0;
        resetOccupancy();
        taskCountRef.current = {};
        demandTracker.reset();
        // Clear all walk/exit timers
        for (const timer of Object.values(walkTimersRef.current)) clearTimeout(timer);
        for (const timer of Object.values(exitTimersRef.current)) clearTimeout(timer);
        for (const timer of Object.values(bubbleTimersRef.current)) clearTimeout(timer);
        for (const timer of Object.values(gestureTimersRef.current)) clearTimeout(timer);
        walkTimersRef.current = {};
        exitTimersRef.current = {};
        bubbleTimersRef.current = {};
        gestureTimersRef.current = {};
      }
    }

    // Pre-seed known pipeline agents when a cycle starts so they're
    // visible in the 3D office before any events arrive for them.
    const wasIdle = ['idle', 'done', 'error', 'stopped', 'interrupted'].includes(resetGuardStatusRef.current);
    const isActive = status && !['idle', 'done', 'error', 'stopped', 'interrupted'].includes(status);
    if (wasIdle && isActive) {
      setAgents(prev => {
        let updated = { ...prev };
        for (const agentId of PIPELINE_AGENTS) {
          if (updated[agentId]) continue; // Already exists
          const home = getHomeStation(agentId, true);
          if (!home) continue;
          const agent = processEvent(updated, {
            type: `${home}_start`,
            agentId,
            station: home,
            tool: null,
            label: `${agentId} standing by`,
            status: 'start',
            ts: Date.now(),
          });
          updated = agent;
        }
        return updated;
      });
    }

    resetGuardStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!events || events.length === 0) return;

    // Guard: if the scene hasn't mounted yet (cold remount), wait one frame
    if (!mountedRef.current) {
      const raf = requestAnimationFrame(() => {
        // Re-trigger by resetting processedCountRef so this effect re-runs
        processedCountRef.current = 0;
      });
      return () => cancelAnimationFrame(raf);
    }
    
    // If the events array shrunk, we probably started a new cycle
    if (events.length < processedCountRef.current) {
      processedCountRef.current = 0;
    }
    
    const newEvents = events.slice(processedCountRef.current);
    if (newEvents.length === 0) return;
    processedCountRef.current = events.length;

    setAgents(prevAgents => {
      let updated = { ...prevAgents };
      for (const rawEvent of newEvents) {
        const officeEvents = mapEvent(rawEvent);
        for (const oe of officeEvents) {
          const isNewAgent = !updated[oe.agentId];
          updated = processEvent(updated, oe);
          // Triage-skipped work must not celebrate — neutralize the success
          // bubble before applyTimers fires barks/cheer gestures off it.
          if (oe.skipped && updated[oe.agentId]?.bubbleType === 'success') {
            updated[oe.agentId] = { ...updated[oe.agentId], bubbleType: 'info' };
          }
          applyTimers(oe.agentId, updated[oe.agentId], {
            isNew: isNewAgent,
            // Structured payload drives paperwork gestures + who-reports-to-whom.
            richKind: rawEvent.data?.kind,
            richAgent: rawEvent.data?.agent,
            richTarget: rawEvent.data?.target,
          });
          // Feed demand tracker for smart auto-revert
          if (oe.station) {
            demandTracker.recordEvent(oe.station);
          }
        }
        // Report hand-off: when an agent finishes and reports to a colleague,
        // that colleague turns to listen (mutual facing = "talking to each other").
        const rd = rawEvent.data;
        if (rd && rd.kind === 'agent_done' && rd.target && officeEvents[0]) {
          let listenerId = null;
          try { listenerId = canonicalAgentId(String(rd.target).toUpperCase()); } catch { listenerId = null; }
          const reporterId = officeEvents[0].agentId;
          if (listenerId && listenerId !== reporterId && updated[listenerId]) {
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
        }
        // Live voice + SFX from the structured payload — once per raw event so
        // e.g. a debate verdict speaks a single time, not once per office event.
        emitRichFeedback(rawEvent, officeEvents[0]);
      }

      // Determine if this is a historical batch (all events are older than 30s).
      // If so, we're loading a completed cycle's events and should NOT instantly
      // delete agents — rebase their timestamps to "now" so they appear on the floor.
      const now = Date.now();
      const HISTORICAL_THRESHOLD_MS = 30000;
      const allHistorical = newEvents.length > 0 && newEvents.every(ev => {
        const evTs = ev.ts ? Date.parse(ev.ts) : 0;
        return evTs > 0 && (now - evTs) > HISTORICAL_THRESHOLD_MS;
      });

      if (allHistorical) {
        // Rebase all agent timestamps to now so they render at their final stations
        for (const [id, agent] of Object.entries(updated)) {
          if (id === 'system') continue;
          updated[id] = { ...agent, lastActionTime: now };
        }
      } else {
        // Normal real-time GC: remove agents that have been idle too long
        for (const [id, agent] of Object.entries(updated)) {
          if (id === 'system') continue;

          // Skip agents with dedicated home stations — they persist for
          // the entire cycle and are managed by the interval-based GC instead.
          if (getHomeStation(id, true)) continue;

          const elapsed = now - (agent.lastActionTime || 0);
          let expireMs = agent.state === AGENT_STATES.WORKING ? 120000 : 15000;
          
          if (elapsed > expireMs) {
            releaseSlot(agent.station, agent.slot);
            delete updated[id];
            if (walkTimersRef.current[id]) clearTimeout(walkTimersRef.current[id]);
            if (exitTimersRef.current[id]) clearTimeout(exitTimersRef.current[id]);
          }
        }
      }

      return updated;
    });
  }, [events, sceneMounted, applyTimers, emitRichFeedback]);

  useEffect(() => {
    if (!isRunning) return;
    // Guard: don't open SSE until the scene has mounted
    if (!mountedRef.current) return;
    let es = null;
    let cancelled = { current: false };
    const url = '/api/v1/system/stream';
    
    try {
      es = openSSEWithBackoff(url, (e) => {
        if (cancelled.current) return;
        try {
          const log = JSON.parse(e.data);
          if (log.subsystem !== 'AGENT') return;
          if (!log.message) return;

          let rawAgent = null;
          let body = log.message;
          
          const bracketMatch = log.message.match(/^\[([^\]]+)\]\s+(.*)$/);
          if (bracketMatch) {
            rawAgent = bracketMatch[1];
            body = bracketMatch[2];
          } else {
            // Check for V3 format: "🔬 AAPL: V3 quant_analyst starting..."
            const v3Match = log.message.match(/^(?:🔬|✅|❌|⏰|🛑|💥)\s+[^:]+:\s+V3\s+([^\s]+)\s+(.*)$/);
            if (v3Match) {
              rawAgent = v3Match[1];
              // Keep the whole message as body so we can match emojis easily
            } else {
              return; // Unrecognized format
            }
          }

          const agentId = canonicalAgentId(cleanAgentId(rawAgent));
          if (!agentId) return; // Skip non-pipeline chat agents
          let mappedEvent = null;

          const homeStation = getHomeStation(agentId, true);

          if (body.includes('Starting agent execution') || body.includes('Starting local agent loop') || body.includes('starting...')) {
            const station = homeStation || 'research';
            mappedEvent = {
              type: `${station}_start`,
              agentId,
              station,
              tool: 'LLM thinking',
              label: `${agentId} starting execution`,
              status: 'start',
              ts: Date.now()
            };
          } else if (body.includes('Executing LLM reasoning step') || body.includes('reasoning step')) {
            const station = homeStation || 'research';
            mappedEvent = {
              type: `${station}_start`,
              agentId,
              station,
              tool: 'LLM thinking',
              label: `${agentId} reasoning...`,
              status: 'start',
              ts: Date.now()
            };
          } else if (body.includes('Requesting tool') || body.includes('Executed tool')) {
            const toolMatch = body.match(/(?:Requesting|Executed) tool '([^']+)'/);
            if (toolMatch) {
              const tool = toolMatch[1];
              const station = getStationForAgentOrTool(agentId, tool);
              const isStart = body.includes('Requesting tool');
              const isError = body.toLowerCase().includes('failed') || body.toLowerCase().includes('error');
              
              mappedEvent = {
                type: isStart ? `${station}_start` : `${station}_${isError ? 'error' : 'done'}`,
                agentId,
                station,
                tool,
                label: isStart ? `${agentId} executing ${tool}` : (isError ? `${agentId} failed ${tool}` : `${agentId} completed ${tool}`),
                status: isStart ? 'start' : (isError ? 'error' : 'done'),
                ts: Date.now()
              };
            }
          } else if (body.includes('Selecting optimal tools') || body.includes('Pruning tool context') || body.includes('Pruning context')) {
            const station = homeStation || 'research';
            mappedEvent = {
              type: `${station}_start`,
              agentId,
              station,
              tool: 'Selecting tools',
              label: `${agentId} optimizing context`,
              status: 'start',
              ts: Date.now()
            };
          } else if (body.includes('Delegating agentic loop to Prism')) {
            const station = 'inbox';
            mappedEvent = {
              type: `${station}_start`,
              agentId,
              station,
              tool: 'Delegating',
              label: `${agentId} delegating to Prism`,
              status: 'start',
              ts: Date.now()
            };
          } else if (body.includes('Finished successfully') || body.includes('Completed local agent loop') || body.includes('✅') || body.includes('❌') || body.includes('⏰') || body.includes('🛑') || body.includes('💥')) {
            const station = homeStation || 'smoke_break';
            const isError = body.includes('❌') || body.includes('⏰') || body.includes('🛑') || body.includes('💥');
            mappedEvent = {
              type: isError ? `${station}_error` : `${station}_done`,
              agentId,
              station,
              tool: null,
              label: isError ? `${agentId} failed run` : `${agentId} completed run`,
              status: isError ? 'error' : 'done',
              ts: Date.now()
            };

            // Track completed tasks for smoke break eligibility
            if (!homeStation && !isError) {
              taskCountRef.current[agentId] = (taskCountRef.current[agentId] || 0) + 1;
              if (taskCountRef.current[agentId] >= SMOKE_BREAK_MIN_TASKS && Math.random() < SMOKE_BREAK_CHANCE) {
                taskCountRef.current[agentId] = 0;
                setTimeout(() => {
                  if (cancelled.current) return;
                  setAgents(prevAgents => {
                    let updated = { ...prevAgents };
                    const smokeEvent = { type: 'smoke_break_start', agentId, station: 'smoke_break', tool: 'break', label: `${agentId} taking a break`, status: 'start', ts: Date.now() };
                    updated = processEvent(updated, smokeEvent);
                    applyTimers(agentId, updated[agentId]);
                    return updated;
                  });
                }, 500);
              }
            }
          } else if (body.includes('Execution failed') || body.includes('Execution timed out') || body.includes('failed via Prism')) {
            const station = 'error';
            mappedEvent = {
              type: `${station}_error`,
              agentId,
              station,
              tool: 'error',
              label: `${agentId} execution failed`,
              status: 'error',
              ts: Date.now()
            };
          } else if (body.includes('Fired due to poor performance') || body.includes('Agent fired')) {
            const station = 'window';
            mappedEvent = {
              type: `${station}_error`,
              agentId,
              station,
              tool: 'error',
              label: `${agentId} fired!`,
              status: 'error',
              ts: Date.now()
            };
          }

          if (mappedEvent) {
            setAgents(prevAgents => {
              let updated = { ...prevAgents };
              updated = processEvent(updated, mappedEvent);
              applyTimers(mappedEvent.agentId, updated[mappedEvent.agentId]);

              if (mappedEvent.station === 'debate') {
                let advocateId = 'BEARISH_DEBATER';
                if (mappedEvent.agentId === 'BEARISH_DEBATER') advocateId = 'BULLISH_DEBATER';
                else if (mappedEvent.agentId === 'system') advocateId = 'advocate';

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
            });
          }
        } catch (err) {}
      }, cancelled);
    } catch (err) {}
 
    return () => {
      cancelled.current = true;
      if (es) es.close();
    };
  }, [isRunning, sceneMounted, applyTimers]);

  // ── Prism webhook SSE — always-on, drives agent animations from
  //    prism-service's real-time webhook events (tool calls, generation lifecycle)
  //    Also forwards agent_voice events to the parent via onVoiceEvent callback,
  //    eliminating the need for a duplicate SSE connection in AgentOffice3D.
  const onVoiceEventRef = useRef(onVoiceEvent);
  useEffect(() => { onVoiceEventRef.current = onVoiceEvent; }, [onVoiceEvent]);

  useEffect(() => {
    // Guard: don't open SSE until the scene has mounted
    if (!mountedRef.current) return;

    let es = null;
    let cancelled = { current: false };
    const prismStreamUrl =
      '/api/v1/prism/stream?events=request.tool_call.started,request.tool_call.completed,generation.started,generation.completed,request.created';

    try {
      es = openSSEWithBackoff(prismStreamUrl, (e) => {
        if (cancelled.current) return;
        try {
          const parsed = JSON.parse(e.data);

          // Forward agent_voice events to the parent component
          if (parsed.type === 'agent_voice' && onVoiceEventRef.current) {
            onVoiceEventRef.current(parsed);
            return;
          }

          // Only process Prism webhook events (have eventType field)
          if (!isPrismWebhookEvent(parsed)) return;

          // Translate Prism event → office events
          const officeEvents = mapPrismEvent(parsed, classifyToolStation);
          if (officeEvents.length === 0) return;

          setAgents(prevAgents => {
            let updated = { ...prevAgents };
            for (const oe of officeEvents) {
              if (oe.type === 'agent_voice') {
                if (onVoiceEventRef.current) onVoiceEventRef.current(oe);
                continue;
              }
              updated = processEvent(updated, oe);
              applyTimers(oe.agentId, updated[oe.agentId]);
            }
            return updated;
          });
        } catch (err) {
          // Silently ignore parse errors from non-JSON SSE messages
        }
      }, cancelled);
    } catch (err) {
      // SSE construction failed — will not retry automatically
    }

    return () => {
      cancelled.current = true;
      if (es) es.close();
    };
  }, [sceneMounted, applyTimers]);

  // Auto-expire inactive agents — walk to exit door and then leave the office completely
  useEffect(() => {
    if (idleTimerRef.current) clearInterval(idleTimerRef.current);
    idleTimerRef.current = setInterval(() => {
      setAgents(prev => {
        const now = Date.now();
        let changed = false;
        const updated = { ...prev };
        for (const [id, agent] of Object.entries(updated)) {
          if (id === 'system') continue;
          
          if (agent.state === AGENT_STATES.EXITING) {
            // Remove agent entirely after they reach the exit
            releaseSlot(agent.station, agent.slot);
            delete updated[id];
            changed = true;
            continue;
          }

          // Already at exit or walking to exit — skip
          if (agent.station === 'exit_door' || agent.targetStation === 'exit_door') continue;

          // Skip auto-expiration for agents with dedicated home rooms
          if (getHomeStation(id, true)) continue;

          const elapsed = now - (agent.lastActionTime || 0);
          
          let expireMs = agent.state === AGENT_STATES.WORKING ? 120000 : 15000;
          
          // Send to exit_door to leave the office completely if idle or stuck
          // We do this regardless of `isRunning` so we don't accumulate 100+ agents
          if (elapsed > expireMs && agent.state !== AGENT_STATES.WALKING) {
            const moved = moveAgent({ ...agent, id }, 'exit_door', null, 'exit', 'done');
            updated[id] = {
              ...agent,
              ...moved,
              state: AGENT_STATES.WALKING,
              targetStation: 'exit_door',
            };
            changed = true;

            // After walk completes, arrive at exit door, which sets state to EXITING
            exitTimersRef.current[id] = setTimeout(() => {
              setAgents(curr => {
                if (!curr[id]) return curr;
                return { ...curr, [id]: arriveAgent(curr[id]) };
              });
            }, WALK_DURATION_MS);
          }
        }

        for (const [id, agent] of Object.entries(updated)) {
          if (id === 'system') continue;
          if (!getHomeStation(id, true)) continue; // only home-station agents here
          if (agent.state === AGENT_STATES.EXITING || agent.state === AGENT_STATES.FIRED) continue;

          const elapsed = now - (agent.lastActionTime || 0);
          const HOME_AGENT_IDLE_MS = 5 * 60 * 1000; // 5 minutes
          if (elapsed > HOME_AGENT_IDLE_MS) {
            // Reset to home, don't delete — they should always exist during a cycle
            if (isRunningRef.current) {
              const home = getHomeStation(id, true);
              if (agent.station !== home || agent.state !== AGENT_STATES.IDLE) {
                releaseSlot(agent.station, agent.slot);
                const newSlot = claimSlot(home);
                updated[id] = { ...agent, station: home, state: AGENT_STATES.IDLE, slot: newSlot, lastActionTime: now };
                changed = true;
              }
            }
          }
        }

        return changed ? updated : prev;
      });
    }, 2000); // Check frequently
    return () => clearInterval(idleTimerRef.current);
    // Mount-once by design: agent state is read via setAgents(prev => …)
    // and isRunning via isRunningRef, so nothing here goes stale.
     
  }, []);

  const cycleEndStatusRef = useRef(status);

  // When cycle ends — walk everyone to break room for a smoke, don't exit
  useEffect(() => {
    const isDone = status === 'done' || status === 'error';
    const wasDone = cycleEndStatusRef.current === 'done' || cycleEndStatusRef.current === 'error';

    if (isDone && !wasDone) {
      // Cycle finished — celebrate (or lament) before the smoke break.
      // Everyone cheers/facepalms in place, in sync with the bark, THEN
      // files out to the break room.
      soundManager.playSC(status === 'done' ? 'success' : 'error');
      const endGesture = status === 'done' ? 'cheer' : 'facepalm';
      setAgents(prev => {
        const updated = {};
        const gestureUntil = Date.now() + GESTURE_DURATION_MS;
        for (const [id, agent] of Object.entries(prev)) {
          updated[id] = agent.state === AGENT_STATES.WALKING
            ? agent
            : { ...agent, gesture: endGesture, gestureUntil };
        }
        return updated;
      });
      setTimeout(() => {
        setAgents(prev => {
          const updated = {};
          for (const [id, agent] of Object.entries(prev)) {
            const { gesture: _g, gestureUntil: _gu, ...rest } = agent;
            if (agent.station !== 'smoke_break') {
              updated[id] = moveAgent(rest, 'smoke_break', null, 'break', 'done');
            } else {
              updated[id] = { ...rest, state: AGENT_STATES.WORKING, station: 'smoke_break' };
            }
          }
          return updated;
        });
      }, GESTURE_DURATION_MS);
      // After celebration + walk, arrive everyone in break room
      setTimeout(() => {
        setAgents(prev => {
          const updated = {};
          for (const [id, agent] of Object.entries(prev)) {
            updated[id] = arriveAgent(agent);
          }
          return updated;
        });
      }, GESTURE_DURATION_MS + WALK_DURATION_MS + 500);
    }
    cycleEndStatusRef.current = status;
  }, [status]);

  // If the global run status changes to not running, we trigger the idle check
  useEffect(() => {
    if (!isRunning) {
      resetOccupancy();
    }
  }, [isRunning]);

  // ── Smart Auto-Revert: check overridden agents every 30s ──
  useEffect(() => {
    const interval = setInterval(async () => {
      // Fetch current overrides
      let overrides = {};
      try {
        const res = await fetch('/api/agent-overrides');
        if (res.ok) {
          const data = await res.json();
          overrides = data.overrides || {};
        }
      } catch {
        return; // Can't check without overrides
      }

      const overrideEntries = Object.entries(overrides);
      if (overrideEntries.length === 0) return;

      for (const [agentId, override] of overrideEntries) {
        const currentDemand = demandTracker.getDemand(override.room);
        const homeDemand = override.defaultRoom
          ? demandTracker.getDemand(override.defaultRoom)
          : 0;

        // Auto-revert if: override room has 0 demand AND home room has demand
        if (currentDemand === 0 && homeDemand > 0 && override.defaultRoom) {
          // Remove the override
          try {
            await fetch('/api/agent-overrides', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ agentId, _delete: true }),
            });
          } catch {
            continue;
          }

          // Move agent back to default room
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
      }
    }, 30_000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [setAgents]);

  // ── Load persisted overrides on mount ──
  useEffect(() => {
    async function loadOverrides() {
      try {
        const res = await fetch('/api/agent-overrides');
        if (!res.ok) return;
        const data = await res.json();
        const overrides = data.overrides || {};

        if (Object.keys(overrides).length === 0) return;

        setAgents(prev => {
          let updated = { ...prev };
          for (const [agentId, override] of Object.entries(overrides)) {
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
      } catch {
        // Non-critical
      }
    }

    // Delay slightly to let agents seed first
    const timer = setTimeout(loadOverrides, 2000);
    return () => clearTimeout(timer);
  }, [setAgents]);

  return { agents, setAgents, isRunning };
}
