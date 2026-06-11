import React from 'react';

/**
 * Couch — Seating with cushion, backrest, and armrests.
 * Used in lobby, break room, and executive offices.
 */
export function Couch({ position, rotation = [0, 0, 0], width = 2 }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Seat cushion */}
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.25, 0.8]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.8} />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, 0.55, -0.35]} castShadow>
        <boxGeometry args={[width, 0.5, 0.15]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.8} />
      </mesh>
      {/* Left armrest */}
      <mesh position={[-width/2 + 0.075, 0.35, 0]} castShadow>
        <boxGeometry args={[0.15, 0.45, 0.8]} />
        <meshStandardMaterial color="#172554" roughness={0.8} />
      </mesh>
      {/* Right armrest */}
      <mesh position={[width/2 - 0.075, 0.35, 0]} castShadow>
        <boxGeometry args={[0.15, 0.45, 0.8]} />
        <meshStandardMaterial color="#172554" roughness={0.8} />
      </mesh>
    </group>
  );
}
