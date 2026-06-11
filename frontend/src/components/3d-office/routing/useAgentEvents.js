import { useState, useEffect, useRef } from 'react';
import { processEvent, arriveAgent, moveAgent, releaseSlot, resetOccupancy, AGENT_STATES, clearBubble } from './stateMachine';
import { mapEvent, mapPrismEvent, isPrismWebhookEvent } from '../../agent-office/shared';
import { classifyToolStation } from './toolStationMap';

const WALK_DURATION_MS = 15000;
const BUBBLE_TIMEOUT_MS = 4000;
const AGENT_EXPIRE_MS = 30000;  // Remove agents after 30s of no events
const EXIT_DELAY_MS = 3500;
const EXIT_FADE_MS = 600;
const SMOKE_BREAK_CHANCE = 0.15; // 15% chance of smoke break after completing work
const SMOKE_BREAK_MIN_TASKS = 3; // Minimum tasks before eligible for smoke break

import { cleanAgentId, getHomeStation, getStationForAgentOrTool as sharedGetStationForAgentOrTool } from '../../agent-office/shared';

export { cleanAgentId };

const getStationForAgentOrTool = (agentId, toolName) =>
  sharedGetStationForAgentOrTool(agentId, toolName, classifyToolStation, true);

export function useAgentEvents(events, status, { onVoiceEvent } = {}) {
  const [agents, setAgents] = useState({});
  const isRunning = status && !['idle', 'done', 'error', 'stopped', 'interrupted'].includes(status);
  
  const processedCountRef = useRef(0);
  const walkTimersRef = useRef({});
  const exitTimersRef = useRef({});
  const bubbleTimersRef = useRef({});
  const idleTimerRef = useRef(null);
  const taskCountRef = useRef({}); // Track completed tasks per agent for smoke break
  const prevStatusRef2 = useRef(status); // For reset guard (separate from cycle-end ref)

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

  const applyTimers = (agentId, agentState) => {
    if (!agentState) return;

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
  };

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of Object.values(walkTimersRef.current)) clearTimeout(timer);
      for (const timer of Object.values(exitTimersRef.current)) clearTimeout(timer);
      for (const timer of Object.values(bubbleTimersRef.current)) clearTimeout(timer);
    };
  }, []);

  // ── Known pipeline agent roles to pre-seed at their home stations ──
  const PIPELINE_AGENTS = [
    'DATA_JANITOR',
    'QUANT_RESEARCH_AGENT',
    'PRE_TRADE_RISK',
    'BULLISH_DEBATER',
    'BEARISH_DEBATER',
    'PORTFOLIO_ALLOCATOR',
  ];

  // ── Reset on new cycle (matches 2D AgentOffice pattern) ──
  useEffect(() => {
    if (status === 'idle' || status === 'starting') {
      if (prevStatusRef2.current !== status) {
        setAgents({});
        processedCountRef.current = 0;
        resetOccupancy();
        taskCountRef.current = {};
        // Clear all walk/exit timers
        for (const timer of Object.values(walkTimersRef.current)) clearTimeout(timer);
        for (const timer of Object.values(exitTimersRef.current)) clearTimeout(timer);
        for (const timer of Object.values(bubbleTimersRef.current)) clearTimeout(timer);
        walkTimersRef.current = {};
        exitTimersRef.current = {};
        bubbleTimersRef.current = {};
      }
    }

    // Pre-seed known pipeline agents when a cycle starts so they're
    // visible in the 3D office before any events arrive for them.
    const wasIdle = ['idle', 'done', 'error', 'stopped', 'interrupted'].includes(prevStatusRef2.current);
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

    prevStatusRef2.current = status;
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
          updated = processEvent(updated, oe);
          applyTimers(oe.agentId, updated[oe.agentId]);
        }
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
  }, [events, sceneMounted]);

  useEffect(() => {
    if (!isRunning) return;
    // Guard: don't open SSE until the scene has mounted
    if (!mountedRef.current) return;
    let es = null;
    let cancelled = false;
    const url = '/api/v1/system/stream';
    
    try {
      es = new EventSource(url);
      es.onmessage = (e) => {
        if (cancelled) return;
        try {
          const log = JSON.parse(e.data);
          if (log.subsystem !== 'AGENT') return;
          if (!log.message) return;

          const match = log.message.match(/^\[([^\]]+)\]\s+(.*)$/);
          if (!match) return;

          const rawAgent = match[1];
          const body = match[2];
          const agentId = cleanAgentId(rawAgent);
          if (!agentId) return; // Skip non-pipeline chat agents
          let mappedEvent = null;

          const homeStation = getHomeStation(agentId, true);

          if (body.includes('Starting agent execution') || body.includes('Starting local agent loop')) {
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
          } else if (body.includes('Finished successfully') || body.includes('Completed local agent loop')) {
            const station = homeStation || 'smoke_break';
            mappedEvent = {
              type: `${station}_done`,
              agentId,
              station,
              tool: null,
              label: `${agentId} completed run`,
              status: 'done',
              ts: Date.now()
            };

            // Track completed tasks for smoke break eligibility
            if (!homeStation) {
              taskCountRef.current[agentId] = (taskCountRef.current[agentId] || 0) + 1;
              if (taskCountRef.current[agentId] >= SMOKE_BREAK_MIN_TASKS && Math.random() < SMOKE_BREAK_CHANCE) {
                taskCountRef.current[agentId] = 0;
                setTimeout(() => {
                  if (cancelled) return;
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
      };
    } catch (err) {}
 
    return () => {
      cancelled = true;
      if (es) es.close();
    };
  }, [isRunning, sceneMounted]);

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
    let cancelled = false;
    const prismStreamUrl =
      '/api/v1/prism/stream?events=request.tool_call.started,request.tool_call.completed,generation.started,generation.completed,request.created';

    try {
      es = new EventSource(prismStreamUrl);
      es.onmessage = (e) => {
        if (cancelled) return;
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
              updated = processEvent(updated, oe);
              applyTimers(oe.agentId, updated[oe.agentId]);
            }
            return updated;
          });
        } catch (err) {
          // Silently ignore parse errors from non-JSON SSE messages
        }
      };

      es.onerror = () => {
        // EventSource auto-reconnects; nothing to do
      };
    } catch (err) {
      // SSE construction failed — will not retry automatically
    }

    return () => {
      cancelled = true;
      if (es) es.close();
    };
  }, [sceneMounted]);

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
        return changed ? updated : prev;
      });
    }, 2000); // Check frequently
    return () => clearInterval(idleTimerRef.current);
  }, []);

  const prevStatusRef = useRef(status);

  // When cycle ends — walk everyone to break room for a smoke, don't exit
  useEffect(() => {
    const isDone = status === 'done' || status === 'error';
    const wasDone = prevStatusRef.current === 'done' || prevStatusRef.current === 'error';

    if (isDone && !wasDone) {
      setAgents(prev => {
        const updated = {};
        for (const [id, agent] of Object.entries(prev)) {
          if (agent.station !== 'smoke_break') {
            updated[id] = moveAgent(agent, 'smoke_break', null, 'break', 'done');
          } else {
            updated[id] = { ...agent, state: AGENT_STATES.WORKING, station: 'smoke_break' };
          }
        }
        return updated;
      });
      // After walk, arrive everyone in break room
      setTimeout(() => {
        setAgents(prev => {
          const updated = {};
          for (const [id, agent] of Object.entries(prev)) {
            updated[id] = arriveAgent(agent);
          }
          return updated;
        });
      }, WALK_DURATION_MS + 500);
    }
    prevStatusRef.current = status;
  }, [status]);

  // If the global run status changes to not running, we trigger the idle check
  useEffect(() => {
    if (!isRunning) {
      resetOccupancy();
    }
  }, [isRunning]);

  return { agents, setAgents, isRunning };
}
