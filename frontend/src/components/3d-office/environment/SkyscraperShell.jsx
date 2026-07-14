import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { createSeededRandom } from '../seededRandom';

/**
 * SkyscraperShell — The physical building structure for the 100th floor.
 * 
 * Features:
 * - Glass curtain walls (transparent cylindrical ring)
 * - Structural steel columns every 30° (12 total)
 * - Polished floor slab with beveled edge
 * - Dark ceiling with recessed light strips
 * - Window mullion grid pattern on the glass
 */

const BLDG_R = 32;        // Must match Stations.jsx BLDG_R
const COL_COUNT = 12;      // Structural columns
const FLOOR_H = 0.15;      // Floor slab thickness
const CEILING_Y = 4.5;     // Ceiling height
const MULLION_COUNT_V = 6;  // Vertical mullion divisions
const MULLION_COUNT_H = 3;  // Horizontal mullion divisions

// Glass shard component for shattered window effect
function ShatteredGlass({ active }) {
  const shards = useMemo(() => {
    if (!active) return [];
    const random = createSeededRandom(0x9155);
    const arr = [];
    for (let i = 0; i < 40; i++) {
      // Randomize within the window pane dimensions (width ~4, height ~4)
      const xOffset = (random() - 0.5) * 4.0;
      const yOffset = (random() - 0.5) * 4.0;
      
      // Explosion impulse directed outwards (-Z and slightly up)
      const forceX = (random() - 0.5) * 5;
      const forceY = random() * 5;
      const forceZ = -10 - random() * 10;
      
      const rot = [random() * Math.PI, random() * Math.PI, random() * Math.PI];
      
      arr.push({
        id: i,
        pos: [xOffset, CEILING_Y / 2 + yOffset, -BLDG_R],
        rot,
        force: { x: forceX, y: forceY, z: forceZ },
        scale: 0.2 + random() * 0.4
      });
    }
    return arr;
  }, [active]);

  if (!active) return null;

  return (
    <>
      {shards.map(s => (
        <RigidBody key={s.id} position={s.pos} rotation={s.rot} linearVelocity={[s.force.x, s.force.y, s.force.z]}>
          <mesh>
            <polyhedronGeometry args={[[1,1,1, -1,-1,1, -1,1,-1, 1,-1,-1], [2,1,0, 0,3,2, 1,3,0, 2,3,1], s.scale, 0]} />
            <meshPhysicalMaterial color="#88bbdd" transparent opacity={0.6} roughness={0.02} metalness={0.1} clearcoat={1.0} />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}

function createFacadeTexture() {
  if (typeof document === 'undefined') return null;
  const width = 512;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Base building color (dark steel/navy blue)
  ctx.fillStyle = '#0f121e';
  ctx.fillRect(0, 0, width, height);

  const floors = 48;
  const cols = 64;
  const floorH = height / floors;
  const colW = width / cols;

  for (let f = 0; f < floors; f++) {
    // Some floors have busy offices, others are dark
    const floorLitChance = Math.random() < 0.25 ? 0.45 : 0.15;
    let officeLit = false;
    let officeRemaining = 0;
    let officeColor = '#ffeedd';

    for (let c = 0; c < cols; c++) {
      if (officeRemaining <= 0) {
        officeLit = Math.random() < floorLitChance;
        officeRemaining = Math.floor(Math.random() * 4) + 1; // 1 to 4 windows wide
        
        const r = Math.random();
        if (r < 0.4) {
          officeColor = '#ffc87a'; // warm amber/orange
        } else if (r < 0.7) {
          officeColor = '#8ee5ff'; // ice blue
        } else {
          officeColor = '#ffffff'; // white
        }
      }
      officeRemaining--;

      const x = c * colW + colW * 0.15;
      const y = f * floorH + floorH * 0.15;
      const w = colW * 0.7;
      const h = floorH * 0.7;

      if (officeLit) {
        ctx.fillStyle = officeColor;
        ctx.fillRect(x, y, w, h);
        
        // Window interior silhouette
        if (Math.random() < 0.45) {
          ctx.fillStyle = 'rgba(15, 18, 30, 0.65)';
          ctx.fillRect(x + w * 0.2, y + h * 0.4, w * 0.6, h * 0.6);
        }
      } else {
        ctx.fillStyle = '#06080e'; // dark window
        ctx.fillRect(x, y, w, h);
      }
    }
  }

  // Draw grid lines
  ctx.fillStyle = '#080a14';
  for (let f = 0; f <= floors; f++) {
    ctx.fillRect(0, f * floorH - 1, width, 2);
  }
  for (let c = 0; c <= cols; c++) {
    ctx.fillRect(c * colW - 1, 0, 2, height);
  }

  // Fade out gradient at the bottom (V = 0 at bottom, maps to y = height in canvas)
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(5, 5, 16, 0.0)');
  gradient.addColorStop(0.65, 'rgba(5, 5, 16, 0.0)');
  gradient.addColorStop(1.0, '#050510'); // blends into background / clouds
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function SkyscraperShell() {
  const [isBroken, setIsBroken] = useState(false);

  useEffect(() => {
    const onBreak = () => {
      setIsBroken(true);
      // Auto-repair window after 15 seconds
      setTimeout(() => setIsBroken(false), 15000);
    };
    window.addEventListener('break-window', onBreak);
    return () => window.removeEventListener('break-window', onBreak);
  }, []);
  // Column positions around the perimeter
  const columns = useMemo(() => {
    const cols = [];
    for (let i = 0; i < COL_COUNT; i++) {
      const angle = (i / COL_COUNT) * Math.PI * 2;
      cols.push({
        x: Math.sin(angle) * BLDG_R,
        z: Math.cos(angle) * BLDG_R,
        angle,
      });
    }
    return cols;
  }, []);

  // Mullion (window grid) positions
  const mullions = useMemo(() => {
    const result = [];
    const segments = 48;
    const segAngle = (Math.PI * 2) / segments;

    // Vertical mullions
    for (let i = 0; i < segments; i++) {
      if (i % (segments / MULLION_COUNT_V) === 0) continue; // Skip column positions
      const a = i * segAngle;
      result.push({
        type: 'vertical',
        x: Math.sin(a) * BLDG_R,
        z: Math.cos(a) * BLDG_R,
        angle: a,
      });
    }

    return result;
  }, []);

  // Procedural skyscraper facade texture
  const facadeTexture = useMemo(() => createFacadeTexture(), []);

  return (
    <group name="skyscraper-shell">
      {/* Invisible Physics Floor */}
      <RigidBody type="fixed">
        <CuboidCollider args={[BLDG_R, 0.5, BLDG_R]} position={[0, -0.5, 0]} />
      </RigidBody>
      {/* ══════════════════════════════════════════
          FLOOR SLAB — Thick polished slab with bevel
          ══════════════════════════════════════════ */}
      {/* Main thick floor slab */}
      <mesh position={[0, -1.0, 0]} receiveShadow>
        <cylinderGeometry args={[BLDG_R + 1.0, BLDG_R + 1.2, 2.0, 64]} />
        <meshStandardMaterial
          color="#2a3448"
          roughness={0.6}
          metalness={0.15}
        />
      </mesh>

      {/* Underside beveled structural support */}
      <mesh position={[0, -2.5, 0]} receiveShadow>
        <cylinderGeometry args={[BLDG_R + 1.2, BLDG_R - 1.0, 1.0, 64]} />
        <meshStandardMaterial
          color="#1a1e2e"
          roughness={0.6}
          metalness={0.2}
        />
      </mesh>

      {/* LED perimeter glow ring - flat on XZ plane */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[BLDG_R - 0.2, BLDG_R + 0.4, 64]} />
        <meshBasicMaterial
          color="#00f0ff"
          transparent
          opacity={0.35}
          toneMapped={false}
        />
      </mesh>

      {/* Floor accent ring (edge highlight) - flat on XZ plane */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[BLDG_R - 0.3, BLDG_R + 0.5, 64]} />
        <meshStandardMaterial
          color="#334155"
          roughness={0.4}
          metalness={0.15}
          emissive="#1a2030"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* FULL FLOOR — visible polished surface covering entire building */}
      <mesh position={[0, 0.003, 0]} receiveShadow>
        <cylinderGeometry args={[BLDG_R, BLDG_R, 0.02, 64]} />
        <meshStandardMaterial
          color="#1e2940"
          roughness={0.35}
          metalness={0.1}
          emissive="#0c1220"
          emissiveIntensity={0.4}
        />
      </mesh>

      {/* Inner trading floor — slightly brighter polished center */}
      <mesh position={[0, 0.006, 0]} receiveShadow>
        <cylinderGeometry args={[10, 10, 0.02, 32]} />
        <meshStandardMaterial
          color="#253350"
          roughness={0.25}
          metalness={0.1}
          emissive="#111a2e"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* ══════════════════════════════════════════
          GLASS CURTAIN WALL — Transparent cylinder
          ══════════════════════════════════════════ */}
      {/* If broken, create a gap at the back window (around angle PI) */}
      <mesh position={[0, CEILING_Y / 2, 0]}>
        <cylinderGeometry args={[
          BLDG_R + 0.1, BLDG_R + 0.1, CEILING_Y, 64, 1, true, 
          isBroken ? Math.PI + 0.1 : 0, 
          isBroken ? Math.PI * 2 - 0.2 : Math.PI * 2
        ]} />
        <meshPhysicalMaterial
          color="#88bbdd"
          transparent
          opacity={0.08}
          roughness={0.02}
          metalness={0.1}
          clearcoat={1.0}
          clearcoatRoughness={0.05}
          side={THREE.DoubleSide}
          envMapIntensity={0.8}
        />
      </mesh>

      {/* Glass inner reflection layer (subtle) */}
      <mesh position={[0, CEILING_Y / 2, 0]}>
        <cylinderGeometry args={[
          BLDG_R - 0.05, BLDG_R - 0.05, CEILING_Y, 64, 1, true,
          isBroken ? Math.PI + 0.1 : 0, 
          isBroken ? Math.PI * 2 - 0.2 : Math.PI * 2
        ]} />
        <meshPhysicalMaterial
          color="#aaccee"
          transparent
          opacity={0.03}
          roughness={0.0}
          metalness={0.8}
          side={THREE.BackSide}
        />
      </mesh>

      <ShatteredGlass active={isBroken} />

      {/* ══════════════════════════════════════════
          STRUCTURAL COLUMNS — Dark steel I-beams
          ══════════════════════════════════════════ */}
      {columns.map((col, i) => (
        <group key={`col-${i}`} position={[col.x, 0, col.z]} rotation={[0, col.angle, 0]}>
          {/* Main column */}
          <mesh position={[0, CEILING_Y / 2, 0]} castShadow>
            <boxGeometry args={[0.25, CEILING_Y, 0.25]} />
            <meshStandardMaterial color="#1a1a2e" roughness={0.4} metalness={0.8} />
          </mesh>
          {/* Column accent strip (glass edge trim) */}
          <mesh position={[0.14, CEILING_Y / 2, 0]}>
            <boxGeometry args={[0.02, CEILING_Y, 0.18]} />
            <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.9} />
          </mesh>
        </group>
      ))}

      {/* ══════════════════════════════════════════
          WINDOW MULLIONS — Thin vertical bars
          ══════════════════════════════════════════ */}
      {mullions.map((m, i) => (
        <mesh
          key={`mullion-${i}`}
          position={[m.x, CEILING_Y / 2, m.z]}
          rotation={[0, m.angle, 0]}
        >
          <boxGeometry args={[0.03, CEILING_Y, 0.03]} />
          <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.7} />
        </mesh>
      ))}

      {/* Horizontal mullions (floor bands at 3 heights) */}
      {[1.0, 2.25, 3.5].map((y, i) => (
        <mesh key={`h-mullion-${i}`} position={[0, y, 0]}>
          <torusGeometry args={[BLDG_R + 0.1, 0.02, 4, 64]} />
          <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.7} />
        </mesh>
      ))}



      {/* ══════════════════════════════════════════
          TOWER BODY BELOW (Visible skyscraper body extending down)
          ══════════════════════════════════════════ */}
      {facadeTexture && (
        <mesh position={[0, -77, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[BLDG_R - 0.05, BLDG_R - 0.15, 150, 64, 1, true]} />
          <meshStandardMaterial
            map={facadeTexture}
            roughness={0.3}
            metalness={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* 3D structural vertical fins running down the skyscraper body */}
      {columns.map((col, i) => (
        <mesh key={`fin-${i}`} position={[col.x * 0.99, -77, col.z * 0.99]} rotation={[0, col.angle, 0]} castShadow>
          <boxGeometry args={[0.3, 150, 0.5]} />
          <meshStandardMaterial color="#0b0f19" roughness={0.3} metalness={0.8} />
        </mesh>
      ))}

      {/* Horizontal spandrel metal bands running down the body */}
      {Array.from({ length: 8 }).map((_, idx) => {
        const yPos = -10 - idx * 18;
        return (
          <mesh key={`band-${idx}`} position={[0, yPos, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[BLDG_R - 0.02, 0.22, 8, 64]} />
            <meshStandardMaterial color="#1d2436" roughness={0.25} metalness={0.75} />
          </mesh>
        );
      })}
    </group>
  );
}
