import React from 'react';
import { RigidBody } from '@react-three/rapier';

/**
 * Table — Desk with a tabletop and four legs.
 * Used in every room for workstations, conference tables, counters.
 */
export function Table({ position, size = [2, 0.55, 1.2], color = '#451a03' }) {
  const [w, h, d] = size;
  return (
    <group position={position}>
      {/* Tabletop */}
      <RigidBody type="fixed" colliders="cuboid" restitution={0.2} friction={0.5}>
        <mesh position={[0, h - 0.03, 0]} castShadow receiveShadow>
          <boxGeometry args={[w, 0.06, d]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
      </RigidBody>
      {/* Legs */}
      <mesh position={[-w/2 + 0.1, h/2, -d/2 + 0.1]} castShadow>
        <boxGeometry args={[0.08, h - 0.06, 0.08]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[w/2 - 0.1, h/2, -d/2 + 0.1]} castShadow>
        <boxGeometry args={[0.08, h - 0.06, 0.08]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[-w/2 + 0.1, h/2, d/2 - 0.1]} castShadow>
        <boxGeometry args={[0.08, h - 0.06, 0.08]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[w/2 - 0.1, h/2, d/2 - 0.1]} castShadow>
        <boxGeometry args={[0.08, h - 0.06, 0.08]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
    </group>
  );
}
