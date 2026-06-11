import React, { useEffect, useState, useRef } from 'react';
import { RigidBody } from '@react-three/rapier';

// Global event bus for throwing papers
export const paperEvents = new EventTarget();

export const throwPaper = (position, velocity) => {
  paperEvents.dispatchEvent(new CustomEvent('throw', { detail: { position, velocity } }));
};

export function PaperManager({ agents }) {
  const [papers, setPapers] = useState([]);

  useEffect(() => {
    const handleThrow = (e) => {
      const { position, velocity } = e.detail;
      setPapers((prev) => [
        ...prev.slice(-39), // Keep max 40 thrown papers in the room
        {
          id: Math.random().toString(),
          position,
          velocity,
          createdAt: Date.now()
        }
      ]);
    };
    paperEvents.addEventListener('throw', handleThrow);
    return () => paperEvents.removeEventListener('throw', handleThrow);
  }, []);

  return (
    <group name="thrown-papers">
      {papers.map((p) => (
        <Paper key={p.id} position={p.position} velocity={p.velocity} />
      ))}
    </group>
  );
}

function Paper({ position, velocity }) {
  const rigidBody = useRef();

  useEffect(() => {
    if (rigidBody.current) {
      // Apply the initial throwing impulse
      rigidBody.current.applyImpulse({ x: velocity[0], y: velocity[1], z: velocity[2] }, true);
      // Add random torque so it flutters
      rigidBody.current.applyTorqueImpulse({
        x: (Math.random() - 0.5) * 0.05,
        y: (Math.random() - 0.5) * 0.05,
        z: (Math.random() - 0.5) * 0.05
      }, true);
    }
  }, [velocity]);

  return (
    <RigidBody
      ref={rigidBody}
      position={position}
      colliders="cuboid"
      mass={0.02}
      linearDamping={1.5}  // Air resistance for fluttery fall
      angularDamping={1.8}
      restitution={0.1}
      friction={0.8}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.21, 0.005, 0.297]} /> {/* A4 dimensions approximation */}
        <meshStandardMaterial color="#f8fafc" roughness={0.9} />
      </mesh>
    </RigidBody>
  );
}
