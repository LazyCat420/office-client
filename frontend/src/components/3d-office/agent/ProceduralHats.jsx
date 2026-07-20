import React from 'react';
import * as THREE from 'three';

/**
 * Accessory geometry, expressed relative to the head rather than in magic
 * numbers. Every offset below derives from the torso capsule in
 * AgentVisualRig (`capsuleGeometry args={[0.4, 0.6]}` at y=0.5), so changing
 * the body proportions moves the hats with it instead of leaving them floating.
 */
const BODY_RADIUS = 0.4;
const BODY_CENTER_Y = 0.5;
const BODY_HALF_LENGTH = 0.3;

/** Centre of the capsule's domed top — effectively the centre of the skull. */
export const HEAD_CENTER_Y = BODY_CENTER_Y + BODY_HALF_LENGTH; // 0.8
/** Crown of the head. */
export const HEAD_TOP_Y = HEAD_CENTER_Y + BODY_RADIUS; // 1.2
/** Eye line: the face sits on the straight cylinder section, below the dome. */
export const FACE_Y = 0.7;
/** Body surface depth at the eye line. */
export const FACE_Z = BODY_RADIUS; // 0.4
export const EYE_X = 0.15;
/** Ear line — where earcups and glasses temples grip the head. */
const EAR_Y = 0.75;
const EAR_X = BODY_RADIUS + 0.04;
/** Height at which a brim rests on the curve of the skull. */
const BRIM_Y = 1.02;
/** Head radius at a given height (cylinder below the dome, sphere above). */
const headRadiusAt = (y) =>
  y <= HEAD_CENTER_Y
    ? BODY_RADIUS
    : Math.sqrt(Math.max(0, BODY_RADIUS ** 2 - (y - HEAD_CENTER_Y) ** 2));
const BRIM_HEAD_RADIUS = headRadiusAt(BRIM_Y); // ≈0.334
// Collar height is what sets this: any higher and the collar band cuts
// through the bottom of the face visor (which spans y 0.55–0.85).
const CHEST_Y = 0.37;

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

// ── Glasses dimensions ──
const LENS_RADIUS = 0.15;     // Oversized round lenses
const RIM_THICKNESS = 0.03;   // Thick chunky black rims
const LENS_OFFSET = 0.16;     // Horizontal offset — tracks EYE_X so lenses sit over the pupils
const LENS_DEPTH = 0.05;      // Forward of the group origin; clears the eye decals at FACE_Z + 0.05
const FRAME_OUTER_X = LENS_OFFSET + LENS_RADIUS + RIM_THICKNESS;
const TEMPLE_X = BODY_RADIUS + 0.01; // Just proud of the head so the arms stay visible

/**
 * One lens assembly. The whole frame lies in the XY plane facing +Z, matching
 * the flat eye decals it covers — the meshes below are deliberately unrotated
 * except the convex cap, which is a hemisphere aimed down its own +Y.
 */
function Lens({ side }) {
  return (
    <group position={[side * LENS_OFFSET, 0, LENS_DEPTH]}>
      {/* Thick black rim */}
      <mesh castShadow>
        <torusGeometry args={[LENS_RADIUS, RIM_THICKNESS, 16, 32]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.75} metalness={0.2} />
      </mesh>
      {/* Inner rim edge (gives depth to the frame) */}
      <mesh>
        <torusGeometry args={[LENS_RADIUS - RIM_THICKNESS * 0.5, RIM_THICKNESS * 0.4, 12, 32]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>
      {/* Convex glass — flattened hemisphere bulging forward for the bottle-bottom look */}
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.45, 1]}>
        <sphereGeometry args={[LENS_RADIUS - 0.005, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
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
      <mesh position={[0, 0, -0.008]}>
        <circleGeometry args={[LENS_RADIUS - 0.005, 32]} />
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
      <mesh position={[0, 0, 0.03]}>
        <ringGeometry args={[LENS_RADIUS * 0.3, LENS_RADIUS * 0.6, 32]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.15}
          emissive="#aaccff"
          emissiveIntensity={0.4}
        />
      </mesh>
    </group>
  );
}

/** Hinge block + temple arm + ear hook for one side. */
function Temple({ side }) {
  const hingeSpan = TEMPLE_X - FRAME_OUTER_X + 0.02;
  return (
    <group>
      {/* Hinge connector bridging the rim to the temple arm */}
      <mesh position={[side * (FRAME_OUTER_X + hingeSpan / 2 - 0.01), 0, LENS_DEPTH]}>
        <boxGeometry args={[hingeSpan, 0.04, 0.035]} />
        <meshStandardMaterial color="#222" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Temple arm running back along the side of the head */}
      <mesh position={[side * TEMPLE_X, 0, LENS_DEPTH - 0.16]}>
        <boxGeometry args={[0.035, 0.045, 0.32]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.75} metalness={0.15} />
      </mesh>
      {/* Ear hook curling down behind the ear */}
      <mesh position={[side * TEMPLE_X, -0.06, LENS_DEPTH - 0.30]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.035, 0.1, 0.035]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.75} metalness={0.15} />
      </mesh>
    </group>
  );
}

/**
 * ProceduralHats built as exact parametric solids
 * adhering to the /threejs workflow guidelines.
 */
export function ProceduralHat({ type, mainColor, accentColor }) {
  if (!type || type === 'none') return null;

  // Top Hat — brim rests on the curve of the skull, crown rises above it
  if (type === 'top_hat') {
    return (
      <group position={[0, BRIM_Y, 0]}>
        {/* Brim */}
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.05, 32]} />
          <meshStandardMaterial color={mainColor || '#111'} roughness={0.9} />
        </mesh>
        {/* Crown */}
        <mesh position={[0, 0.32, 0]} castShadow>
          <cylinderGeometry args={[BRIM_HEAD_RADIUS + 0.02, BRIM_HEAD_RADIUS + 0.02, 0.6, 32]} />
          <meshStandardMaterial color={mainColor || '#111'} roughness={0.9} />
        </mesh>
        {/* Hat Band */}
        <mesh position={[0, 0.07, 0]} castShadow>
          <cylinderGeometry args={[BRIM_HEAD_RADIUS + 0.03, BRIM_HEAD_RADIUS + 0.03, 0.1, 32]} />
          <meshStandardMaterial color={accentColor || '#ef4444'} roughness={0.5} />
        </mesh>
      </group>
    );
  }

  // Baseball Cap — dome shells the head's own dome
  if (type === 'cap') {
    return (
      <group position={[0, HEAD_CENTER_Y, 0]}>
        {/* Dome (half sphere) */}
        <mesh position={[0, 0, 0]} castShadow>
          <sphereGeometry args={[BODY_RADIUS + 0.02, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={mainColor || '#3b82f6'} roughness={0.7} />
        </mesh>
        {/* Visor */}
        <mesh position={[0, 0.02, 0.26]} rotation={[-0.1, 0, 0]} scale={[1, 0.15, 1]} castShadow>
          <sphereGeometry args={[0.4]} />
          <meshStandardMaterial color={mainColor || '#3b82f6'} roughness={0.7} />
        </mesh>
        {/* Top Button */}
        <mesh position={[0, BODY_RADIUS + 0.02, 0]} castShadow>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshStandardMaterial color={accentColor || '#1e293b'} roughness={0.7} />
        </mesh>
      </group>
    );
  }

  // Crown — band rides the skull, spikes clear the top of the head
  if (type === 'crown') {
    const bandRadius = BRIM_HEAD_RADIUS + 0.02;
    return (
      <group position={[0, BRIM_Y, 0]}>
        {/* Crown Base */}
        <mesh position={[0, 0.08, 0]} castShadow>
          <cylinderGeometry args={[bandRadius, bandRadius - 0.03, 0.2, 16, 1, true]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} side={2} />
        </mesh>
        {/* Spikes */}
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const x = Math.cos(angle) * bandRadius;
          const z = Math.sin(angle) * bandRadius;
          return (
            <mesh key={i} position={[x, 0.28, z]} rotation={[0.1, -angle, 0]} castShadow>
              <coneGeometry args={[0.08, 0.25, 4]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
            </mesh>
          );
        })}
        {/* Jewels */}
        {Array.from({ length: 4 }).map((_, i) => {
          const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const x = Math.cos(angle) * (bandRadius + 0.01);
          const z = Math.sin(angle) * (bandRadius + 0.01);
          return (
            <mesh key={i} position={[x, 0.08, z]} rotation={[0, -angle, 0]} castShadow>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshStandardMaterial color={accentColor || '#ef4444'} roughness={0.1} metalness={0.5} />
            </mesh>
          );
        })}
      </group>
    );
  }

  // Beanie — knitted shell pulled down over the dome
  if (type === 'beanie') {
    return (
      <group position={[0, HEAD_CENTER_Y, 0]}>
        {/* Main Body */}
        <mesh position={[0, 0.02, 0]} scale={[1, 1.15, 1]} castShadow>
          <sphereGeometry args={[BODY_RADIUS + 0.02, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={mainColor || '#f59e0b'} roughness={0.9} />
        </mesh>
        {/* Folded edge */}
        <mesh position={[0, 0.02, 0]} castShadow>
          <torusGeometry args={[BODY_RADIUS + 0.01, 0.07, 16, 32]} />
          <meshStandardMaterial color={mainColor || '#f59e0b'} roughness={0.9} />
        </mesh>
        {/* Pom pom */}
        <mesh position={[0, BODY_RADIUS + 0.16, 0]} castShadow>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color={accentColor || '#fff'} roughness={0.9} />
        </mesh>
      </group>
    );
  }

  // Glasses — goofy bottlecap frames sitting flat on the eye line.
  // The group carries only a slight pantoscopic tilt; the lenses themselves
  // face straight forward so they line up with the flat eye decals behind them.
  if (type === 'glasses') {
    return (
      <group position={[0, FACE_Y, FACE_Z + 0.02]} rotation={[-0.08, 0, 0]}>
        <Lens side={-1} />
        <Lens side={1} />

        {/* Bridge — thick chunky nose piece */}
        <mesh position={[0, -0.02, LENS_DEPTH]}>
          <boxGeometry args={[LENS_OFFSET * 2 - LENS_RADIUS * 2 + 0.07, 0.05, 0.04]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.75} metalness={0.15} />
        </mesh>
        {/* Bridge arch (rounded top) */}
        <mesh position={[0, 0.01, LENS_DEPTH]}>
          <torusGeometry args={[0.04, 0.022, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.85} />
        </mesh>

        <Temple side={-1} />
        <Temple side={1} />
      </group>
    );
  }

  // Headset — band arcs clear of the crown, earcups grip the ear line
  if (type === 'headset') {
    const bandRadius = 0.45;
    const bandCenterY = HEAD_CENTER_Y - 0.02;
    return (
      <group position={[0, 0, 0]}>
        {/* Band */}
        <mesh position={[0, bandCenterY, 0]}>
          <torusGeometry args={[bandRadius, 0.04, 16, 32, Math.PI]} />
          <meshStandardMaterial color="#111" roughness={0.8} />
        </mesh>
        {/* Left Earcup */}
        <mesh position={[-EAR_X, EAR_Y, 0]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.08, 32]} />
          <meshStandardMaterial color={mainColor || '#111'} />
        </mesh>
        <mesh position={[-(EAR_X - 0.04), EAR_Y, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.12, 0.04, 16, 32]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        {/* Right Earcup */}
        <mesh position={[EAR_X, EAR_Y, 0]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.08, 32]} />
          <meshStandardMaterial color={mainColor || '#111'} />
        </mesh>
        <mesh position={[EAR_X - 0.04, EAR_Y, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.12, 0.04, 16, 32]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        {/* Mic boom */}
        <mesh position={[-(EAR_X + 0.02), EAR_Y - 0.1, 0.15]} rotation={[Math.PI / 4, 0, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.25, 8]} />
          <meshStandardMaterial color="#111" />
        </mesh>
        {/* Mic tip */}
        <mesh position={[-(EAR_X + 0.02), EAR_Y - 0.2, 0.25]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color={accentColor || '#3b82f6'} />
        </mesh>
      </group>
    );
  }

  // Tie — collar rings the neck, the rest hangs down the chest
  if (type === 'tie') {
    const chestZ = BODY_RADIUS - 0.02;
    return (
      <group>
        {/* Collar band. Centred on the body AXIS (not pushed forward with the
            rest of the tie) so it wraps the neck instead of floating in front.
            The X rotation sweeps the arc from +X through +Z to -X, so a half
            torus covers the front of the chest and leaves the back bare. */}
        <mesh position={[0, CHEST_Y + 0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[BODY_RADIUS + 0.005, 0.028, 8, 32, Math.PI]} />
          <meshStandardMaterial color="#ffffff" roughness={0.85} />
        </mesh>

        <group position={[0, CHEST_Y + 0.1, chestZ]} rotation={[0.05, 0, 0]}>
          {/* Left Collar Flap / Lapel */}
          <mesh position={[-0.08, 0.02, 0.015]} rotation={[0.15, 0.12, -0.45]}>
            <boxGeometry args={[0.16, 0.07, 0.02]} />
            <meshStandardMaterial color="#ffffff" roughness={0.85} />
          </mesh>

          {/* Right Collar Flap / Lapel */}
          <mesh position={[0.08, 0.02, 0.015]} rotation={[0.15, -0.12, 0.45]}>
            <boxGeometry args={[0.16, 0.07, 0.02]} />
            <meshStandardMaterial color="#ffffff" roughness={0.85} />
          </mesh>

          {/* Windsor Knot (3D tapered pentagonal prism) */}
          <mesh position={[0, -0.03, 0.025]} rotation={[0.1, 0, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.032, 0.065, 5]} />
            <meshStandardMaterial color={accentColor || '#ef4444'} roughness={0.65} />
          </mesh>

          {/* Extruded Tie Body — TIE_SHAPE spans y +0.08 … -0.34, so this
              offset tucks its top edge inside the knot above it. */}
          <group position={[0, -0.09, 0.01]}>
            <mesh castShadow receiveShadow>
              <extrudeGeometry args={[TIE_SHAPE, TIE_EXTRUDE_SETTINGS]} />
              <meshStandardMaterial color={accentColor || '#ef4444'} roughness={0.65} />
            </mesh>
          </group>

          {/* Shiny Gold Tie Clip */}
          <mesh position={[0.018, -0.19, 0.03]} rotation={[0.1, 0, -0.05]} castShadow>
            <boxGeometry args={[0.05, 0.012, 0.015]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.1} />
          </mesh>
        </group>
      </group>
    );
  }

  return null;
}
