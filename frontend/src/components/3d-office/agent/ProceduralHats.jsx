import React from 'react';
import * as THREE from 'three';

// Define static tie shape and extrude settings at module level to avoid conditional hook errors
const TIE_SHAPE = new THREE.Shape();
TIE_SHAPE.moveTo(-0.02, 0.08);
TIE_SHAPE.lineTo(0.02, 0.08);
TIE_SHAPE.lineTo(0.045, -0.28);
TIE_SHAPE.lineTo(0, -0.34);
TIE_SHAPE.lineTo(-0.045, -0.28);
TIE_SHAPE.closePath();

const TIE_EXTRUDE_SETTINGS = {
  depth: 0.012,
  bevelEnabled: true,
  bevelSegments: 3,
  steps: 1,
  bevelSize: 0.004,
  bevelThickness: 0.004,
};

/**
 * ProceduralHats built as exact parametric solids
 * adhering to the /threejs workflow guidelines.
 */
export function ProceduralHat({ type, mainColor, accentColor }) {
  if (!type || type === 'none') return null;

  // Top Hat
  if (type === 'top_hat') {
    return (
      <group position={[0, 0.85, 0]}>
        {/* Brim */}
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.05, 32]} />
          <meshStandardMaterial color={mainColor || '#111'} roughness={0.9} />
        </mesh>
        {/* Crown */}
        <mesh position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.35, 0.35, 0.6, 32]} />
          <meshStandardMaterial color={mainColor || '#111'} roughness={0.9} />
        </mesh>
        {/* Hat Band */}
        <mesh position={[0, 0.05, 0]} castShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.1, 32]} />
          <meshStandardMaterial color={accentColor || '#ef4444'} roughness={0.5} />
        </mesh>
      </group>
    );
  }

  // Baseball Cap
  if (type === 'cap') {
    return (
      <group position={[0, 0.8, 0.05]}>
        {/* Dome (half sphere) */}
        <mesh position={[0, 0, 0]} castShadow>
          <sphereGeometry args={[0.41, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={mainColor || '#3b82f6'} roughness={0.7} />
        </mesh>
        {/* Visor */}
        <mesh position={[0, 0.0, 0.25]} rotation={[-0.1, 0, 0]} scale={[1, 0.15, 1]} castShadow>
          <sphereGeometry args={[0.4]} />
          <meshStandardMaterial color={mainColor || '#3b82f6'} roughness={0.7} />
        </mesh>
        {/* Top Button */}
        <mesh position={[0, 0.41, 0]} castShadow>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshStandardMaterial color={accentColor || '#1e293b'} roughness={0.7} />
        </mesh>
      </group>
    );
  }

  // Crown
  if (type === 'crown') {
    return (
      <group position={[0, 0.85, 0]}>
        {/* Crown Base */}
        <mesh position={[0, 0.1, 0]} castShadow>
          {/* Cylinder without top cap, we'll fake the spikes with a texture or just use cones */}
          <cylinderGeometry args={[0.35, 0.3, 0.2, 16, 1, true]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} side={2} />
        </mesh>
        {/* Spikes */}
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const x = Math.cos(angle) * 0.35;
          const z = Math.sin(angle) * 0.35;
          return (
            <mesh key={i} position={[x, 0.25, z]} rotation={[0.1, -angle, 0]} castShadow>
              <coneGeometry args={[0.08, 0.25, 4]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
            </mesh>
          );
        })}
        {/* Jewels */}
        {Array.from({ length: 4 }).map((_, i) => {
          const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const x = Math.cos(angle) * 0.36;
          const z = Math.sin(angle) * 0.36;
          return (
            <mesh key={i} position={[x, 0.1, z]} rotation={[0, -angle, 0]} castShadow>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshStandardMaterial color={accentColor || '#ef4444'} roughness={0.1} metalness={0.5} />
            </mesh>
          );
        })}
      </group>
    );
  }

  // Beanie
  if (type === 'beanie') {
    return (
      <group position={[0, 0.8, 0]}>
        {/* Main Body */}
        <mesh position={[0, 0.05, 0]} scale={[1, 1.2, 1]} castShadow>
          <sphereGeometry args={[0.41, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={mainColor || '#f59e0b'} roughness={0.9} />
        </mesh>
        {/* Folded edge */}
        <mesh position={[0, 0.05, 0]} castShadow>
          <torusGeometry args={[0.4, 0.07, 16, 32]} />
          <meshStandardMaterial color={mainColor || '#f59e0b'} roughness={0.9} />
        </mesh>
        {/* Pom pom */}
        <mesh position={[0, 0.55, 0]} castShadow>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color={accentColor || '#fff'} roughness={0.9} />
        </mesh>
      </group>
    );
  }

  // Glasses — Goofy bottlecap thick glasses
  // Big round frames with thick black rims and convex lenses
  // that create a magnifying "bottle-bottom" distortion effect
  if (type === 'glasses') {
    const lensRadius = 0.16;      // Big oversized round lenses
    const rimThickness = 0.035;   // Thick chunky black rims
    const lensOffset = 0.19;      // Horizontal offset from center
    const lensDepth = 0.06;       // How far forward the lenses sit (reduced from 0.12 to sit on face)

    return (
      <group position={[0, 0.7, 0.36]} rotation={[-Math.PI / 4, 0, 0]}>
        {/* ===== LEFT LENS ASSEMBLY ===== */}
        <group position={[-lensOffset, 0, lensDepth]}>
          {/* Thick black rim — big round torus */}
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[lensRadius, rimThickness, 16, 32]} />
            <meshStandardMaterial color="#0a0a0a" roughness={0.75} metalness={0.2} />
          </mesh>
          {/* Inner rim edge (gives depth to the frame) */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[lensRadius - rimThickness * 0.5, rimThickness * 0.4, 12, 32]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
          </mesh>
          {/* Thick convex glass lens — bottle-bottom effect */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <sphereGeometry args={[lensRadius - 0.01, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshPhysicalMaterial
              color="#e8f4ff"
              transparent
              opacity={0.4}
              transmission={0.85}
              thickness={5.0}
              roughness={0.02}
              ior={1.8}
              metalness={0.0}
              clearcoat={1.0}
              clearcoatRoughness={0.0}
              envMapIntensity={1.2}
              side={2}
            />
          </mesh>
          {/* Rear flat lens cap — seals the lens volume */}
          <mesh position={[0, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[lensRadius - 0.01, 32]} />
            <meshPhysicalMaterial
              color="#dceeff"
              transparent
              opacity={0.3}
              transmission={0.85}
              thickness={3.0}
              roughness={0.05}
              ior={1.8}
              clearcoat={1.0}
              side={2}
            />
          </mesh>
          {/* Specular highlight ring — icy glint on thick glass */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[lensRadius * 0.3, lensRadius * 0.6, 32]} />
            <meshStandardMaterial
              color="#ffffff"
              transparent
              opacity={0.15}
              emissive="#aaccff"
              emissiveIntensity={0.4}
            />
          </mesh>
        </group>

        {/* ===== RIGHT LENS ASSEMBLY ===== */}
        <group position={[lensOffset, 0, lensDepth]}>
          {/* Thick black rim */}
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[lensRadius, rimThickness, 16, 32]} />
            <meshStandardMaterial color="#0a0a0a" roughness={0.75} metalness={0.2} />
          </mesh>
          {/* Inner rim edge */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[lensRadius - rimThickness * 0.5, rimThickness * 0.4, 12, 32]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
          </mesh>
          {/* Thick convex glass lens */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <sphereGeometry args={[lensRadius - 0.01, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshPhysicalMaterial
              color="#e8f4ff"
              transparent
              opacity={0.4}
              transmission={0.85}
              thickness={5.0}
              roughness={0.02}
              ior={1.8}
              metalness={0.0}
              clearcoat={1.0}
              clearcoatRoughness={0.0}
              envMapIntensity={1.2}
              side={2}
            />
          </mesh>
          {/* Rear flat lens cap */}
          <mesh position={[0, -0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[lensRadius - 0.01, 32]} />
            <meshPhysicalMaterial
              color="#dceeff"
              transparent
              opacity={0.3}
              transmission={0.85}
              thickness={3.0}
              roughness={0.05}
              ior={1.8}
              clearcoat={1.0}
              side={2}
            />
          </mesh>
          {/* Specular highlight ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[lensRadius * 0.3, lensRadius * 0.6, 32]} />
            <meshStandardMaterial
              color="#ffffff"
              transparent
              opacity={0.15}
              emissive="#aaccff"
              emissiveIntensity={0.4}
            />
          </mesh>
        </group>

        {/* ===== BRIDGE — Thick chunky nose bridge ===== */}
        <mesh position={[0, -0.02, lensDepth]}>
          <boxGeometry args={[lensOffset * 2 - lensRadius * 2 + 0.08, 0.055, 0.045]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.75} metalness={0.15} />
        </mesh>
        {/* Bridge arch (rounded top) */}
        <mesh position={[0, 0.01, lensDepth]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.04, 0.025, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.85} />
        </mesh>

        {/* ===== TEMPLE ARMS — Thick black arms with curved ends ===== */}
        {/* Left arm */}
        <mesh position={[-(lensOffset + lensRadius + 0.01), 0, lensDepth * 0.5 - 0.12]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.30, 0.045, 0.038]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.75} metalness={0.15} />
        </mesh>
        {/* Left arm curved ear hook */}
        <mesh position={[-(lensOffset + lensRadius + 0.01), -0.06, -0.20]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.038, 0.10, 0.038]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.75} metalness={0.15} />
        </mesh>
        {/* Left hinge detail */}
        <mesh position={[-(lensOffset + lensRadius - 0.01), 0, lensDepth - 0.02]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color="#222" metalness={0.6} roughness={0.3} />
        </mesh>

        {/* Right arm */}
        <mesh position={[(lensOffset + lensRadius + 0.01), 0, lensDepth * 0.5 - 0.12]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.30, 0.045, 0.038]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.75} metalness={0.15} />
        </mesh>
        {/* Right arm curved ear hook */}
        <mesh position={[(lensOffset + lensRadius + 0.01), -0.06, -0.20]} rotation={[0.5, 0, 0]}>
          <boxGeometry args={[0.038, 0.10, 0.038]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.75} metalness={0.15} />
        </mesh>
        {/* Right hinge detail */}
        <mesh position={[(lensOffset + lensRadius - 0.01), 0, lensDepth - 0.02]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color="#222" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    );
  }

  // Headset
  if (type === 'headset') {
    return (
      <group position={[0, 0.65, 0]}>
        {/* Band */}
        <mesh position={[0, 0.1, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.43, 0.04, 16, 32, Math.PI]} />
          <meshStandardMaterial color="#111" roughness={0.8} />
        </mesh>
        {/* Left Earcup */}
        <mesh position={[-0.43, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.08, 32]} />
          <meshStandardMaterial color={mainColor || '#111'} />
        </mesh>
        <mesh position={[-0.39, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.12, 0.04, 16, 32]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        {/* Right Earcup */}
        <mesh position={[0.43, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.08, 32]} />
          <meshStandardMaterial color={mainColor || '#111'} />
        </mesh>
        <mesh position={[0.39, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.12, 0.04, 16, 32]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        {/* Mic boom */}
        <mesh position={[-0.45, -0.05, 0.15]} rotation={[Math.PI / 4, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.25, 8]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        {/* Mic tip */}
        <mesh position={[-0.45, -0.15, 0.25]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color={accentColor || '#3b82f6'} />
        </mesh>
      </group>
    );
  }

  // Tie (renders flat against the chest)
  if (type === 'tie') {
    return (
      <group position={[0, 0.45, 0.38]} rotation={[0.05, 0, 0]}>
        {/* Collar Band (wraps around the neck) */}
        <mesh position={[0, 0.16, -0.08]} rotation={[Math.PI / 2 + 0.1, 0, 0]}>
          <torusGeometry args={[0.38, 0.025, 8, 32, Math.PI * 1.3]} />
          <meshStandardMaterial color="#ffffff" roughness={0.85} />
        </mesh>

        {/* Left Collar Flap / Lapel */}
        <mesh position={[-0.08, 0.13, 0.015]} rotation={[0.15, 0.12, -0.45]}>
          <boxGeometry args={[0.16, 0.07, 0.02]} />
          <meshStandardMaterial color="#ffffff" roughness={0.85} />
        </mesh>

        {/* Right Collar Flap / Lapel */}
        <mesh position={[0.08, 0.13, 0.015]} rotation={[0.15, -0.12, 0.45]}>
          <boxGeometry args={[0.16, 0.07, 0.02]} />
          <meshStandardMaterial color="#ffffff" roughness={0.85} />
        </mesh>

        {/* Windsor Knot (3D tapered pentagonal prism) */}
        <mesh position={[0, 0.08, 0.025]} rotation={[0.1, 0, 0]} castShadow>
          <cylinderGeometry args={[0.045, 0.032, 0.065, 5]} />
          <meshStandardMaterial color={accentColor || '#ef4444'} roughness={0.65} />
        </mesh>

        {/* Extruded Tie Body */}
        <group position={[0, 0, 0.01]}>
          <mesh castShadow receiveShadow>
            <extrudeGeometry args={[TIE_SHAPE, TIE_EXTRUDE_SETTINGS]} />
            <meshStandardMaterial color={accentColor || '#ef4444'} roughness={0.65} />
          </mesh>
        </group>

        {/* Shiny Gold Tie Clip */}
        <mesh position={[0.018, -0.08, 0.03]} rotation={[0.1, 0, -0.05]} castShadow>
          <boxGeometry args={[0.05, 0.012, 0.015]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.1} />
        </mesh>
      </group>
    );
  }

  return null;
}
