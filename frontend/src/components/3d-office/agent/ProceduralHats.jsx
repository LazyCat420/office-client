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
const CHEST_Y = 0.37;

// Define static tie shape and extrude settings at module level
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
const LENS_RADIUS = 0.14;
const RIM_THICKNESS = 0.025;
const LENS_OFFSET = 0.15;
const LENS_DEPTH = 0.02;
const FRAME_OUTER_X = LENS_OFFSET + LENS_RADIUS + RIM_THICKNESS;
const TEMPLE_X = BODY_RADIUS + 0.01;

function Lens({ side, style = 'classic' }) {
  const isSunglasses = style === 'sunglasses';
  const isSquare = style === 'square';
  const rimColor = isSunglasses ? '#d4af37' : '#0a0a0a';
  const lensColor = isSunglasses ? '#111827' : '#e8f4ff';
  const lensOpacity = isSunglasses ? 0.88 : 0.4;
  const lensTransmission = isSunglasses ? 0.1 : 0.85;

  return (
    <group position={[side * LENS_OFFSET, 0, LENS_DEPTH]}>
      {/* Outer Rim */}
      <mesh castShadow>
        {isSquare ? (
          <boxGeometry args={[LENS_RADIUS * 2 + 0.02, LENS_RADIUS * 1.6, RIM_THICKNESS]} />
        ) : (
          <torusGeometry args={[LENS_RADIUS, RIM_THICKNESS, 16, 32]} />
        )}
        <meshStandardMaterial color={rimColor} roughness={0.4} metalness={isSunglasses ? 0.9 : 0.2} />
      </mesh>
      {/* Inner Lens Glass */}
      <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.45, 1]}>
        {isSquare ? (
          <boxGeometry args={[LENS_RADIUS * 1.8, LENS_RADIUS * 1.4, 0.02]} />
        ) : (
          <sphereGeometry args={[LENS_RADIUS - 0.005, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        )}
        <meshPhysicalMaterial
          color={lensColor}
          transparent
          opacity={lensOpacity}
          transmission={lensTransmission}
          thickness={3.0}
          roughness={0.02}
          ior={1.5}
          metalness={isSunglasses ? 0.2 : 0.0}
          clearcoat={1.0}
          clearcoatRoughness={0.0}
          side={2}
        />
      </mesh>
      {/* Specular Glint */}
      <mesh position={[0, 0, 0.02]}>
        <ringGeometry args={[LENS_RADIUS * 0.3, LENS_RADIUS * 0.55, 32]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.2}
          emissive="#ffffff"
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
}

function Temple({ side, color = '#0a0a0a' }) {
  const hingeSpan = TEMPLE_X - FRAME_OUTER_X + 0.02;
  return (
    <group>
      <mesh position={[side * (FRAME_OUTER_X + hingeSpan / 2 - 0.01), 0, LENS_DEPTH]}>
        <boxGeometry args={[hingeSpan, 0.035, 0.03]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[side * TEMPLE_X, 0, LENS_DEPTH - 0.16]}>
        <boxGeometry args={[0.03, 0.035, 0.32]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[side * TEMPLE_X, -0.05, LENS_DEPTH - 0.30]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[0.03, 0.09, 0.03]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.2} />
      </mesh>
    </group>
  );
}

export function ProceduralHat({ type, mainColor, accentColor }) {
  if (!type || type === 'none') return null;

  // Top Hat
  if (type === 'top_hat') {
    return (
      <group position={[0, BRIM_Y, 0]}>
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.05, 32]} />
          <meshStandardMaterial color={mainColor || '#111827'} roughness={0.4} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.32, 0]} castShadow>
          <cylinderGeometry args={[BRIM_HEAD_RADIUS + 0.02, BRIM_HEAD_RADIUS + 0.02, 0.6, 32]} />
          <meshStandardMaterial color={mainColor || '#111827'} roughness={0.4} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.07, 0]} castShadow>
          <cylinderGeometry args={[BRIM_HEAD_RADIUS + 0.03, BRIM_HEAD_RADIUS + 0.03, 0.1, 32]} />
          <meshStandardMaterial color={accentColor || '#ef4444'} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.07, BRIM_HEAD_RADIUS + 0.035]} castShadow>
          <boxGeometry args={[0.08, 0.08, 0.02]} />
          <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
    );
  }

  // Baseball Cap
  if (type === 'cap') {
    return (
      <group position={[0, HEAD_CENTER_Y, 0]}>
        <mesh position={[0, 0, 0]} castShadow>
          <sphereGeometry args={[BODY_RADIUS + 0.02, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={mainColor || '#3b82f6'} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.02, 0.28]} rotation={[-0.15, 0, 0]} scale={[1, 0.12, 1.2]} castShadow>
          <sphereGeometry args={[0.38]} />
          <meshStandardMaterial color={mainColor || '#3b82f6'} roughness={0.7} />
        </mesh>
        <mesh position={[0, BODY_RADIUS + 0.02, 0]} castShadow>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshStandardMaterial color={accentColor || '#1e293b'} roughness={0.7} />
        </mesh>
      </group>
    );
  }

  // Crown
  if (type === 'crown') {
    const bandRadius = BRIM_HEAD_RADIUS + 0.02;
    return (
      <group position={[0, BRIM_Y, 0]}>
        <mesh position={[0, 0.08, 0]} castShadow>
          <cylinderGeometry args={[bandRadius, bandRadius - 0.02, 0.18, 16, 1, true]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.15} side={2} />
        </mesh>
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const x = Math.cos(angle) * bandRadius;
          const z = Math.sin(angle) * bandRadius;
          return (
            <mesh key={i} position={[x, 0.26, z]} rotation={[0.1, -angle, 0]} castShadow>
              <coneGeometry args={[0.07, 0.22, 4]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.15} />
            </mesh>
          );
        })}
        {Array.from({ length: 4 }).map((_, i) => {
          const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const x = Math.cos(angle) * (bandRadius + 0.015);
          const z = Math.sin(angle) * (bandRadius + 0.015);
          return (
            <mesh key={i} position={[x, 0.08, z]} rotation={[0, -angle, 0]} castShadow>
              <sphereGeometry args={[0.045, 12, 12]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#ef4444' : '#10b981'} roughness={0.1} metalness={0.8} />
            </mesh>
          );
        })}
      </group>
    );
  }

  // Beanie
  if (type === 'beanie') {
    return (
      <group position={[0, HEAD_CENTER_Y, 0]}>
        <mesh position={[0, 0.02, 0]} scale={[1, 1.15, 1]} castShadow>
          <sphereGeometry args={[BODY_RADIUS + 0.02, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={mainColor || '#f59e0b'} roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.02, 0]} castShadow>
          <torusGeometry args={[BODY_RADIUS + 0.015, 0.07, 16, 32]} />
          <meshStandardMaterial color={mainColor || '#f59e0b'} roughness={0.95} />
        </mesh>
        <mesh position={[0, BODY_RADIUS + 0.16, 0]} castShadow>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color={accentColor || '#ffffff'} roughness={0.9} />
        </mesh>
      </group>
    );
  }

  // Cowboy Hat
  if (type === 'cowboy_hat') {
    return (
      <group position={[0, BRIM_Y + 0.02, 0]}>
        <mesh position={[0, 0, 0]} scale={[1.25, 0.2, 1.3]} rotation={[0.05, 0, 0]} castShadow>
          <sphereGeometry args={[0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={mainColor || '#78350f'} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.18, 0]} scale={[0.85, 1, 0.9]} castShadow>
          <cylinderGeometry args={[0.3, 0.35, 0.35, 32]} />
          <meshStandardMaterial color={mainColor || '#78350f'} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.06, 0]} castShadow>
          <torusGeometry args={[0.35, 0.03, 16, 32]} />
          <meshStandardMaterial color={accentColor || '#451a03'} roughness={0.9} />
        </mesh>
      </group>
    );
  }

  // Fedora
  if (type === 'fedora') {
    return (
      <group position={[0, BRIM_Y, 0]} rotation={[0.05, 0, 0]}>
        <mesh position={[0, 0, 0]} scale={[1.2, 0.15, 1.25]} castShadow>
          <cylinderGeometry args={[0.48, 0.48, 0.04, 32]} />
          <meshStandardMaterial color={mainColor || '#1e293b'} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.18, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.34, 0.35, 32]} />
          <meshStandardMaterial color={mainColor || '#1e293b'} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.06, 0]} castShadow>
          <cylinderGeometry args={[0.345, 0.345, 0.08, 32]} />
          <meshStandardMaterial color={accentColor || '#ef4444'} roughness={0.5} />
        </mesh>
      </group>
    );
  }

  // Hard Hat
  if (type === 'hard_hat') {
    return (
      <group position={[0, HEAD_CENTER_Y, 0]}>
        <mesh position={[0, 0.02, 0]} scale={[1, 0.9, 1]} castShadow>
          <sphereGeometry args={[BODY_RADIUS + 0.03, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#facc15" roughness={0.3} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.02, 0.22]} rotation={[-0.1, 0, 0]} scale={[1.1, 0.1, 0.8]} castShadow>
          <cylinderGeometry args={[0.38, 0.38, 0.04, 32]} />
          <meshStandardMaterial color="#facc15" roughness={0.3} metalness={0.2} />
        </mesh>
        <mesh position={[0, BODY_RADIUS + 0.01, 0]} scale={[0.12, 0.06, 0.7]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#eab308" roughness={0.3} />
        </mesh>
      </group>
    );
  }

  // Wizard Hat
  if (type === 'wizard_hat') {
    return (
      <group position={[0, BRIM_Y, 0]}>
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.04, 32]} />
          <meshStandardMaterial color="#4c1d95" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.45, 0]} rotation={[0.05, 0, -0.05]} castShadow>
          <coneGeometry args={[0.35, 0.9, 32]} />
          <meshStandardMaterial color="#5b21b6" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.08, 0]} castShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.1, 32]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>
    );
  }

  // Party Hat
  if (type === 'party_hat') {
    return (
      <group position={[0, HEAD_TOP_Y - 0.05, 0]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <coneGeometry args={[0.2, 0.5, 32]} />
          <meshStandardMaterial color={mainColor || '#ec4899'} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.52, 0]} castShadow>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color={accentColor || '#facc15'} roughness={0.9} />
        </mesh>
      </group>
    );
  }

  // Glasses / Sunglasses / Square Glasses
  if (type === 'glasses' || type === 'sunglasses' || type === 'square_glasses') {
    const style = type === 'sunglasses' ? 'sunglasses' : type === 'square_glasses' ? 'square' : 'classic';
    const frameColor = style === 'sunglasses' ? '#d4af37' : '#0a0a0a';
    return (
      <group position={[0, FACE_Y, FACE_Z + 0.02]} rotation={[-0.05, 0, 0]}>
        <Lens side={-1} style={style} />
        <Lens side={1} style={style} />

        <mesh position={[0, 0, LENS_DEPTH]}>
          <boxGeometry args={[LENS_OFFSET * 2 - LENS_RADIUS * 2 + 0.05, 0.04, 0.03]} />
          <meshStandardMaterial color={frameColor} roughness={0.5} metalness={style === 'sunglasses' ? 0.9 : 0.2} />
        </mesh>

        <Temple side={-1} color={frameColor} />
        <Temple side={1} color={frameColor} />
      </group>
    );
  }

  // Headset
  if (type === 'headset') {
    const bandRadius = 0.45;
    const bandCenterY = HEAD_CENTER_Y - 0.02;
    return (
      <group position={[0, 0, 0]}>
        <mesh position={[0, bandCenterY, 0]}>
          <torusGeometry args={[bandRadius, 0.04, 16, 32, Math.PI]} />
          <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.5} />
        </mesh>
        <mesh position={[-EAR_X, EAR_Y, 0]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.08, 32]} />
          <meshStandardMaterial color={mainColor || '#0f172a'} roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[-(EAR_X - 0.04), EAR_Y, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.12, 0.04, 16, 32]} />
          <meshStandardMaterial color="#334155" roughness={0.9} />
        </mesh>
        <mesh position={[EAR_X, EAR_Y, 0]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.08, 32]} />
          <meshStandardMaterial color={mainColor || '#0f172a'} roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[EAR_X - 0.04, EAR_Y, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.12, 0.04, 16, 32]} />
          <meshStandardMaterial color="#334155" roughness={0.9} />
        </mesh>
        <mesh position={[-(EAR_X + 0.02), EAR_Y - 0.1, 0.15]} rotation={[Math.PI / 4, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.25, 8]} />
          <meshStandardMaterial color="#0f172a" metalness={0.6} />
        </mesh>
        <mesh position={[-(EAR_X + 0.02), EAR_Y - 0.2, 0.25]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color={accentColor || '#38bdf8'} roughness={0.2} emissive="#0284c7" emissiveIntensity={0.5} />
        </mesh>
      </group>
    );
  }

  // Tie (Windsor Necktie)
  if (type === 'tie') {
    const chestZ = BODY_RADIUS - 0.01;
    return (
      <group>
        <mesh position={[0, CHEST_Y + 0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[BODY_RADIUS + 0.005, 0.028, 8, 32, Math.PI]} />
          <meshStandardMaterial color="#ffffff" roughness={0.85} />
        </mesh>

        <group position={[0, CHEST_Y + 0.1, chestZ]} rotation={[0.05, 0, 0]}>
          <mesh position={[-0.08, 0.02, 0.015]} rotation={[0.15, 0.12, -0.45]}>
            <boxGeometry args={[0.16, 0.07, 0.02]} />
            <meshStandardMaterial color="#ffffff" roughness={0.85} />
          </mesh>

          <mesh position={[0.08, 0.02, 0.015]} rotation={[0.15, -0.12, 0.45]}>
            <boxGeometry args={[0.16, 0.07, 0.02]} />
            <meshStandardMaterial color="#ffffff" roughness={0.85} />
          </mesh>

          <mesh position={[0, -0.03, 0.025]} rotation={[0.1, 0, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.032, 0.065, 5]} />
            <meshStandardMaterial color={accentColor || '#ef4444'} roughness={0.65} />
          </mesh>

          <group position={[0, -0.09, 0.01]}>
            <mesh castShadow receiveShadow>
              <extrudeGeometry args={[TIE_SHAPE, TIE_EXTRUDE_SETTINGS]} />
              <meshStandardMaterial color={accentColor || '#ef4444'} roughness={0.65} />
            </mesh>
          </group>

          <mesh position={[0.018, -0.19, 0.03]} rotation={[0.1, 0, -0.05]} castShadow>
            <boxGeometry args={[0.05, 0.012, 0.015]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.1} />
          </mesh>
        </group>
      </group>
    );
  }

  // Bowtie
  if (type === 'bowtie') {
    const chestZ = BODY_RADIUS - 0.01;
    return (
      <group position={[0, CHEST_Y + 0.12, chestZ + 0.02]}>
        <mesh position={[0, 0.02, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[BODY_RADIUS + 0.005, 0.02, 8, 32, Math.PI]} />
          <meshStandardMaterial color="#ffffff" roughness={0.85} />
        </mesh>
        <mesh position={[-0.07, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <coneGeometry args={[0.05, 0.12, 4]} />
          <meshStandardMaterial color={accentColor || '#ef4444'} roughness={0.6} />
        </mesh>
        <mesh position={[0.07, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <coneGeometry args={[0.05, 0.12, 4]} />
          <meshStandardMaterial color={accentColor || '#ef4444'} roughness={0.6} />
        </mesh>
        <mesh castShadow position={[0, 0, 0.01]}>
          <boxGeometry args={[0.035, 0.045, 0.03]} />
          <meshStandardMaterial color={accentColor || '#ef4444'} roughness={0.5} />
        </mesh>
      </group>
    );
  }

  return null;
}
