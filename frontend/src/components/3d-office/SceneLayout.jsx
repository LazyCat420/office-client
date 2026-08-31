import React, { Suspense, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Environment } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Stations } from './Stations';
import { Agent } from './agent';
import { SkyscraperShell, CloudLayer, SkyDome } from './environment';
import { ToucanScene } from './ToucanScene';
import { Cat } from './primitives/Cat';
import { PaperManager } from './primitives/PaperManager';
import { RoomDropZones } from './RoomDropZones';
import { DebugNavMesh } from './routing/DebugNavMesh';

/**
 * SceneLayout — Orchestrates the full 100th floor trading office scene.
 * 
 * Layers (back to front):
 * 1. SkyDome — twilight gradient sky sphere (furthest)
 * 2. CloudLayer — instanced billboard clouds drifting around building
 * 3. SkyscraperShell — glass walls, columns, floor, ceiling
 * 4. Stations — room layout, furniture, trading pit
 * 5. ToucanScene — flying toucan + breakable glass cups
 * 6. Agents — dynamic characters
 * 7. RoomDropZones — visible only during agent drag operations
 * 
 * NOTE: The <Environment> component is CRITICAL — it provides the cubemap
 * that metallic materials reflect. Without it, any material with metalness > 0
 * reflects pure black and the entire room goes dark.
 */
export function SceneLayout({
  agents,
  selectedAgentId,
  onSelectAgent,
  onArriveAgent,
  // Drag system props
  dragState,
  onStartDrag,
  showGrid = false,
  showNetwork = false,
  celebrate = false,
}) {
  // When dragging, override the dragged agent's position for visual feedback
  const agentsWithDrag = useMemo(() => {
    if (!dragState?.isDragging || !dragState?.draggedAgentId || !dragState?.dragPosition) {
      return agents;
    }
    const dragged = agents[dragState.draggedAgentId];
    if (!dragged) return agents;

    return {
      ...agents,
      [dragState.draggedAgentId]: {
        ...dragged,
        // Override visual position to follow cursor
        _dragOverride: true,
        _dragX: dragState.dragPosition.x,
        _dragZ: dragState.dragPosition.z,
      },
    };
  }, [agents, dragState]);

  return (
    <>
      {/* Local environment reflections — gives metallic surfaces reflections without fetching external CDN HDR files */}
      <Environment environmentIntensity={0.35}>
        <color attach="background" args={['#0f172a']} />
        <mesh position={[0, 20, 0]} scale={[100, 100, 100]}>
          <sphereGeometry />
          <meshBasicMaterial color="#1e293b" side={THREE.BackSide} />
        </mesh>
      </Environment>

      {/* Lighting — tuned for a glass skyscraper at twilight */}
      <ambientLight intensity={0.8} color="#c8d8f0" />

      {/* Main sun/sky directional light — warm twilight from the west */}
      <directionalLight
        position={[30, 25, -10]}
        intensity={1.5}
        color="#ffd4a0"
        castShadow
        shadow-mapSize={[1024, 1024]}
      >
        <orthographicCamera attach="shadow-camera" args={[-40, 40, 40, -40]} />
      </directionalLight>

      {/* Blue sky fill from above */}
      <directionalLight
        position={[0, 40, 0]}
        intensity={0.6}
        color="#88aadd"
      />

      {/* Warm interior accent lights (ceiling fixtures — spread across floor) */}
      <pointLight position={[0, 4, 0]} intensity={1.2} color="#ffeedd" distance={35} decay={2} />
      <pointLight position={[10, 4, 10]} intensity={0.6} color="#ffeedd" distance={25} decay={2} />
      <pointLight position={[-10, 4, -10]} intensity={0.6} color="#ffeedd" distance={25} decay={2} />
      <pointLight position={[10, 4, -10]} intensity={0.5} color="#ffeedd" distance={25} decay={2} />
      <pointLight position={[-10, 4, 10]} intensity={0.5} color="#ffeedd" distance={25} decay={2} />

      {/* Horizon glow rim lights */}
      <pointLight position={[50, 0, 0]} intensity={0.4} color="#c4653a" distance={80} decay={2} />
      <pointLight position={[-50, 0, 0]} intensity={0.3} color="#d4854a" distance={80} decay={2} />

      <Suspense fallback={null}>
        <Physics gravity={[0, -9.81, 0]}>
          {/* ═══ Environment layers ═══ */}
          <SkyDome />
          <CloudLayer />
          <SkyscraperShell />
          {/* ═══ Visual Grid Overlay ═══ */}
          {showGrid && (
            <gridHelper
              args={[70, 70, '#38bdf8', '#1e293b']}
              position={[0, 0.02, 0]}
            />
          )}

          {/* ═══ Visual Node Proximity Network Overlay ═══ */}
          <DebugNavMesh agents={Object.values(agentsWithDrag)} visible={showNetwork} />

          {/* ═══ Interior ═══ */}
          <Stations celebrate={celebrate} />
          <PaperManager agents={agentsWithDrag} />

          {/* ═══ Toucan + Breakable Cups ═══ */}
          <ToucanScene />
          
          {/* ═══ Office Cat ═══ */}
          <Cat />

          {/* ═══ Drop Zone Indicators (visible during drag) ═══ */}
          <RoomDropZones
            isDragging={dragState?.isDragging}
            nearestRoom={dragState?.nearestRoom}
            dropAllowed={dragState?.dropAllowed}
            dropError={dragState?.dropError}
          />

          {/* ═══ Dynamic Agents ═══ */}
          {Object.values(agentsWithDrag).map((agent) => (
            <Agent
              key={agent.id}
              agent={agent}
              isSelected={selectedAgentId === agent.id}
              onSelect={onSelectAgent}
              onArrive={onArriveAgent}
              onStartDrag={onStartDrag}
              isDragTarget={dragState?.draggedAgentId === agent.id}
            />
          ))}
        </Physics>
      </Suspense>
    </>
  );
}


