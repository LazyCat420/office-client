/**
 * RoomDropZones.jsx
 *
 * Visual drop zone indicators rendered during agent drag operations.
 * Shows glowing ring/disc at each room center when an agent is being dragged.
 * The nearest room gets highlighted (green = allowed, red = blocked).
 */

import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { STATIONS } from './routing/stateMachine';

const DROP_TARGET_ROOMS = [
  'lobby', 'research', 'desk', 'debate', 'inbox',
  'error', 'tool_bench', 'smoke_break',
];

function RoomDropZone({ roomId, isNearest, dropAllowed, dropError }) {
  const station = STATIONS[roomId];
  if (!station) return null;

  const isHighlighted = isNearest;
  const color = isHighlighted
    ? (dropAllowed ? '#10b981' : '#ef4444')
    : 'rgba(100, 116, 139, 0.3)';

  const glowOpacity = isHighlighted ? 0.35 : 0.08;
  const ringOpacity = isHighlighted ? 0.8 : 0.2;

  const meshRef = React.useRef();
  const ringRef = React.useRef();

  // Gentle pulse animation for the nearest room
  useFrame((state) => {
    if (!meshRef.current) return;
    if (isHighlighted) {
      const pulse = 0.8 + Math.sin(state.clock.getElapsedTime() * 4) * 0.2;
      meshRef.current.scale.set(pulse, 1, pulse);
    } else {
      meshRef.current.scale.set(1, 1, 1);
    }
  });

  return (
    <group position={[station.x, 0.03, station.z]}>
      {/* Glow disc */}
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[5, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={glowOpacity}
          depthWrite={false}
        />
      </mesh>

      {/* Ring border */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[4.5, 5.0, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={ringOpacity}
          depthWrite={false}
        />
      </mesh>

      {/* Room label overlay */}
      {isHighlighted && (
        <Html position={[0, 1.5, 0]} center>
          <div style={{
            background: dropAllowed
              ? 'rgba(16, 185, 129, 0.9)'
              : 'rgba(239, 68, 68, 0.9)',
            color: '#ffffff',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '700',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: dropAllowed
              ? '0 0 20px rgba(16, 185, 129, 0.5)'
              : '0 0 20px rgba(239, 68, 68, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
          }}>
            <span>{dropAllowed ? '✅' : '❌'} {station.icon} {station.label}</span>
            {dropError && (
              <span style={{
                fontSize: '9px',
                fontWeight: '400',
                opacity: 0.9,
                maxWidth: '200px',
                textAlign: 'center',
              }}>
                {dropError}
              </span>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * RoomDropZones — renders all drop zones during a drag operation.
 */
export function RoomDropZones({ isDragging, nearestRoom, dropAllowed, dropError }) {
  if (!isDragging) return null;

  return (
    <group>
      {DROP_TARGET_ROOMS.map(roomId => (
        <RoomDropZone
          key={roomId}
          roomId={roomId}
          isNearest={nearestRoom === roomId}
          dropAllowed={nearestRoom === roomId ? dropAllowed : true}
          dropError={nearestRoom === roomId ? dropError : null}
        />
      ))}
    </group>
  );
}
