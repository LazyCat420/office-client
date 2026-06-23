'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MapControls } from '@react-three/drei';
import { SceneLayout } from './SceneLayout';
import { useAgentEvents, AGENT_STATES, cleanAgentId, arriveAgent, createAgent, processEvent, moveAgent } from './routing';
import { canMoveAgent } from './routing/roomConstraints';
import { STATIONS } from './routing/stateMachine';
import { AgentDetailsSidebar } from './AgentDetailsSidebar';
import {
  triggerAgentSpeech,
  getHomeStation,
} from '../agent-office/shared';
import { initializeAudio, disableAudio } from '../agent-office/audioContextManager';
import { setGlobalVolume } from '../agent-office/ttsClient';
import '../agent-office/agentOffice.css';

/**
 * CameraVolumeSync — Inner component to sync camera distance to global TTS volume
 */
function CameraVolumeSync() {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  
  useFrame(() => {
    // Distance varies between minDistance (5) and maxDistance (150)
    const dist = camera.position.distanceTo(target);
    // Let's fade: at dist <= 40, volume is 1.0. At dist >= 120, volume is 0.1
    const minD = 40;
    const maxD = 120;
    let vol = 1.0;
    if (dist > minD) {
      vol = 1.0 - ((dist - minD) / (maxD - minD)) * 0.9; 
    }
    setGlobalVolume(Math.max(vol, 0.1));
  });
  
  return null;
}



export default function AgentOffice3D({ events, status, phase, audioEnabled = false }) {
  const bubbleTimersRef = useRef({});
  const [isExpanded, setIsExpanded] = useState(true);

  // Track audio enabled state from prop via ref for SSE handler closure
  const audioEnabledRef = useRef(audioEnabled);
  const isAudioInitialMount = useRef(true);
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
    if (isAudioInitialMount.current) {
      isAudioInitialMount.current = false;
      return;
    }
    if (audioEnabled) {
      initializeAudio();
    } else {
      disableAudio();
    }
  }, [audioEnabled]);

  // Selection states
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [selectedAgentDetails, setSelectedAgentDetails] = useState(null);
  const [showGrid, setShowGrid] = useState(false);
  const [showNetwork, setShowNetwork] = useState(false);

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
    if (event.quote) {
      const dedupeKey = `${cleanId}:${event.quote}`;
      if (seenVoiceQuotesRef.current.has(dedupeKey)) return;
      seenVoiceQuotesRef.current.add(dedupeKey);
      // Cap the dedup set to prevent unbounded growth
      if (seenVoiceQuotesRef.current.size > 100) {
        const first = seenVoiceQuotesRef.current.values().next().value;
        seenVoiceQuotesRef.current.delete(first);
      }
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
      // Create agent at their home station via processEvent so they get
      // a proper WORKING state, slot position, and animation variant.
      // This prevents the GC from killing them before TTS finishes.
      const home = getHomeStation(cleanId, true) || 'desk';
      const seeded = processEvent({}, {
        type: `${home}_start`,
        agentId: cleanId,
        station: home,
        tool: 'voice',
        label: `${cleanId} speaking`,
        status: 'start',
        ts: Date.now(),
      });
      agent = seeded[cleanId];
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

    // Provide immediate visual feedback that the webhook was received
    // The agent is "thinking" while the TTS audio is being generated/queued.
    setAgents(prev => {
      const targetAgent = prev[targetId] || agent;
      return {
        ...prev,
        [targetId]: {
          ...targetAgent,
          bubble: '...',
          fullBubble: event.quote,
          bubbleType: 'thinking',
          isSpeaking: false,
          lastActionTime: Date.now()
        }
      };
    });

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
      imhotep: ['imhotep'],
      pythagoras: ['pythagoras'],
      archimedes: ['archimedes'],
      caesar: ['caesar'],
      al_khwarizmi: ['al_khwarizmi', 'khwarizmi'],
      brahmagupta: ['brahmagupta'],
      newton_leibniz: ['newton', 'leibniz', 'newton_leibniz'],
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
  // ── Drag system ──
  const controlsRef = useRef();
  const [dragState, setDragState] = useState({
    isDragging: false,
    draggedAgentId: null,
    dragPosition: null,
    nearestRoom: null,
    dropAllowed: true,
    dropError: null,
  });

  // Toast notification for drag results
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = useCallback((message, type = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // Handle agent drop — persist override and move agent
  const handleDropAgent = useCallback(async (agentId, fromRoom, toRoom) => {
    // Immediately move agent visually
    setAgents(prev => {
      const agent = prev[agentId];
      if (!agent) return prev;
      const moved = moveAgent(agent, toRoom, 'reassigned', `Moving to ${toRoom}`, 'start');
      return { ...prev, [agentId]: moved };
    });

    showToast(`${agentId} → ${toRoom.replace('_', ' ')}`, 'success');

    // Persist the override to the local API
    try {
      await fetch('/api/agent-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          room: toRoom,
          defaultRoom: fromRoom,
        }),
      });
    } catch {
      // Non-critical — override still works visually
    }
  }, [setAgents, showToast]);

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
          {/* Grid Toggle Overlay Button */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              zIndex: 10,
              background: showGrid ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.65)',
              border: showGrid ? '1px solid #38bdf8' : '1px solid #475569',
              color: showGrid ? '#38bdf8' : '#e2e8f0',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '600',
              fontFamily: 'system-ui, sans-serif',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)'
            }}
          >
            🌐 {showGrid ? 'Grid On' : 'Grid Off'}
          </button>

          {/* Network Toggle Overlay Button */}
          <button
            onClick={() => setShowNetwork(!showNetwork)}
            style={{
              position: 'absolute',
              top: 12,
              left: 115,
              zIndex: 10,
              background: showNetwork ? 'rgba(168, 85, 247, 0.25)' : 'rgba(30, 41, 59, 0.65)',
              border: showNetwork ? '1px solid #a855f7' : '1px solid #475569',
              color: showNetwork ? '#c084fc' : '#e2e8f0',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '600',
              fontFamily: 'system-ui, sans-serif',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)'
            }}
          >
            🕸️ {showNetwork ? 'Network On' : 'Network Off'}
          </button>
          <Canvas
            shadows={{ type: THREE.PCFShadowMap }}
            camera={{ position: [0, 35, 30], fov: 45, near: 0.1, far: 600 }}
            onPointerMissed={() => {
              // Cancel drag if clicking empty space
              if (dragState.isDragging) {
                if (controlsRef.current) controlsRef.current.enabled = true;
                setDragState({
                  isDragging: false,
                  draggedAgentId: null,
                  dragPosition: null,
                  nearestRoom: null,
                  dropAllowed: true,
                  dropError: null,
                });
              }
            }}
          >
            <color attach="background" args={['#050510']} />
            <MapControls
              ref={controlsRef}
              enableRotate={true}
              maxPolarAngle={Math.PI / 2.2}
              minDistance={5}
              maxDistance={150}
            />
            <CameraVolumeSync />
            <DragManager
              agents={agents}
              controlsRef={controlsRef}
              dragState={dragState}
              setDragState={setDragState}
              onDropAgent={handleDropAgent}
            />
            <SceneLayout 
              agents={agents} 
              selectedAgentId={selectedAgentId} 
              onSelectAgent={setSelectedAgentId} 
              onArriveAgent={handleArriveAgent}
              dragState={dragState}
              showGrid={showGrid}
              showNetwork={showNetwork}
              onStartDrag={(agentId, event) => {
                const agent = agents[agentId];
                if (!agent) return;
                const fromRoom = agent.targetStation || agent.station;
                if (controlsRef.current) controlsRef.current.enabled = false;
                setDragState({
                  isDragging: true,
                  draggedAgentId: agentId,
                  dragPosition: { x: agent.x || agent.targetX || 0, z: agent.z || agent.targetZ || 0 },
                  nearestRoom: null,
                  dropAllowed: true,
                  dropError: null,
                });
              }}
            />
          </Canvas>

          {/* Toast notification */}
          {toast && (
            <div style={{
              position: 'absolute',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              background: toast.type === 'success' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)',
              color: '#fff',
              padding: '8px 20px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              fontFamily: 'system-ui, sans-serif',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
              animation: 'agent-bubble-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
              pointerEvents: 'none',
              zIndex: 100,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              {toast.type === 'success' ? '✅' : '❌'} {toast.message}
            </div>
          )}

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

/**
 * DragManager — Inner component that runs INSIDE the Canvas context.
 * This allows it to use useThree() hooks for raycasting and camera access.
 * It listens to pointer events on the canvas to update drag state.
 */
function DragManager({ agents, controlsRef, dragState, setDragState, onDropAgent }) {
  const { camera, raycaster, pointer } = useThree();

  const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.8), []);
  const intersectPoint = useRef(new THREE.Vector3());

  const DROP_TARGET_ROOMS = useMemo(() => [
    'lobby', 'research', 'desk', 'debate', 'inbox',
    'error', 'tool_bench', 'smoke_break',
  ], []);

  const roomCenters = useMemo(() => {
    const centers = {};
    for (const roomId of DROP_TARGET_ROOMS) {
      const s = STATIONS[roomId];
      if (s) centers[roomId] = new THREE.Vector3(s.x, 0, s.z);
    }
    return centers;
  }, [DROP_TARGET_ROOMS]);

  // Listen to pointer move on the gl.domElement
  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleMove = () => {
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(dragPlane, intersectPoint.current)) {
        const pos = {
          x: intersectPoint.current.x,
          z: intersectPoint.current.z,
        };

        // Find nearest room
        let minDist = Infinity;
        let nearest = null;
        const dragVec = new THREE.Vector3(pos.x, 0, pos.z);
        for (const roomId of DROP_TARGET_ROOMS) {
          const center = roomCenters[roomId];
          if (!center) continue;
          const dist = dragVec.distanceTo(center);
          if (dist < minDist) {
            minDist = dist;
            nearest = roomId;
          }
        }

        // Check constraints
        let allowed = true;
        let error = null;
        if (nearest && dragState.draggedAgentId) {
          const agent = agents[dragState.draggedAgentId];
          const fromRoom = agent?.targetStation || agent?.station;
          if (fromRoom) {
            const result = canMoveAgent(dragState.draggedAgentId, fromRoom, nearest, agents);
            allowed = result.allowed;
            error = result.reason || null;
          }
        }

        setDragState(prev => ({
          ...prev,
          dragPosition: pos,
          nearestRoom: nearest,
          dropAllowed: allowed,
          dropError: error,
        }));
      }
    };

    // Use requestAnimationFrame-throttled mousemove for performance
    let rafId = null;
    const throttledMove = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        handleMove();
        rafId = null;
      });
    };

    const handleUp = () => {
      const { nearestRoom, dropAllowed, draggedAgentId } = dragState;
      const agent = agents[draggedAgentId];
      const fromRoom = agent?.targetStation || agent?.station;

      if (controlsRef.current) controlsRef.current.enabled = true;

      if (nearestRoom && dropAllowed && nearestRoom !== fromRoom) {
        onDropAgent(draggedAgentId, fromRoom, nearestRoom);
      }

      setDragState({
        isDragging: false,
        draggedAgentId: null,
        dragPosition: null,
        nearestRoom: null,
        dropAllowed: true,
        dropError: null,
      });
    };

    window.addEventListener('pointermove', throttledMove);
    window.addEventListener('pointerup', handleUp);

    return () => {
      window.removeEventListener('pointermove', throttledMove);
      window.removeEventListener('pointerup', handleUp);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [dragState.isDragging, dragState.draggedAgentId, dragState.nearestRoom, dragState.dropAllowed, agents, camera, raycaster, pointer, dragPlane, roomCenters, DROP_TARGET_ROOMS, controlsRef, onDropAgent, setDragState]);

  return null; // This component only provides side effects
}
