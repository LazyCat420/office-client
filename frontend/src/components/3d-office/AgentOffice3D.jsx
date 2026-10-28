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
import { AudioCaptions } from './AudioCaptions';
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



const ROLE_AVATAR_PATTERNS = {
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

const INITIAL_DRAG_STATE = {
  isDragging: false,
  draggedAgentId: null,
  dragPosition: null,
  nearestRoom: null,
  dropAllowed: true,
  dropError: null,
};

async function fetchPersonaAvatarMap() {
  try {
    const { getAgentPersonas } = await import('@/lib/api');
    const data = await getAgentPersonas();
    if (!data?.agents) return null;
    const map = {};
    for (const p of data.agents) {
      if (p.role && p.avatar_config) {
        map[p.role] = p.avatar_config;
        if (p.name) map[p.name.toLowerCase()] = p.avatar_config;
      }
    }
    return map;
  } catch {
    return null;
  }
}

function findMatchingAvatarConfig(idLower, map) {
  for (const [role, patterns] of Object.entries(ROLE_AVATAR_PATTERNS)) {
    if (map[role] && patterns.some(p => idLower.includes(p))) {
      return map[role];
    }
  }
  return null;
}

function mergeAvatarConfigsIntoAgents(agents, map) {
  if (!map || Object.keys(map).length === 0) return null;
  let needsUpdate = false;
  const updated = { ...agents };
  for (const [id, agent] of Object.entries(updated)) {
    if (agent.avatar_config) continue;
    const matchedConfig = findMatchingAvatarConfig(id.toLowerCase(), map);
    if (matchedConfig) {
      updated[id] = { ...agent, avatar_config: matchedConfig };
      needsUpdate = true;
    }
  }
  return needsUpdate ? updated : null;
}

function recordVoiceDedupeKey(seenSet, cleanId, quote) {
  if (!quote) return true;
  const dedupeKey = `${cleanId}:${quote}`;
  if (seenSet.has(dedupeKey)) return false;
  seenSet.add(dedupeKey);
  if (seenSet.size > 100) {
    const first = seenSet.values().next().value;
    seenSet.delete(first);
  }
  return true;
}

function resolveOrCreateSpeakingAgent(agentsMap, cleanId) {
  if (agentsMap[cleanId]) return agentsMap[cleanId];
  const workerKey = Object.keys(agentsMap).find(k => k.startsWith(cleanId));
  if (workerKey) return agentsMap[workerKey];
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
  return seeded[cleanId];
}

function scheduleVoiceBubbleClear(targetId, bubbleTimersRef, setAgents) {
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
          isSpeaking: false,
        },
      };
    });
    delete bubbleTimersRef.current[targetId];
  }, 6000);
}

function OfficeToggleHeader({ isExpanded, onToggle, isRunning, agents }) {
  const activeCount = Object.keys(agents).filter(id => agents[id].state !== AGENT_STATES.EXITING).length;
  return (
    <div
      className="agent-office__toggle"
      onClick={onToggle}
      style={{ padding: '0.5rem', background: '#1e293b', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', color: '#fff' }}
    >
      <div className="agent-office__title" onClick={onToggle} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
        {isExpanded ? '▼' : '▶'}
        <span style={{ marginLeft: 8 }}>3D Trading Floor</span>
        {isRunning && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', marginLeft: 8 }} />}
      </div>
      <div className="agent-office__toggle-stats" style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#94a3b8', alignItems: 'center' }}>
        <span>Agents: {activeCount}</span>
      </div>
    </div>
  );
}

function OfficeOverlayControls({ showGrid, setShowGrid, showNetwork, setShowNetwork }) {
  return (
    <>
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
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
        }}
      >
        🌐 {showGrid ? 'Grid On' : 'Grid Off'}
      </button>

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
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
        }}
      >
        🕸️ {showNetwork ? 'Network On' : 'Network Off'}
      </button>
    </>
  );
}

function OfficeToastBanner({ toast }) {
  if (!toast) return null;
  const isSuccess = toast.type === 'success';
  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      background: isSuccess ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)',
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
      {isSuccess ? '✅' : '❌'} {toast.message}
    </div>
  );
}

export default function AgentOffice3D({ events, status, phase, audioEnabled = false }) {
  const bubbleTimersRef = useRef({});
  const [isExpanded, setIsExpanded] = useState(true);

  const audioEnabledRef = useRef(audioEnabled);
  const isAudioInitialMount = useRef(true);
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
    if (isAudioInitialMount.current) {
      isAudioInitialMount.current = false;
      return;
    }
    if (audioEnabled) initializeAudio();
    else disableAudio();
  }, [audioEnabled]);

  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [selectedAgentDetails, setSelectedAgentDetails] = useState(null);
  const [showGrid, setShowGrid] = useState(false);
  const [showNetwork, setShowNetwork] = useState(false);

  const [celebrate, setCelebrate] = useState(false);
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (status === 'done' && prev !== 'done') {
      const on = setTimeout(() => setCelebrate(true), 0);
      const off = setTimeout(() => setCelebrate(false), 8000);
      return () => { clearTimeout(on); clearTimeout(off); };
    }
  }, [status]);

  const personaMapRef = useRef({});
  useEffect(() => {
    let cancelled = false;
    fetchPersonaAvatarMap().then(map => {
      if (!cancelled && map) personaMapRef.current = map;
    });
    return () => { cancelled = true; };
  }, []);

  const agentsRef = useRef({});
  const seenVoiceQuotesRef = useRef(new Set());

  const handleVoiceEvent = React.useCallback((event) => {
    if (event.type !== 'agent_voice') return;
    const cleanId = cleanAgentId(event.agentId);
    if (!cleanId) return;
    if (!recordVoiceDedupeKey(seenVoiceQuotesRef.current, cleanId, event.quote)) return;

    const agent = resolveOrCreateSpeakingAgent(agentsRef.current, cleanId);
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
            lastActionTime: Date.now(),
          },
        };
      });
      if (isComplete) {
        scheduleVoiceBubbleClear(targetId, bubbleTimersRef, setAgents);
      }
    };

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
          lastActionTime: Date.now(),
        },
      };
    });

    triggerAgentSpeech(event.quote, agent, null, onSpeechProgress);
  }, []);

  const { agents, setAgents, isRunning } = useAgentEvents(
    events, status, { onVoiceEvent: handleVoiceEvent }
  );

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    const merged = mergeAvatarConfigsIntoAgents(agents, personaMapRef.current);
    if (merged) setAgents(merged);
  }, [agents, setAgents]);

  useEffect(() => {
    return () => {
      for (const timer of Object.values(bubbleTimersRef.current)) {
        clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedAgentId && agents[selectedAgentId]) {
      setSelectedAgentDetails(agents[selectedAgentId]);
    }
  }, [selectedAgentId, agents]);

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

  const controlsRef = useRef();
  const [dragState, setDragState] = useState(INITIAL_DRAG_STATE);

  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = useCallback((message, type = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const handleDropAgent = useCallback(async (agentId, fromRoom, toRoom) => {
    setAgents(prev => {
      const agent = prev[agentId];
      if (!agent) return prev;
      const moved = moveAgent(agent, toRoom, 'reassigned', `Moving to ${toRoom}`, 'start');
      return { ...prev, [agentId]: moved };
    });
    showToast(`${agentId} → ${toRoom.replace('_', ' ')}`, 'success');
    try {
      await fetch('/api/agent-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, room: toRoom, defaultRoom: fromRoom }),
      });
    } catch {}
  }, [setAgents, showToast]);

  const handleCancelDrag = useCallback(() => {
    if (!dragState.isDragging) return;
    if (controlsRef.current) controlsRef.current.enabled = true;
    setDragState(INITIAL_DRAG_STATE);
  }, [dragState.isDragging]);

  const handleStartDrag = useCallback((agentId) => {
    const agent = agents[agentId];
    if (!agent) return;
    if (controlsRef.current) controlsRef.current.enabled = false;
    setDragState({
      isDragging: true,
      draggedAgentId: agentId,
      dragPosition: { x: agent.x || agent.targetX || 0, z: agent.z || agent.targetZ || 0 },
      nearestRoom: null,
      dropAllowed: true,
      dropError: null,
    });
  }, [agents]);

  return (
    <div className={`agent-office ${!isExpanded ? 'agent-office--collapsed' : ''}`} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <OfficeToggleHeader
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        isRunning={isRunning}
        agents={agents}
      />

      {isExpanded && (
        <div style={{ flex: 1, position: 'relative', background: '#020617' }}>
          <OfficeOverlayControls
            showGrid={showGrid}
            setShowGrid={setShowGrid}
            showNetwork={showNetwork}
            setShowNetwork={setShowNetwork}
          />
          <Canvas
            shadows={{ type: THREE.PCFShadowMap }}
            camera={{ position: [0, 35, 30], fov: 45, near: 0.1, far: 600 }}
            onPointerMissed={handleCancelDrag}
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
              celebrate={celebrate}
              onStartDrag={handleStartDrag}
            />
          </Canvas>

          <AudioCaptions />
          <OfficeToastBanner toast={toast} />

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

function findNearestDropRoom(pos, dropTargetRooms, roomCenters) {
  let minDist = Infinity;
  let nearest = null;
  const dragVec = new THREE.Vector3(pos.x, 0, pos.z);
  for (const roomId of dropTargetRooms) {
    const center = roomCenters[roomId];
    if (!center) continue;
    const dist = dragVec.distanceTo(center);
    if (dist < minDist) {
      minDist = dist;
      nearest = roomId;
    }
  }
  return nearest;
}

function evaluateRoomDropConstraint(nearest, draggedAgentId, agents) {
  if (!nearest || !draggedAgentId) return { allowed: true, error: null };
  const agent = agents[draggedAgentId];
  const fromRoom = agent?.targetStation || agent?.station;
  if (!fromRoom) return { allowed: true, error: null };
  const result = canMoveAgent(draggedAgentId, fromRoom, nearest, agents);
  return { allowed: result.allowed, error: result.reason || null };
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

  useEffect(() => {
    if (!dragState.isDragging) return;

    const handleMove = () => {
      raycaster.setFromCamera(pointer, camera);
      if (!raycaster.ray.intersectPlane(dragPlane, intersectPoint.current)) return;
      const pos = { x: intersectPoint.current.x, z: intersectPoint.current.z };
      const nearest = findNearestDropRoom(pos, DROP_TARGET_ROOMS, roomCenters);
      const { allowed, error } = evaluateRoomDropConstraint(nearest, dragState.draggedAgentId, agents);

      setDragState(prev => ({
        ...prev,
        dragPosition: pos,
        nearestRoom: nearest,
        dropAllowed: allowed,
        dropError: error,
      }));
    };

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
      setDragState(INITIAL_DRAG_STATE);
    };

    window.addEventListener('pointermove', throttledMove);
    window.addEventListener('pointerup', handleUp);

    return () => {
      window.removeEventListener('pointermove', throttledMove);
      window.removeEventListener('pointerup', handleUp);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [dragState.isDragging, dragState.draggedAgentId, dragState.nearestRoom, dragState.dropAllowed, agents, camera, raycaster, pointer, dragPlane, roomCenters, DROP_TARGET_ROOMS, controlsRef, onDropAgent, setDragState]);

  return null;
}
