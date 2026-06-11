import React from 'react';

/**
 * PottedPlant — Decorative plant with pot, trunk, and canopy spheres.
 * Placed around room perimeters and the trading floor.
 */
export function PottedPlant({ position }) {
  return (
    <group position={position}>
      {/* Pot */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.18, 0.5, 10]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
      </mesh>
      {/* Trunk */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>
      {/* Main canopy */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <sphereGeometry args={[0.35, 12, 12]} />
        <meshStandardMaterial color="#166534" roughness={0.9} />
      </mesh>
      {/* Side foliage */}
      <mesh position={[0.15, 1.05, 0.15]} castShadow>
        <sphereGeometry args={[0.25, 10, 10]} />
        <meshStandardMaterial color="#15803d" roughness={0.9} />
      </mesh>
      <mesh position={[-0.15, 1.0, -0.1]} castShadow>
        <sphereGeometry args={[0.25, 10, 10]} />
        <meshStandardMaterial color="#15803d" roughness={0.9} />
      </mesh>
    </group>
  );
}
