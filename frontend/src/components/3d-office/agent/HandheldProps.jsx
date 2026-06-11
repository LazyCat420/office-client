/**
 * HandheldProps.jsx — Reusable handheld prop meshes for agents.
 *
 * /lego module: Each prop is a small, self-contained React Three component.
 * Attach to an arm group's position to place in the agent's hand.
 * The `type` prop selects which item to render.
 */
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

/**
 * CigaretteSmoke — Dynamic particle system that responds to agent workload.
 * `intensity` (0–1) controls particle count, speed, opacity, and scale.
 * Low intensity (idle/break room): wispy, slow, 6 particles.
 * High intensity (stressed working): thick, fast, up to 16 particles.
 */
function CigaretteSmoke({ intensity = 0.3 }) {
  const maxParticles = 24;
  const refs = useRef([]);

  // Generate seeds for all possible particles (stable across renders)
  const seeds = useMemo(() =>
    Array.from({ length: maxParticles }, () => ({
      driftX: (Math.random() - 0.5) * 0.6,
      driftZ: (Math.random() - 0.5) * 0.6,
      speed: 0.3 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
    })),
  []);

  // How many particles to show based on intensity
  const activeCount = Math.round(6 + intensity * 18); // 6–24

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const speedMul = 0.7 + intensity * 0.8;   // 0.7–1.5x speed
    const opacityMul = 0.3 + intensity * 0.7;  // 0.3–1.0 peak opacity
    const scaleMul = 1.0 + intensity * 2.5;    // 1.0–3.5x size

    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      if (i >= activeCount) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      const s = seeds[i];
      const age = ((t * s.speed * speedMul + i * 0.4 + s.phase) % 2.5) / 2.5;
      mesh.position.y = age * (0.5 + intensity * 1.5);
      mesh.position.x = Math.sin(t * 1.5 + s.phase) * s.driftX * age * (1 + intensity * 2.0);
      mesh.position.z = Math.cos(t * 1.2 + s.phase) * s.driftZ * age * (1 + intensity * 2.0);
      const scale = (0.015 + age * 0.04) * scaleMul;
      mesh.scale.set(scale, scale, scale);
      mesh.material.opacity = (1 - age) * opacityMul;
    });
  });

  return (
    <group position={[0, 0.12, 0]}>
      {seeds.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          visible={i < activeCount}
        >
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial color="#9ca3af" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── Document — flat cream paper held in hand ──
function Document() {
  return (
    <group position={[0, -0.36, 0.08]} rotation={[0.6, 0, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.15, 0.2, 0.008]} />
        <meshStandardMaterial color="#fef3c7" roughness={0.7} />
      </mesh>
      {/* Text lines */}
      <mesh position={[0, 0.03, 0.005]}>
        <boxGeometry args={[0.1, 0.008, 0.002]} />
        <meshBasicMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[0, 0.0, 0.005]}>
        <boxGeometry args={[0.1, 0.008, 0.002]} />
        <meshBasicMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[0, -0.03, 0.005]}>
        <boxGeometry args={[0.08, 0.008, 0.002]} />
        <meshBasicMaterial color="#94a3b8" />
      </mesh>
    </group>
  );
}

// ── Magnifying Glass — circle lens + handle ──
function MagnifyingGlass() {
  return (
    <group position={[0, -0.36, 0.08]} rotation={[0.3, 0, 0.3]}>
      {/* Handle */}
      <mesh castShadow position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.015, 0.02, 0.12, 8]} />
        <meshStandardMaterial color="#78350f" roughness={0.7} />
      </mesh>
      {/* Lens rim */}
      <mesh castShadow position={[0, 0.04, 0]}>
        <torusGeometry args={[0.06, 0.008, 8, 16]} />
        <meshStandardMaterial color="#d4d4d8" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Lens glass */}
      <mesh position={[0, 0.04, 0]}>
        <circleGeometry args={[0.055, 16]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.3} roughness={0.1} />
      </mesh>
    </group>
  );
}

// ── Hammer — cylinder head + handle ──
function Hammer() {
  return (
    <group position={[0, -0.36, 0.06]} rotation={[0.5, 0, 0]}>
      {/* Handle */}
      <mesh castShadow>
        <cylinderGeometry args={[0.012, 0.015, 0.16, 8]} />
        <meshStandardMaterial color="#78350f" roughness={0.8} />
      </mesh>
      {/* Head */}
      <mesh castShadow position={[0, 0.08, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 0.08, 8]} />
        <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ── Phone — small dark rectangle held to ear ──
function Phone() {
  return (
    <group position={[0, -0.34, 0.08]} rotation={[0.2, 0, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.05, 0.1, 0.015]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.5} />
      </mesh>
      {/* Screen glow */}
      <mesh position={[0, 0.01, 0.008]}>
        <boxGeometry args={[0.04, 0.06, 0.002]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>
    </group>
  );
}

// ── Envelope — cream envelope with red wax seal ──
function Envelope() {
  return (
    <group position={[0, -0.36, 0.08]} rotation={[0.3, 0, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.18, 0.12, 0.02]} />
        <meshStandardMaterial color="#fef3c7" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.04, 0.005]}>
        <boxGeometry args={[0.14, 0.06, 0.01]} />
        <meshStandardMaterial color="#fde68a" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.0, 0.015]}>
        <circleGeometry args={[0.025, 8]} />
        <meshStandardMaterial color="#dc2626" roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  );
}

// ── Cigarette — 80s trading floor style, held between fingers ──
function Cigarette({ intensity = 0.3 }) {
  return (
    <group position={[0, -0.35, 0.08]} rotation={[0.5, 0, 0]}>
      {/* Cigarette body — cream paper */}
      <mesh castShadow>
        <cylinderGeometry args={[0.015, 0.018, 0.2, 8]} />
        <meshStandardMaterial color="#f5f0e0" roughness={0.8} />
      </mesh>
      {/* Filter — brown end */}
      <mesh position={[0, -0.085, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.04, 8]} />
        <meshStandardMaterial color="#c68c53" roughness={0.9} />
      </mesh>
      {/* Ember tip — glowing orange, brighter when more intense */}
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshBasicMaterial color={intensity > 0.5 ? '#ff2200' : '#ff4500'} />
      </mesh>
      {/* Smoke particles rising from tip — intensity-driven */}
      <CigaretteSmoke intensity={intensity} />
    </group>
  );
}

// ── Broom — wooden handle + brush head ──
function Broom() {
  return (
    <group position={[0, -0.6, 0.08]} rotation={[0.5, 0, 0]}>
      {/* Handle */}
      <mesh castShadow position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.8, 8]} />
        <meshStandardMaterial color="#d97706" roughness={0.8} />
      </mesh>
      {/* Broom Head Base */}
      <mesh castShadow position={[0, -0.05, 0]}>
        <boxGeometry args={[0.2, 0.05, 0.05]} />
        <meshStandardMaterial color="#b45309" roughness={0.9} />
      </mesh>
      {/* Broom Bristles */}
      <mesh castShadow position={[0, -0.15, 0]}>
        <boxGeometry args={[0.22, 0.15, 0.06]} />
        <meshStandardMaterial color="#fcd34d" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ── Mop — wooden handle + string head ──
function Mop() {
  return (
    <group position={[0, -0.6, 0.08]} rotation={[0.5, 0, 0]}>
      {/* Handle */}
      <mesh castShadow position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.8, 8]} />
        <meshStandardMaterial color="#d97706" roughness={0.8} />
      </mesh>
      {/* Mop Head */}
      <mesh castShadow position={[0, -0.05, 0]}>
        <coneGeometry args={[0.1, 0.2, 8]} />
        <meshStandardMaterial color="#d4d4d8" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ── Sponge — yellow rectangle block ──
function Sponge() {
  return (
    <group position={[0, -0.36, 0.08]} rotation={[0, 0, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.08, 0.1, 0.04]} />
        <meshStandardMaterial color="#fef08a" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ── Sword — low-poly sword ──
// Blade is built along local +Y. No extra rotation so it stays aligned
// with the arm bone regardless of which debate animation variant plays.
function Sword() {
  return (
    <group position={[0, -0.36, 0]} rotation={[0, 0, 0]}>
      {/* Handle / Grip */}
      <mesh castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.15, 8]} />
        <meshStandardMaterial color="#451a03" roughness={0.8} />
      </mesh>
      {/* Pommel */}
      <mesh castShadow position={[0, -0.08, 0]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Crossguard */}
      <mesh castShadow position={[0, 0.08, 0]}>
        <boxGeometry args={[0.12, 0.02, 0.02]} />
        <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Blade */}
      <mesh castShadow position={[0, 0.315, 0]}>
        <boxGeometry args={[0.025, 0.45, 0.008]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

// ── Master component: pick prop by type string ──
const PROP_MAP = {
  document: Document,
  magnifyingGlass: MagnifyingGlass,
  hammer: Hammer,
  phone: Phone,
  envelope: Envelope,
  cigarette: Cigarette,
  broom: Broom,
  mop: Mop,
  sponge: Sponge,
  sword: Sword,
};

export function HandheldProp({ type, smokeIntensity }) {
  const PropComponent = PROP_MAP[type];
  if (!PropComponent) return null;
  // Forward intensity to Cigarette component
  if (type === 'cigarette') return <PropComponent intensity={smokeIntensity} />;
  return <PropComponent />;
}
