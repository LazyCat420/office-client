import React from 'react';

/**
 * WaterCooler — A classic office water cooler.
 */
export function WaterCooler({ position, rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Base Cabinet */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.4, 0.8, 0.4]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} />
      </mesh>
      
      {/* Drip Tray */}
      <mesh position={[0, 0.5, 0.22]} castShadow>
        <boxGeometry args={[0.2, 0.05, 0.1]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      {/* Spigots */}
      <mesh position={[-0.05, 0.6, 0.22]}>
        <cylinderGeometry args={[0.01, 0.01, 0.05]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
      <mesh position={[0.05, 0.6, 0.22]}>
        <cylinderGeometry args={[0.01, 0.01, 0.05]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>

      {/* Water Jug */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.5, 16]} />
        <meshPhysicalMaterial 
          color="#bae6fd"
          transmission={0.9}
          opacity={1}
          metalness={0}
          roughness={0.1}
          ior={1.5}
          thickness={0.5}
        />
      </mesh>
      {/* Jug neck */}
      <mesh position={[0, 0.82, 0]}>
        <cylinderGeometry args={[0.05, 0.18, 0.1, 16]} />
        <meshPhysicalMaterial 
          color="#bae6fd"
          transmission={0.9}
          roughness={0.1}
        />
      </mesh>
    </group>
  );
}
