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
  const { agents, setAgents, isRunning: isRunningInternal } = useAgentEvents(events, status);
  const isRunning = isRunningInternal;
  
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

  const agentsRef = useRef(agents);
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  // SSE for agent_voice events — listens for voice quotes from the backend
  useEffect(() => {
    if (!isRunning) return;

    let eventSource = null;
    let cancelled = false;
    const streamUrl = '/api/v1/prism/stream?events=request.tool_call.started,request.tool_call.completed,generation.started,generation.completed,request.created';

    try {
      eventSource = new EventSource(streamUrl);
      eventSource.onmessage = (e) => {
        if (cancelled) return;
        try {
          const event = JSON.parse(e.data);
          if (event.type === 'agent_voice') {
            const cleanId = cleanAgentId(event.agentId);
            if (!cleanId) return; // Skip non-pipeline chat agents
            let agent = agentsRef.current[cleanId];
            if (!agent) {
              const keys = Object.keys(agentsRef.current);
              const workerKey = keys.find(k => k.startsWith(cleanId));
              if (workerKey) {
                agent = agentsRef.current[workerKey];
              }
            }
            if (!agent) {
              agent = createAgent(cleanId, Date.now());
            }

            const onSpeechProgress = (textSoFar, isComplete) => {
              setAgents(prev => {
                const targetAgent = prev[cleanId] || agent;
                return {
                  ...prev,
                  [cleanId]: {
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
                if (bubbleTimersRef.current[cleanId]) {
                  clearTimeout(bubbleTimersRef.current[cleanId]);
                }
                bubbleTimersRef.current[cleanId] = setTimeout(() => {
                  setAgents(prev => {
                    if (!prev[cleanId]) return prev;
                    return {
                      ...prev,
                      [cleanId]: {
                        ...prev[cleanId],
                        bubble: null,
                        fullBubble: null,
                        bubbleType: 'info',
                        isSpeaking: false
                      }
                    };
                  });
                  delete bubbleTimersRef.current[cleanId];
                }, 6000); // 6 seconds duration for voice bubbles after finishing
              }
            };

            if (audioEnabledRef.current && window.speechSynthesis) {
              triggerAgentSpeech(event.quote, agent, null, onSpeechProgress);
            } else {
              // Simulated typing effect when audio is disabled or unavailable
              let cleanText = event.quote ? event.quote.replace(/[*_`~#]/g, '') : '';
              let words = cleanText.split(' ').filter(w => w.length > 0);
              if (words.length === 0) {
                onSpeechProgress('', true);
              } else {
                let currentWordIndex = 0;
                const typeNextWord = () => {
                  if (currentWordIndex < words.length) {
                    let textSoFar = words.slice(0, currentWordIndex + 1).join(' ');
                    let isComplete = currentWordIndex === words.length - 1;
                    onSpeechProgress(textSoFar, isComplete);
                    if (!isComplete) {
                      currentWordIndex++;
                      // ~200ms per word simulates standard talking speed (~300 WPM)
                      setTimeout(typeNextWord, 200);
                    }
                  }
                };
                typeNextWord();
              }
            }
          }
        } catch (err) {}
      };
    } catch (err) {}

    return () => {
      cancelled = true;
      if (eventSource) eventSource.close();
    };
  }, [isRunning]);

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
