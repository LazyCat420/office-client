'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import { SceneLayout } from './SceneLayout';
import { useAgentEvents, AGENT_STATES, cleanAgentId, arriveAgent, createAgent } from './routing';
import { AgentDetailsSidebar } from './AgentDetailsSidebar';
import {
  triggerAgentSpeech,
  setAudioEnabled as setVoiceAudioEnabled,
  getHomeStation,
} from '../agent-office/shared';
import '../agent-office/agentOffice.css';



export default function AgentOffice3D({ events, status, phase, audioEnabled = false }) {
  const bubbleTimersRef = useRef({});
  const [isExpanded, setIsExpanded] = useState(true);

  // Track audio enabled state from prop via ref for SSE handler closure
  const audioEnabledRef = useRef(audioEnabled);
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
    // Sync the module-level audioEnabled flag and AudioContext lifecycle
    // so that triggerAgentSpeech() knows whether it can play audio.
    setVoiceAudioEnabled(audioEnabled);
  }, [audioEnabled]);

  // Selection states
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [selectedAgentDetails, setSelectedAgentDetails] = useState(null);

  // Persona config cache — maps role → avatar_config
  const personaMapRef = useRef({});

  // Fetch personas on mount to get avatar_config for each role
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getAgentPersonas } = await import('@/lib/api');
        const data = await getAgentPersonas();
        if (!cancelled && data?.agents) {
          const map = {};
          for (const p of data.agents) {
            if (p.role && p.avatar_config) {
              map[p.role] = p.avatar_config;
              // Also map by name for loose matching
              if (p.name) map[p.name.toLowerCase()] = p.avatar_config;
            }
          }
          personaMapRef.current = map;
        }
      } catch (e) {
        // Persona fetch is non-critical — agents render with default colors
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Voice event handler — receives agent_voice events from the unified Prism SSE
  // in useAgentEvents (eliminating the need for a duplicate SSE connection).
  const agentsRef = useRef({});
  // Dedup set — ring buffer replays recent events on SSE reconnect; avoid double-speaking.
  const seenVoiceQuotesRef = useRef(new Set());
  const handleVoiceEvent = React.useCallback((event) => {
    if (event.type !== 'agent_voice') return;

    const cleanId = cleanAgentId(event.agentId);
    if (!cleanId) return; // Skip non-pipeline chat agents

    // Dedup: skip if we've already spoken this exact quote for this agent
    const dedupeKey = `${cleanId}:${event.quote}`;
    if (seenVoiceQuotesRef.current.has(dedupeKey)) return;
    seenVoiceQuotesRef.current.add(dedupeKey);
    // Cap the dedup set to prevent unbounded growth
    if (seenVoiceQuotesRef.current.size > 100) {
      const first = seenVoiceQuotesRef.current.values().next().value;
      seenVoiceQuotesRef.current.delete(first);
    }

    let agent = agentsRef.current[cleanId];
    if (!agent) {
      const keys = Object.keys(agentsRef.current);
      const workerKey = keys.find(k => k.startsWith(cleanId));
      if (workerKey) {
        agent = agentsRef.current[workerKey];
      }
    }
    if (!agent) {
      // Create agent at their home station instead of lobby so they appear
      // in the correct room even if the pipeline event that placed them
      // there was already garbage-collected.
      agent = createAgent(cleanId, Date.now());
      const home = getHomeStation(cleanId, true);
      if (home) {
        agent = { ...agent, station: home, targetStation: null };
      }
    }

    const targetId = agent.id || cleanId;

    const onSpeechProgress = (textSoFar, isComplete) => {
      setAgents(prev => {
        const targetAgent = prev[targetId] || agent;
        return {
          ...prev,
          [targetId]: {
            ...targetAgent,
            bubble: textSoFar,
            fullBubble: event.quote,
            bubbleType: 'voice',
            isSpeaking: !isComplete,
            lastActionTime: Date.now()
          }
        };
      });

      if (isComplete) {
        if (bubbleTimersRef.current[targetId]) {
          clearTimeout(bubbleTimersRef.current[targetId]);
        }
        bubbleTimersRef.current[targetId] = setTimeout(() => {
          setAgents(prev => {
            if (!prev[targetId]) return prev;
            return {
              ...prev,
              [targetId]: {
                ...prev[targetId],
                bubble: null,
                fullBubble: null,
                bubbleType: 'info',
                isSpeaking: false
              }
            };
          });
          delete bubbleTimersRef.current[targetId];
        }, 6000); // 6 seconds duration for voice bubbles after finishing
      }
    };

    // Always use triggerAgentSpeech to queue voice & bubble sequentially (handles simulated typing internally when muted)
    triggerAgentSpeech(event.quote, agent, null, onSpeechProgress);
  }, []);

  // Wire useAgentEvents with voice callback — single Prism SSE handles
  // both webhook events (tool calls, generation) and agent_voice events
  const { agents, setAgents, isRunning: isRunningInternal } = useAgentEvents(
    events, status, { onVoiceEvent: handleVoiceEvent }
  );
  const isRunning = isRunningInternal;

  // Keep agentsRef in sync for the voice handler closure
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  // Merge avatar_config into agents whenever agents update
  useEffect(() => {
    const map = personaMapRef.current;
    if (!map || Object.keys(map).length === 0) return;

    const rolePatterns = {
      DATA_JANITOR: ['janitor', 'ray', 'purge', 'clean'],
      QUANT: ['quant', 'aris', 'technical', 'math'],
      FUNDAMENTAL: ['fundamental', 'priya', 'research'],
      BEHAVIORAL: ['sentiment', 'vance', 'behavioral', 'bull_', 'bear_'],
      RISK: ['risk', 'helen', 'pre_trade'],
      PM: ['boss', 'pm', 'allocator', 'executor', 'trade_agent'],
    };

    let needsUpdate = false;
    const updated = { ...agents };
    for (const [id, agent] of Object.entries(updated)) {
      if (agent.avatar_config) continue; // Already has config
      const idLower = id.toLowerCase();
      for (const [role, patterns] of Object.entries(rolePatterns)) {
        if (patterns.some(p => idLower.includes(p)) && map[role]) {
          updated[id] = { ...agent, avatar_config: map[role] };
          needsUpdate = true;
          break;
        }
      }
    }
    if (needsUpdate) {
      setAgents(updated);
    }
  }, [agents, setAgents]);

  // Clean up speech bubble timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of Object.values(bubbleTimersRef.current)) {
        clearTimeout(timer);
      }
    };
  }, []);

  // Sync selected details with live agent state updates
  useEffect(() => {
    if (selectedAgentId && agents[selectedAgentId]) {
      setSelectedAgentDetails(agents[selectedAgentId]);
    }
  }, [selectedAgentId, agents]);

  // Reset selection when collapsing the office visualizer
  useEffect(() => {
    if (!isExpanded) {
      setSelectedAgentId(null);
      setSelectedAgentDetails(null);
    }
  }, [isExpanded]);

  const handleArriveAgent = React.useCallback((agentId) => {
    setAgents(prev => {
      const agent = prev[agentId];
      if (!agent || agent.state !== AGENT_STATES.WALKING) return prev;
      return { ...prev, [agentId]: arriveAgent(agent) };
    });
  }, [setAgents]);

  return (
    <div className={`agent-office ${!isExpanded ? 'agent-office--collapsed' : ''}`} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div 
        className="agent-office__toggle" 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ padding: '0.5rem', background: '#1e293b', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', color: '#fff' }}
      >
        <div className="agent-office__title" onClick={() => setIsExpanded(!isExpanded)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          {isExpanded ? '▼' : '▶'}
          <span style={{ marginLeft: 8 }}>3D Trading Floor</span>
          {isRunning && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', marginLeft: 8 }} />}
        </div>
        <div className="agent-office__toggle-stats" style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#94a3b8', alignItems: 'center' }}>
          <span>Agents: {Object.keys(agents).filter(id => agents[id].state !== AGENT_STATES.EXITING).length}</span>
        </div>
      </div>

      {isExpanded && (
        <div style={{ flex: 1, position: 'relative', background: '#020617' }}>
          <Canvas shadows camera={{ position: [0, 35, 30], fov: 45, near: 0.1, far: 600 }}>
            <color attach="background" args={['#050510']} />
            <MapControls enableRotate={true} maxPolarAngle={Math.PI / 2.2} minDistance={5} maxDistance={150} />
            <SceneLayout 
              agents={agents} 
              selectedAgentId={selectedAgentId} 
              onSelectAgent={setSelectedAgentId} 
              onArriveAgent={handleArriveAgent}
            />
          </Canvas>

          {selectedAgentId && selectedAgentDetails && (
            <AgentDetailsSidebar
              agentId={selectedAgentId}
              agentColor={selectedAgentDetails.color || '#818cf8'}
              onClose={() => {
                setSelectedAgentId(null);
                setSelectedAgentDetails(null);
              }}
              isRunning={isRunning}
            />
          )}
        </div>
      )}
    </div>
  );
}
