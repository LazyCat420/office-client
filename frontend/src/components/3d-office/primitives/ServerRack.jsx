import React from 'react';

/**
 * ServerRack — Tall cabinet with glass front and status LEDs.
 * Used in Trading Tools, Research, and Risk Management rooms.
 */
export function ServerRack({ position }) {
  return (
    <group position={position}>
      {/* Cabinet body */}
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 1.8, 0.8]} />
        <meshStandardMaterial color="#0f172a" roughness={0.8} />
      </mesh>
      {/* Glass front panel */}
      <mesh position={[0, 0.9, 0.41]}>
        <boxGeometry args={[0.7, 1.7, 0.02]} />
        <meshStandardMaterial color="#0ea5e9" transparent opacity={0.3} metalness={0.9} />
      </mesh>
      {/* Status LEDs */}
      <mesh position={[-0.25, 1.6, 0.43]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>
      <mesh position={[-0.25, 1.4, 0.43]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>
      <mesh position={[-0.25, 1.2, 0.43]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <mesh position={[-0.25, 1.0, 0.43]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>
    </group>
  );
}
