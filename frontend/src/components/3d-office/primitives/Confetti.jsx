import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Confetti — Falling confetti particles using instanced meshes.
 * Celebratory effect for the trading floor.
 */
export function Confetti() {
  const count = 150;
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      temp.push({
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 8,
          Math.random() * 4 + 1,
          (Math.random() - 0.5) * 8
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.05,
          -0.02 - Math.random() * 0.05,
          (Math.random() - 0.5) * 0.05
        ),
        rotation: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
        rotSpeed: new THREE.Euler(Math.random() * 0.1, Math.random() * 0.1, Math.random() * 0.1),
        scale: Math.random() * 0.5 + 0.5
      });
    }
    return temp;
  }, []);

  const meshRef = useRef();

  useFrame(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    particles.forEach((particle, i) => {
      particle.position.add(particle.velocity);
      particle.rotation.x += particle.rotSpeed.x;
      particle.rotation.y += particle.rotSpeed.y;
      particle.rotation.z += particle.rotSpeed.z;

      // Reset when they hit the floor
      if (particle.position.y < 0) {
        particle.position.y = 4 + Math.random() * 2;
        particle.position.x = (Math.random() - 0.5) * 8;
        particle.position.z = (Math.random() - 0.5) * 8;
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
