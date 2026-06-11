import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { soundManager } from '../SoundManager';

/**
 * Toucan — A colorful animated toucan that flies randomly around the office.
 * It gently steers between random waypoints, keeping within the room bounds.
 * Occasionally swoops at breakable cups if any are provided.
 */

const FLY_Y = 2.5;       // Cruising altitude
const WING_SPEED = 12;    // Wing flap frequency
const SPEED = 5;          // Forward speed

export function Toucan({ glassCupPositions = [], onBreakCup }) {
  const groupRef = useRef();
  const wingLeftRef = useRef();
  const wingRightRef = useRef();

  // Boid-like wandering flight state
  const state = useRef({
    x: 0,
    y: FLY_Y,
    z: 0,
    targetX: (Math.random() - 0.5) * 30,
    targetZ: (Math.random() - 0.5) * 30,
    angle: 0,
    pitch: 0,
    bankAngle: 0,
    time: 0,
    phaseTime: 0,
    nextActionTime: 3 + Math.random() * 5,
    swoopTargetIdx: -1,
  });

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const s = state.current;
    s.time += delta;
    s.phaseTime += delta;

    const clampedDelta = Math.min(delta, 0.05);

    // ─── Wing flapping ───
    if (wingLeftRef.current && wingRightRef.current) {
      const flapAngle = Math.sin(s.time * WING_SPEED) * 0.5;
      wingLeftRef.current.rotation.z = flapAngle + 0.2;
      wingRightRef.current.rotation.z = -flapAngle - 0.2;
    }

    // Determine target based on swooping or wandering
    let tx = s.targetX;
    let tz = s.targetZ;
    let ty = FLY_Y + Math.sin(s.time * 0.8) * 0.5;

    // Phase transitions
    if (s.phaseTime > s.nextActionTime) {
      if (s.swoopTargetIdx >= 0) {
        // Was swooping, now wander
        s.swoopTargetIdx = -1;
      } else {
        // Pick a new wander target or swoop
        if (Math.random() < 0.3 && glassCupPositions.length > 0) {
          const available = glassCupPositions.map((pos, i) => ({ pos, i })).filter(c => c.pos);
          if (available.length > 0) {
            s.swoopTargetIdx = available[Math.floor(Math.random() * available.length)].i;
          }
        }
        
        if (s.swoopTargetIdx === -1) {
          // Wander target
          s.targetX = (Math.random() - 0.5) * 35;
          s.targetZ = (Math.random() - 0.5) * 35;
        }
      }
      s.phaseTime = 0;
      s.nextActionTime = 4 + Math.random() * 6;
    }

    if (s.swoopTargetIdx >= 0 && glassCupPositions[s.swoopTargetIdx]) {
      const targetPos = glassCupPositions[s.swoopTargetIdx];
      tx = targetPos[0];
      tz = targetPos[2];
      ty = targetPos[1] + 0.3;
      
      const dist = Math.sqrt((tx - s.x)**2 + (tz - s.z)**2);
      if (dist < 1.2) {
        onBreakCup?.(s.swoopTargetIdx);
        s.swoopTargetIdx = -1;
        s.phaseTime = 0;
        s.nextActionTime = 4 + Math.random() * 6;
        s.targetX = s.x + (Math.random() - 0.5) * 20;
        s.targetZ = s.z + (Math.random() - 0.5) * 20;
      }
    }

    // Steering
    const dx = tx - s.x;
    const dz = tz - s.z;
    const targetAngle = Math.atan2(dx, dz); // Using atan2(x, z) for Y-up 3D
    
    // Normalize angle difference
    let angleDiff = targetAngle - s.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // Smooth turn
    s.angle += angleDiff * 1.5 * clampedDelta;
    
    // Move forward
    s.x += Math.sin(s.angle) * SPEED * clampedDelta;
    s.z += Math.cos(s.angle) * SPEED * clampedDelta;
    s.y += (ty - s.y) * 2 * clampedDelta;

    // Bank and pitch
    const targetBank = -angleDiff * 0.5;
    s.bankAngle += (targetBank - s.bankAngle) * 3 * clampedDelta;
    const targetPitch = (s.y - ty) * 0.5;
    s.pitch += (targetPitch - s.pitch) * 3 * clampedDelta;

    // Keep within bounds
    if (s.x > 20) s.targetX = -10;
    if (s.x < -20) s.targetX = 10;
    if (s.z > 20) s.targetZ = -10;
    if (s.z < -20) s.targetZ = 10;

    // Position and rotation
    groupRef.current.position.set(s.x, s.y, s.z);
    
    // Face the direction of travel
    const faceAngle = s.angle - Math.PI / 2;
    groupRef.current.rotation.set(s.pitch, faceAngle, s.bankAngle);
  });

  return (
    <group ref={groupRef}>
      {/* ─── HITBOX ─── */}
      <mesh 
        onClick={(e) => {
          e.stopPropagation();
          soundManager.playQuack(true);
          state.current.y += 0.5;
          state.current.pitch -= 0.5;
        }}
        onPointerOver={() => document.body.style.cursor = 'pointer'}
        onPointerOut={() => document.body.style.cursor = 'auto'}
      >
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* ─── BODY ─── */}
      <mesh castShadow>
        <capsuleGeometry args={[0.15, 0.35, 4, 8]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
      </mesh>

      {/* Belly (white/yellow chest) */}
      <mesh position={[0, -0.02, 0.1]} castShadow>
        <capsuleGeometry args={[0.12, 0.25, 4, 8]} />
        <meshStandardMaterial color="#f5e642" roughness={0.5} />
      </mesh>

      {/* ─── HEAD ─── */}
      <mesh position={[0, 0.28, 0.05]} castShadow>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
      </mesh>

      {/* ─── BEAK — The iconic toucan beak ─── */}
      <group position={[0, 0.26, 0.18]}>
        {/* Main beak — large, colorful */}
        <mesh rotation={[0.2, 0, 0]} castShadow>
          <coneGeometry args={[0.06, 0.35, 6]} />
          <meshStandardMaterial color="#ff6b1a" roughness={0.3} />
        </mesh>
        {/* Beak tip — yellow/green gradient effect */}
        <mesh position={[0, -0.12, 0.04]} rotation={[0.3, 0, 0]}>
          <coneGeometry args={[0.04, 0.15, 5]} />
          <meshStandardMaterial color="#3edd3e" roughness={0.3} />
        </mesh>
        {/* Beak ridge — red top */}
        <mesh position={[0, 0.04, 0.02]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.04, 0.01, 0.28]} />
          <meshStandardMaterial color="#e63946" roughness={0.4} />
        </mesh>
      </group>

      {/* ─── EYES ─── */}
      {/* White ring */}
      <mesh position={[0.08, 0.32, 0.14]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
      <mesh position={[-0.08, 0.32, 0.14]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
      {/* Pupils */}
      <mesh position={[0.09, 0.33, 0.17]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.1} />
      </mesh>
      <mesh position={[-0.07, 0.33, 0.17]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.1} />
      </mesh>

      {/* Blue skin patch around eye (toucan feature) */}
      <mesh position={[0.07, 0.30, 0.12]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#1e90ff" roughness={0.5} />
      </mesh>
      <mesh position={[-0.07, 0.30, 0.12]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color="#1e90ff" roughness={0.5} />
      </mesh>

      {/* ─── WINGS ─── */}
      <group ref={wingLeftRef} position={[0.18, 0.05, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.35, 0.03, 0.25]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
        </mesh>
        {/* Wing tip — blue accent */}
        <mesh position={[0.15, 0, 0]}>
          <boxGeometry args={[0.1, 0.02, 0.2]} />
          <meshStandardMaterial color="#2563eb" roughness={0.5} />
        </mesh>
      </group>

      <group ref={wingRightRef} position={[-0.18, 0.05, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.35, 0.03, 0.25]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
        </mesh>
        {/* Wing tip — blue accent */}
        <mesh position={[-0.15, 0, 0]}>
          <boxGeometry args={[0.1, 0.02, 0.2]} />
          <meshStandardMaterial color="#2563eb" roughness={0.5} />
        </mesh>
      </group>

      {/* ─── TAIL ─── */}
      <mesh position={[0, 0.05, -0.25]} rotation={[-0.3, 0, 0]} castShadow>
        <boxGeometry args={[0.08, 0.04, 0.2]} />
        <meshStandardMaterial color="#e63946" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.08, -0.3]} rotation={[-0.4, 0, 0]}>
        <boxGeometry args={[0.06, 0.03, 0.15]} />
        <meshStandardMaterial color="#ff6b1a" roughness={0.5} />
      </mesh>

      {/* ─── FEET ─── */}
      <mesh position={[0.06, -0.22, 0.05]}>
        <boxGeometry args={[0.04, 0.06, 0.1]} />
        <meshStandardMaterial color="#555555" roughness={0.7} />
      </mesh>
      <mesh position={[-0.06, -0.22, 0.05]}>
        <boxGeometry args={[0.04, 0.06, 0.1]} />
        <meshStandardMaterial color="#555555" roughness={0.7} />
      </mesh>
    </group>
  );
}
