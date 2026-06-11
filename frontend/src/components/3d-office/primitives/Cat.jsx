import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Cat — A cute low-poly office cat that wanders around and sleeps on furniture.
 */

const CAT_SPEED = 2;
const BOUND_XZ = 18;

// Possible states
const STATE = {
  WANDERING: 'wandering',
  SLEEPING: 'sleeping',
};

export function Cat() {
  const groupRef = useRef();
  const tailRef = useRef();
  const headRef = useRef();
  const [isSleeping, setIsSleeping] = useState(false);

  const state = useRef({
    phase: STATE.WANDERING,
    x: 5,
    y: 0.25, // floor level
    z: 5,
    targetX: 0,
    targetZ: 0,
    targetY: 0.25, // Can jump to tables
    angle: 0,
    time: 0,
    phaseTime: 0,
    nextActionTime: 5,
  });

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const s = state.current;
    s.time += delta;
    s.phaseTime += delta;

    const clampedDelta = Math.min(delta, 0.05);

    if (s.phase === STATE.WANDERING) {
      // Tail swish and head bob while walking
      if (tailRef.current) {
        tailRef.current.rotation.z = Math.sin(s.time * 5) * 0.3;
      }
      if (headRef.current) {
        headRef.current.position.y = 0.35 + Math.abs(Math.sin(s.time * 8)) * 0.05;
      }

      // Check if reached target
      const dx = s.targetX - s.x;
      const dz = s.targetZ - s.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.5 || s.phaseTime > s.nextActionTime) {
        // Decide next action
        if (Math.random() < 0.3) {
          // Go to sleep!
          s.phase = STATE.SLEEPING;
          setIsSleeping(true);
          s.phaseTime = 0;
          s.nextActionTime = 10 + Math.random() * 20; // Sleep for 10-30s
          
          // Flatten head and tail for sleeping
          if (headRef.current) headRef.current.position.y = 0.15;
          if (tailRef.current) tailRef.current.rotation.z = -0.5;
        } else {
          // Pick new wander point
          s.targetX = (Math.random() - 0.5) * BOUND_XZ * 2;
          s.targetZ = (Math.random() - 0.5) * BOUND_XZ * 2;
          
          // 20% chance to jump onto a desk/chair height
          if (Math.random() < 0.2) {
            s.targetY = 1.0; // desk height
          } else {
            s.targetY = 0.25; // floor
          }
          
          s.phaseTime = 0;
          s.nextActionTime = 5 + Math.random() * 5;
        }
      } else {
        // Move towards target
        const targetAngle = Math.atan2(dx, dz);
        let angleDiff = targetAngle - s.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        s.angle += angleDiff * 3 * clampedDelta;
        
        s.x += Math.sin(s.angle) * CAT_SPEED * clampedDelta;
        s.z += Math.cos(s.angle) * CAT_SPEED * clampedDelta;
        s.y += (s.targetY - s.y) * 5 * clampedDelta; // smoothly jump/fall
      }
    } else if (s.phase === STATE.SLEEPING) {
      // Gentle breathing animation
      const breathe = Math.sin(s.time * 2) * 0.02;
      groupRef.current.scale.set(1, 1 + breathe, 1);
      
      if (s.phaseTime > s.nextActionTime) {
        // Wake up
        s.phase = STATE.WANDERING;
        setIsSleeping(false);
        s.phaseTime = 0;
        groupRef.current.scale.set(1, 1, 1);
      }
    }

    // Position and rotation
    groupRef.current.position.set(s.x, s.y, s.z);
    groupRef.current.rotation.y = s.angle - Math.PI / 2;
  });

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh castShadow position={[0, 0, 0]}>
        <boxGeometry args={[0.5, 0.3, 0.25]} />
        <meshStandardMaterial color="#333333" roughness={0.9} />
      </mesh>
      
      {/* Belly */}
      <mesh castShadow position={[0, -0.05, 0.05]}>
        <boxGeometry args={[0.4, 0.2, 0.21]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>

      {/* Head */}
      <group ref={headRef} position={[0.25, 0.35, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.25, 0.25, 0.25]} />
          <meshStandardMaterial color="#333333" roughness={0.9} />
        </mesh>
        
        {/* Ears */}
        <mesh castShadow position={[0.05, 0.18, 0.08]} rotation={[0, 0, -0.2]}>
          <coneGeometry args={[0.05, 0.15, 4]} />
          <meshStandardMaterial color="#333333" roughness={0.9} />
        </mesh>
        <mesh castShadow position={[0.05, 0.18, -0.08]} rotation={[0, 0, -0.2]}>
          <coneGeometry args={[0.05, 0.15, 4]} />
          <meshStandardMaterial color="#333333" roughness={0.9} />
        </mesh>
        
        {/* Eyes (only visible when wandering) */}
        {!isSleeping && (
          <>
            <mesh position={[0.13, 0.05, 0.06]}>
              <boxGeometry args={[0.02, 0.06, 0.06]} />
              <meshStandardMaterial color="#fcd34d" emissive="#fcd34d" />
            </mesh>
            <mesh position={[0.13, 0.05, -0.06]}>
              <boxGeometry args={[0.02, 0.06, 0.06]} />
              <meshStandardMaterial color="#fcd34d" emissive="#fcd34d" />
            </mesh>
          </>
        )}
        
        {/* Nose */}
        <mesh position={[0.13, -0.02, 0]}>
          <boxGeometry args={[0.02, 0.04, 0.04]} />
          <meshStandardMaterial color="#f472b6" />
        </mesh>
      </group>

      {/* Tail */}
      <group position={[-0.25, 0.1, 0]}>
        <mesh ref={tailRef} castShadow position={[-0.15, 0.1, 0]} rotation={[0, 0, -0.5]}>
          <cylinderGeometry args={[0.02, 0.03, 0.4]} />
          <meshStandardMaterial color="#333333" roughness={0.9} />
        </mesh>
      </group>

      {/* Legs */}
      <mesh castShadow position={[0.15, -0.2, 0.08]}>
        <boxGeometry args={[0.08, 0.2, 0.08]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0.15, -0.2, -0.08]}>
        <boxGeometry args={[0.08, 0.2, 0.08]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[-0.15, -0.2, 0.08]}>
        <boxGeometry args={[0.08, 0.2, 0.08]} />
        <meshStandardMaterial color="#333333" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[-0.15, -0.2, -0.08]}>
        <boxGeometry args={[0.08, 0.2, 0.08]} />
        <meshStandardMaterial color="#333333" roughness={0.9} />
      </mesh>
    </group>
  );
}
