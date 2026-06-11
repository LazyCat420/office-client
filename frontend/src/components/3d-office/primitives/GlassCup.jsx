import React, { useRef, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GlassShards } from './GlassShards';

/**
 * GlassCup — A breakable glass cup (tumbler style).
 * 
 * When the toucan collides with it, the cup disappears and spawns glass shards.
 * 
 * Props:
 *   position — [x,y,z] world position
 *   height   — cup height (default 0.22)
 *   radius   — cup radius (default 0.06)
 *   color    — glass tint (default '#c8e6ff')
 *   onBreak  — callback when broken
 */
export function GlassCup({
  position = [0, 0, 0],
  height = 0.22,
  radius = 0.06,
  color = '#c8e6ff',
  onBreak,
}) {
  const [broken, setBroken] = useState(false);
  const groupRef = useRef();

  const handleBreak = useCallback(() => {
    if (broken) return;
    setBroken(true);
    onBreak?.();
  }, [broken, onBreak]);

  // Expose break method via ref for toucan collision detection
  // Store position and break callback on the mesh userData for collision checks
  const meshRef = useRef();

  if (broken) {
    return (
      <GlassShards
        position={position}
        count={18}
        color={color}
        scale={0.5}
        direction={[0, 1, 0]}
      />
    );
  }

  return (
    <group ref={groupRef} position={position}>
      {/* Cup body — open-top cylinder (looks like glass) */}
      <mesh
        ref={meshRef}
        castShadow
        userData={{
          breakable: true,
          breakFn: handleBreak,
          radius: Math.max(radius, height / 2) + 0.05,
        }}
      >
        {/* Outer shell */}
        <cylinderGeometry args={[radius, radius * 0.85, height, 12, 1, true]} />
        <meshPhysicalMaterial
          color={color}
          transparent
          opacity={0.35}
          roughness={0.02}
          metalness={0.1}
          clearcoat={1.0}
          clearcoatRoughness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Bottom disc */}
      <mesh position={[0, -height / 2 + 0.003, 0]} castShadow>
        <cylinderGeometry args={[radius * 0.85, radius * 0.85, 0.006, 12]} />
        <meshPhysicalMaterial
          color={color}
          transparent
          opacity={0.45}
          roughness={0.02}
          metalness={0.1}
          clearcoat={1.0}
        />
      </mesh>

      {/* Rim highlight */}
      <mesh position={[0, height / 2 - 0.003, 0]}>
        <torusGeometry args={[radius, 0.004, 6, 12]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.5}
          emissive="#aaddff"
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
}
