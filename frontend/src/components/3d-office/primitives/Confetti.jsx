import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createSeededRandom } from '../seededRandom';

// Hoisted scratch object — allocating one per frame churns the GC.
const dummy = new THREE.Object3D();

/**
 * Confetti — Falling confetti particles using instanced meshes.
 * Celebratory effect for the trading floor.
 */
export function Confetti() {
  const count = 150;
  const particles = useMemo(() => {
    const random = createSeededRandom(0xc0ffee);
    const temp = [];
    for (let i = 0; i < count; i++) {
      temp.push({
        position: new THREE.Vector3(
          (random() - 0.5) * 8,
          random() * 4 + 1,
          (random() - 0.5) * 8
        ),
        velocity: new THREE.Vector3(
          (random() - 0.5) * 0.05,
          -0.02 - random() * 0.05,
          (random() - 0.5) * 0.05
        ),
        rotation: new THREE.Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI),
        rotSpeed: new THREE.Euler(random() * 0.1, random() * 0.1, random() * 0.1),
        scale: random() * 0.5 + 0.5,
      });
    }
    return temp;
  }, []);

  const meshRef = useRef();
  const respawnRandom = useRef(createSeededRandom(0xfa11));

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    // Velocities were tuned per-frame at 60fps — scale by dt so speed is
    // framerate-independent.
    const step = Math.min(delta, 0.1) * 60;
    const random = respawnRandom.current;
    particles.forEach((particle, i) => {
      particle.position.addScaledVector(particle.velocity, step);
      particle.rotation.x += particle.rotSpeed.x * step;
      particle.rotation.y += particle.rotSpeed.y * step;
      particle.rotation.z += particle.rotSpeed.z * step;

      // Reset when they hit the floor
      if (particle.position.y < 0) {
        particle.position.y = 4 + random() * 2;
        particle.position.x = (random() - 0.5) * 8;
        particle.position.z = (random() - 0.5) * 8;
      }

      dummy.position.copy(particle.position);
      dummy.rotation.copy(particle.rotation);
      dummy.scale.setScalar(particle.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]} castShadow>
      <planeGeometry args={[0.08, 0.04]} />
      <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
    </instancedMesh>
  );
}
