import React, { useMemo } from 'react';
import * as THREE from 'three';
import { OBSTACLES, ROOM_DOORWAYS } from './collisionMap';

export function DebugNavMesh({ visible, agents = [] }) {
  // Proximity calculations for nodes
  const proximityLines = useMemo(() => {
    if (!visible || !agents || agents.length < 1) return [];

    const BLDG_R = 32;
    const lines = [];
    const positions = agents.map(a => {
      // Use target position if walking, otherwise current
      return { 
        id: a.id, 
        x: a.targetX !== undefined ? a.targetX : (a.x || 0), 
        z: a.targetZ !== undefined ? a.targetZ : (a.z || 0) 
      };
    });

    for (let i = 0; i < positions.length; i++) {
      const p1 = positions[i];
      let minDst = Infinity;
      let maxDst = -1;
      let closest = null;
      let furthest = null;

      for (let j = 0; j < positions.length; j++) {
        if (i === j) continue;
        const p2 = positions[j];
        const dx = p1.x - p2.x;
        const dz = p1.z - p2.z;
        const distSq = dx * dx + dz * dz;

        if (distSq < minDst) {
          minDst = distSq;
          closest = p2;
        }
        if (distSq > maxDst) {
          maxDst = distSq;
          furthest = p2;
        }
      }

      if (closest) {
        lines.push({ 
          start: [p1.x, 0.5, p1.z], 
          end: [closest.x, 0.5, closest.z], 
          color: '#10b981', // green for closest
          type: 'closest'
        });
      }
      
      if (furthest) {
        lines.push({
          start: [p1.x, 0.5, p1.z],
          end: [furthest.x, 0.5, furthest.z],
          color: '#ef4444', // red for furthest
          type: 'furthest'
        });
      }

      // Calculate building edge points
      const distFromCenter = Math.sqrt(p1.x * p1.x + p1.z * p1.z);
      if (distFromCenter > 0.001) {
        // Nearest edge: same direction
        const nearestX = (p1.x / distFromCenter) * BLDG_R;
        const nearestZ = (p1.z / distFromCenter) * BLDG_R;
        lines.push({
          start: [p1.x, 0.5, p1.z],
          end: [nearestX, 0.5, nearestZ],
          color: '#10b981', // green for closest edge
          type: 'edge-nearest'
        });

        // Furthest edge: opposite direction
        const furthestX = -(p1.x / distFromCenter) * BLDG_R;
        const furthestZ = -(p1.z / distFromCenter) * BLDG_R;
        lines.push({
          start: [p1.x, 0.5, p1.z],
          end: [furthestX, 0.5, furthestZ],
          color: '#ef4444', // red for furthest edge
          type: 'edge-furthest'
        });
      } else {
        // Exactly at center
        lines.push({
          start: [0, 0.5, 0],
          end: [0, 0.5, BLDG_R],
          color: '#10b981',
          type: 'edge-nearest'
        });
        lines.push({
          start: [0, 0.5, 0],
          end: [0, 0.5, -BLDG_R],
          color: '#ef4444',
          type: 'edge-furthest'
        });
      }
    }
    return lines;
  }, [agents, visible]);

  if (!visible) return null;

  return (
    <group>
      {/* ── Static Obstacles ── */}
      {OBSTACLES.map((obs, i) => {
        if (obs.type === 'circle') {
          return (
            <group key={`obs-c-${i}`} position={[obs.x, 0.1, obs.z]}>
              <mesh>
                <cylinderGeometry args={[obs.r, obs.r, 0.1, 32]} />
                <meshBasicMaterial color="#ef4444" transparent opacity={0.2} wireframe />
              </mesh>
              {/* Center point node */}
              <mesh position={[0, 0.1, 0]}>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshBasicMaterial color="#ef4444" />
              </mesh>
            </group>
          );
        } else if (obs.type === 'box') {
          // We must rotate the box appropriately
          const angle = Math.atan2(obs.sin, obs.cos);
          return (
            <group key={`obs-b-${i}`} position={[obs.cx, 0.1, obs.cz]} rotation={[0, -angle, 0]}>
              <mesh>
                <boxGeometry args={[obs.hw * 2, 0.1, obs.hd * 2]} />
                <meshBasicMaterial color="#f59e0b" transparent opacity={0.2} wireframe />
              </mesh>
              {/* Corner nodes for routing */}
              <mesh position={[obs.hw, 0.1, obs.hd]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshBasicMaterial color="#f59e0b" />
              </mesh>
              <mesh position={[-obs.hw, 0.1, obs.hd]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshBasicMaterial color="#f59e0b" />
              </mesh>
              <mesh position={[obs.hw, 0.1, -obs.hd]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshBasicMaterial color="#f59e0b" />
              </mesh>
              <mesh position={[-obs.hw, 0.1, -obs.hd]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshBasicMaterial color="#f59e0b" />
              </mesh>
            </group>
          );
        }
        return null;
      })}

      {/* ── Doorway Nodes ── */}
      {Object.entries(ROOM_DOORWAYS).map(([room, [x, z]]) => (
        <group key={`door-${room}`} position={[x, 0.1, z]}>
          <mesh>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.6} />
          </mesh>
        </group>
      ))}

      {/* ── Proximity Lines and Nodes ── */}
      {proximityLines.map((line, i) => (
        <group key={`prox-${i}`}>
          {/* We draw a simple line using a thin cylinder between the two points */}
          {(() => {
            const dx = line.end[0] - line.start[0];
            const dy = line.end[1] - line.start[1];
            const dz = line.end[2] - line.start[2];
            const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (length === 0) return null;
            
            const midX = (line.start[0] + line.end[0]) / 2;
            const midY = (line.start[1] + line.end[1]) / 2;
            const midZ = (line.start[2] + line.end[2]) / 2;
            
            const direction = new THREE.Vector3(dx, dy, dz).normalize();
            const quaternion = new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              direction
            );
            
            return (
              <mesh position={[midX, midY, midZ]} quaternion={quaternion}>
                <cylinderGeometry args={[0.03, 0.03, length, 8]} />
                <meshBasicMaterial color={line.color} transparent opacity={0.4} />
              </mesh>
            );
          })()}
        </group>
      ))}
      
      {/* Agent Proximity Nodes (glow around the agent) */}
      {agents.map(a => {
        const x = a.targetX !== undefined ? a.targetX : (a.x || 0);
        const z = a.targetZ !== undefined ? a.targetZ : (a.z || 0);
        return (
          <mesh key={`agent-node-${a.id}`} position={[x, 0.5, z]}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshBasicMaterial color={a.color || '#ffffff'} transparent opacity={0.5} wireframe />
          </mesh>
        );
      })}
    </group>
  );
}
