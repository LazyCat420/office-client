import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

/**
 * Monitor — Screen on a stand with optional animated chart bars.
 * Used on desks across the trading floor.
 */
export function Monitor({ position, rotation = [0, 0, 0], screenColor = '#38bdf8', showChart = false }) {
  const lineRef1 = useRef();
  const lineRef2 = useRef();
  const lineRef3 = useRef();

  useFrame((state) => {
    if (!showChart) return;
    const t = state.clock.getElapsedTime();
    // Unique offset based on spatial position so charts fluctuate out of sync
    const spatialOffset = (position[0] || 0) * 4.3 + (position[2] || 0) * 1.7;
    const time = t * 2.5 + spatialOffset;

    if (lineRef1.current) {
      const h = 0.05 + Math.abs(Math.sin(time * 1.5)) * 0.25;
      lineRef1.current.scale.y = h;
      lineRef1.current.position.y = 0.35 - 0.175 + h / 2;
    }
    if (lineRef2.current) {
      const h = 0.05 + Math.abs(Math.cos(time * 2.1)) * 0.25;
      lineRef2.current.scale.y = h;
      lineRef2.current.position.y = 0.35 - 0.175 + h / 2;
    }
    if (lineRef3.current) {
      const h = 0.05 + Math.abs(Math.sin(time * 1.1)) * 0.25;
      lineRef3.current.scale.y = h;
      lineRef3.current.position.y = 0.35 - 0.175 + h / 2;
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Base */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <boxGeometry args={[0.2, 0.04, 0.15]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      {/* Neck */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[0.04, 0.25, 0.04]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      {/* Bezel */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.65, 0.4, 0.04]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 0.35, 0.022]}>
        <boxGeometry args={[0.6, 0.35, 0.01]} />
        <meshBasicMaterial color={showChart ? '#050b18' : screenColor} />
      </mesh>
      {/* Chart bars */}
      {showChart && (
        <group position={[0, 0, 0.028]}>
          <mesh ref={lineRef1} position={[-0.15, 0.35, 0]}>
            <boxGeometry args={[0.08, 1, 0.005]} />
            <meshBasicMaterial color="#22c55e" />
          </mesh>
          <mesh ref={lineRef2} position={[0, 0.35, 0]}>
            <boxGeometry args={[0.08, 1, 0.005]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          <mesh ref={lineRef3} position={[0.15, 0.35, 0]}>
            <boxGeometry args={[0.08, 1, 0.005]} />
            <meshBasicMaterial color="#facc15" />
          </mesh>
        </group>
      )}
    </group>
  );
}
