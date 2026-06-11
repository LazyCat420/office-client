import React from 'react';

/**
 * Wall — Solid or glass partition segment.
 * Reusable across room dividers, outer walls, and interior partitions.
 */
export function Wall({ position, size, type = 'solid', rotation = [0, 0, 0] }) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      {type === 'glass' ? (
        <meshStandardMaterial 
          color="#0ea5e9" 
          transparent 
          opacity={0.3} 
          roughness={0.1} 
          metalness={0.9} 
        />
      ) : (
        <meshStandardMaterial 
          color="#334155" 
          roughness={0.8} 
        />
      )}
    </mesh>
  );
}
