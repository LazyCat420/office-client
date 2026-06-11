import React from 'react';

/**
 * Chair — Office chair with seat, backrest, pedestal, and base.
 * Used at desks and workstations throughout the trading floor.
 */
export function Chair({ position, rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Seat */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.4, 0.05, 0.4]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, 0.65, -0.18]} castShadow>
        <boxGeometry args={[0.4, 0.45, 0.05]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>
      {/* Armrests */}
      <mesh position={[0.22, 0.48, 0]} castShadow>
        <boxGeometry args={[0.04, 0.02, 0.3]} />
        <meshStandardMaterial color="#334155" roughness={0.7} />
      </mesh>
      <mesh position={[-0.22, 0.48, 0]} castShadow>
        <boxGeometry args={[0.04, 0.02, 0.3]} />
        <meshStandardMaterial color="#334155" roughness={0.7} />
      </mesh>
      {/* Armrest supports */}
      <mesh position={[0.22, 0.42, 0]} castShadow>
        <boxGeometry args={[0.02, 0.12, 0.02]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
      <mesh position={[-0.22, 0.42, 0]} castShadow>
        <boxGeometry args={[0.02, 0.12, 0.02]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
      {/* Pedestal */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.3, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.2} />
      </mesh>
      {/* 5-point Base */}
      {Array.from({ length: 5 }).map((_, i) => (
        <group key={i} rotation={[0, (Math.PI * 2 * i) / 5, 0]}>
          <mesh position={[0, 0.05, 0.15]}>
            <boxGeometry args={[0.03, 0.02, 0.3]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          {/* Wheel caster */}
          <mesh position={[0, 0.02, 0.28]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial color="#000000" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
