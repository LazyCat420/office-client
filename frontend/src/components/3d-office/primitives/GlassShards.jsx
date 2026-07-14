import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createSeededRandom } from '../seededRandom';

// Hoisted scratch object — allocating one per frame churns the GC.
const dummy = new THREE.Object3D();

/**
 * GlassShards — Instanced glass shard particles that burst outward from a break point.
 * 
 * Props:
 *   position   — [x,y,z] break origin
 *   count      — number of shards (default 25)
 *   color      — glass tint color (default '#88ccee')
 *   scale      — overall shard size multiplier (default 1)
 *   direction  — [x,y,z] bias for shard ejection direction
 *   onComplete — callback when animation finishes
 */
export function GlassShards({
  position = [0, 0, 0],
  count = 25,
  color = '#88ccee',
  scale = 1,
  direction = [0, 0, 1],
  onComplete,
}) {
  const meshRef = useRef();
  const [alive, setAlive] = useState(true);
  const elapsed = useRef(0);
  const LIFETIME = 2.5; // seconds before cleanup

  const shards = useMemo(() => {
    const random = createSeededRandom(0x5eed + count);
    const dirVec = new THREE.Vector3(...direction).normalize();
    return Array.from({ length: count }, () => {
      // Random ejection velocity biased toward the direction
      const spread = 0.6;
      const vel = new THREE.Vector3(
        dirVec.x * (1.5 + random() * 2) + (random() - 0.5) * spread * 3,
        random() * 2.5 + 0.5,
        dirVec.z * (1.5 + random() * 2) + (random() - 0.5) * spread * 3
      );

      return {
        pos: new THREE.Vector3(
          (random() - 0.5) * 0.3,
          (random() - 0.5) * 0.3,
          (random() - 0.5) * 0.3
        ),
        vel,
        rot: new THREE.Euler(
          random() * Math.PI * 2,
          random() * Math.PI * 2,
          random() * Math.PI * 2
        ),
        rotSpeed: new THREE.Vector3(
          (random() - 0.5) * 15,
          (random() - 0.5) * 15,
          (random() - 0.5) * 15
        ),
        size: (0.03 + random() * 0.08) * scale,
      };
    });
  }, [count, direction, scale]);

  useFrame((_, delta) => {
    if (!alive || !meshRef.current) return;
    elapsed.current += delta;

    if (elapsed.current > LIFETIME) {
      setAlive(false);
      onComplete?.();
      return;
    }

    const progress = elapsed.current / LIFETIME;
    const opacity = Math.max(0, 1 - progress * progress);

    shards.forEach((shard, i) => {
      // Physics step
      shard.pos.x += shard.vel.x * delta;
      shard.pos.y += shard.vel.y * delta;
      shard.pos.z += shard.vel.z * delta;
      shard.vel.y -= 6.0 * delta; // gravity

      // Floor bounce
      if (shard.pos.y < -0.1) {
        shard.pos.y = -0.1;
        shard.vel.y *= -0.3;
        shard.vel.x *= 0.7;
        shard.vel.z *= 0.7;
      }

      shard.rot.x += shard.rotSpeed.x * delta;
      shard.rot.y += shard.rotSpeed.y * delta;
      shard.rot.z += shard.rotSpeed.z * delta;

      dummy.position.set(
        position[0] + shard.pos.x,
        position[1] + shard.pos.y,
        position[2] + shard.pos.z
      );
      dummy.rotation.copy(shard.rot);
      dummy.scale.setScalar(shard.size * opacity);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!alive) return null;

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <planeGeometry args={[1, 1]} />
      <meshPhysicalMaterial
        color={color}
        transparent
        opacity={0.6}
        roughness={0.05}
        metalness={0.3}
        clearcoat={1.0}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}
