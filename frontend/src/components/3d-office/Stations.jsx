import React, { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { STATIONS } from './routing';
import {
  Wall,
  Table,
  Monitor,
  ServerRack,
  PottedPlant,
  Couch,
  Chair,
  Confetti,
  TradingPit,
  WaterCooler,
} from './primitives';

// ── Global Room & Geometry Constants ──
const BLDG_R = 32;     // Building outer radius
const INNER_R = 15;    // Trading floor inner boundary
const NUM_SEG = 48;    // Wall segments for circular wall
const WH = 1.2;        // Wall height

// Room angles (clockwise from south/+Z)
const RA = {
  lobby:       0,
  inbox:       2 * Math.PI / 7,
  debate:      4 * Math.PI / 7,
  tool_bench:  6 * Math.PI / 7,
  research:    8 * Math.PI / 7,
  error:       10 * Math.PI / 7,
  smoke_break: 12 * Math.PI / 7,
};

// Divider wall angles (between adjacent rooms)
const divAngles = Array.from({ length: 7 }, (_, i) => (2 * i + 1) * Math.PI / 7);

// Entrance gap: skip segments near angle 0 (south/+Z)
const entranceSkip = new Set();
for (let i = 0; i < NUM_SEG; i++) {
  const a = (i / NUM_SEG) * 2 * Math.PI;
  if (a < 0.18 || a > 2 * Math.PI - 0.18) entranceSkip.add(i);
}

const segLen = 2 * BLDG_R * Math.sin(Math.PI / NUM_SEG) + 0.12;
const divLen = BLDG_R - INNER_R;
const divMidR = (BLDG_R + INNER_R) / 2;

// Room floor colors
const floorColors = {
  lobby: '#e2e8f0',
  inbox: '#451a03',
  debate: '#1e3a8a',
  tool_bench: '#1e1b4b',
  research: '#7c2d12',
  error: '#450a0a',
  smoke_break: '#475569',
};

/**
 * FlyingPapers — animated sheets/folders flying back and forth
 * between the agents at the left and right edges of the table.
 */
function FlyingPapers() {
  const refs = useRef([]);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      // i = 0: paper sheet flying left-to-right
      // i = 1: paper sheet flying right-to-left
      // i = 2: cash stack flying left-to-right
      const cycle = (t * 0.4 + i * 1.8) % 4.0;
      if (cycle < 1.2) {
        mesh.visible = true;
        const progress = cycle / 1.2;
        const startX = i % 2 === 0 ? -1.25 : 1.25;
        const endX = i % 2 === 0 ? 1.25 : -1.25;
        const x = startX + (endX - startX) * progress;
        // Parabolic trajectory (arc)
        const y = 0.56 + Math.sin(progress * Math.PI) * 0.7;
        const z = 17.0 + Math.sin(t * 1.5 + i) * 1.2;
        mesh.position.set(x, y, z);
        mesh.rotation.set(t * 4 + i, t * 2, t * 3);
      } else {
        mesh.visible = false;
      }
    });
  });

  return (
    <group>
      <mesh ref={el => refs.current[0] = el} castShadow>
        <boxGeometry args={[0.3, 0.005, 0.45]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.9} />
      </mesh>
      <mesh ref={el => refs.current[1] = el} castShadow>
        <boxGeometry args={[0.3, 0.005, 0.45]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.9} />
      </mesh>
      <mesh ref={el => refs.current[2] = el} castShadow>
        <boxGeometry args={[0.25, 0.02, 0.45]} />
        <meshStandardMaterial color="#16a34a" roughness={0.7} />
      </mesh>
    </group>
  );
}

/**
 * StationContainer — Reusable wrapper for perimeter rooms,
 * handling rotation and radial offsets.
 */
function StationContainer({ angle, children }) {
  return (
    <group rotation={[0, angle, 0]}>
      <group position={[0, 0, 7.5]}>
        {children}
      </group>
    </group>
  );
}

// ── 7 Room Station Components ──

function LobbyStation() {
  return (
    <StationContainer angle={RA.lobby}>
      <Table position={[0, 0, 19]} size={[4, 0.55, 0.8]} color="#7c2d12" />
      <Monitor position={[0, 0.55, 19]} rotation={[0, Math.PI, 0]} screenColor="#10b981" />
      <Chair position={[0, 0, 17.6]} rotation={[0, Math.PI, 0]} />
      <Couch position={[-3, 0, 15.5]} rotation={[0, Math.PI, 0]} width={2.2} />
      <PottedPlant position={[3.5, 0, 14]} />
      <PottedPlant position={[-3.5, 0, 20]} />
    </StationContainer>
  );
}

function ExecOfficeStation() {
  return (
    <StationContainer angle={RA.inbox}>
      <Table position={[0, 0, 17.5]} size={[4, 0.55, 1.5]} color="#451a03" />
      <Monitor position={[0, 0.55, 17.5]} rotation={[0, Math.PI, 0]} screenColor="#10b981" />
      <Chair position={[0, 0, 16.2]} rotation={[0, Math.PI, 0]} />
      <Couch position={[0, 0, 14]} width={2.5} />
      <PottedPlant position={[3, 0, 20]} />
    </StationContainer>
  );
}

function WarRoomStation() {
  return (
    <StationContainer angle={RA.debate}>
      <Table position={[0, 0, 16.5]} size={[4, 0.55, 2.5]} color="#1e293b" />
      <Chair position={[-1.5, 0, 14.7]} rotation={[0, Math.PI, 0]} />
      <Chair position={[1.5, 0, 14.7]} rotation={[0, Math.PI, 0]} />
      <Chair position={[0, 0, 18.3]} />
      <Chair position={[-2.5, 0, 16.5]} rotation={[0, Math.PI / 2, 0]} />
      {/* Whiteboard on outer wall */}
      <mesh position={[0, 1.0, 20.5]}>
        <boxGeometry args={[3, 1.2, 0.05]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.2} />
      </mesh>
    </StationContainer>
  );
}

function TradingToolsStation() {
  return (
    <StationContainer angle={RA.tool_bench}>
      <Table position={[0, 0, 17]} size={[3, 0.55, 4]} color="#1e293b" />
      <Monitor position={[-0.5, 0.55, 18.5]} screenColor="#a855f7" />
      <Monitor position={[0.5, 0.55, 15.5]} screenColor="#a855f7" />
      <Chair position={[1.97, 0, 17]} rotation={[0, -Math.PI / 2, 0]} />
      <Chair position={[-1.97, 0, 17]} rotation={[0, Math.PI / 2, 0]} />
      <ServerRack position={[3, 0, 20]} />
      <ServerRack position={[-3, 0, 20]} />
    </StationContainer>
  );
}

function ResearchDeskStation() {
  return (
    <StationContainer angle={RA.research}>
      <Table position={[0, 0, 17]} size={[3, 0.55, 5]} color="#78350f" />
      <Monitor position={[0, 0.55, 18.5]} screenColor="#eab308" showChart={true} />
      <Monitor position={[0, 0.55, 15.5]} screenColor="#eab308" showChart={true} />
      <Chair position={[1.97, 0, 17]} rotation={[0, -Math.PI / 2, 0]} />
      <Chair position={[-1.97, 0, 17]} rotation={[0, Math.PI / 2, 0]} />
      <ServerRack position={[3.5, 0, 20.5]} />
      <ServerRack position={[-3.5, 0, 20.5]} />

      {/* Paper sheets — moved close to the left/right table edges */}
      {/* Right edge sheets (X ≈ 1.2) */}
      <mesh position={[1.18, 0.56, 18.2]} rotation={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.4, 0.005, 0.6]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.9} />
      </mesh>
      <mesh position={[1.22, 0.56, 16.8]} rotation={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.4, 0.005, 0.6]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.9} />
      </mesh>
      {/* Left edge sheets (X ≈ -1.2) */}
      <mesh position={[-1.18, 0.56, 16.0]} rotation={[0, -0.3, 0]} castShadow>
        <boxGeometry args={[0.4, 0.005, 0.6]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.9} />
      </mesh>
      <mesh position={[-1.22, 0.56, 18.0]} rotation={[0, -0.1, 0]} castShadow>
        <boxGeometry args={[0.4, 0.005, 0.6]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.9} />
      </mesh>
      <mesh position={[-1.15, 0.56, 15.0]} rotation={[0, 0.65, 0]} castShadow>
        <boxGeometry args={[0.4, 0.005, 0.6]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.9} />
      </mesh>

      {/* File Folders — moved close to the edges */}
      <mesh position={[-1.2, 0.565, 17.5]} rotation={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[0.55, 0.015, 0.75]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.8} />
      </mesh>
      <mesh position={[1.2, 0.565, 16.2]} rotation={[0, -0.2, 0]} castShadow>
        <boxGeometry args={[0.55, 0.015, 0.75]} />
        <meshStandardMaterial color="#d97706" roughness={0.8} />
      </mesh>

      {/* Cash stacks — moved close to the edges */}
      <mesh position={[-1.25, 0.57, 18.5]} rotation={[0, -0.4, 0]} castShadow>
        <boxGeometry args={[0.25, 0.03, 0.5]} />
        <meshStandardMaterial color="#16a34a" roughness={0.7} />
      </mesh>
      <mesh position={[1.15, 0.57, 17.2]} rotation={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.25, 0.04, 0.5]} />
        <meshStandardMaterial color="#15803d" roughness={0.7} />
      </mesh>
      <mesh position={[-1.22, 0.57, 15.2]} rotation={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[0.25, 0.02, 0.5]} />
        <meshStandardMaterial color="#166534" roughness={0.7} />
      </mesh>

      {/* Pens & Pencils — moved close to the edges */}
      <mesh position={[1.2, 0.57, 18.0]} rotation={[Math.PI / 2, 0, 0.8]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.2, 4]} />
        <meshStandardMaterial color="#2563eb" roughness={0.5} />
      </mesh>
      <mesh position={[-1.2, 0.57, 16.2]} rotation={[Math.PI / 2, 0, -0.5]} castShadow>
        <cylinderGeometry args={[0.01, 0.01, 0.2, 4]} />
        <meshStandardMaterial color="#eab308" roughness={0.5} />
      </mesh>
      <mesh position={[1.18, 0.57, 16.7]} rotation={[Math.PI / 2, 0, 1.2]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.18, 4]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} />
      </mesh>

      {/* Flying documents & money zooming back and forth between agents */}
      <FlyingPapers />

      <PottedPlant position={[4, 0, 14]} />
    </StationContainer>
  );
}

function RiskManagementStation() {
  return (
    <StationContainer angle={RA.error}>
      <Table position={[0, 0, 17]} size={[4, 0.55, 1.6]} color="#0f172a" />
      <Monitor position={[0, 0.55, 17]} screenColor="#ef4444" />
      <Chair position={[0, 0, 15.6]} rotation={[0, Math.PI, 0]} />
      <ServerRack position={[3, 0, 20]} />
    </StationContainer>
  );
}

function BreakRoomStation() {
  return (
    <StationContainer angle={RA.smoke_break}>
      <Table position={[-1.5, 0, 18.5]} size={[3, 0.55, 0.8]} color="#f8fafc" />
      {/* Coffee maker */}
      <mesh position={[-2, 0.70, 18.5]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.3, 8]} />
        <meshStandardMaterial color="#ef4444" roughness={0.3} />
      </mesh>
      {/* Water Cooler */}
      <WaterCooler position={[-0.5, 0, 18.5]} />
      <Table position={[2, 0, 16]} size={[2, 0.55, 2]} color="#7c2d12" />
      <Chair position={[2, 0, 14.5]} rotation={[0, Math.PI, 0]} />
      <Chair position={[2, 0, 17.5]} />
      <Couch position={[-1.5, 0, 14.5]} width={2.5} />
      <PottedPlant position={[4, 0, 13]} />
    </StationContainer>
  );
}

// ── Layer Components ──

function ColoredFloorSlabs() {
  return (
    <>
      {Object.entries(RA).map(([sid, angle]) => {
        const r = 23.5;
        return (
          <mesh
            key={`floor-${sid}`}
            position={[r * Math.sin(angle), 0.008, r * Math.cos(angle)]}
            rotation={[0, angle, 0]}
            receiveShadow
          >
            <boxGeometry args={[14, 0.02, 15]} />
            <meshStandardMaterial color={floorColors[sid]} roughness={0.6} transparent opacity={0.4} />
          </mesh>
        );
      })}
    </>
  );
}

function OuterWalls() {
  return (
    <>
      {Array.from({ length: NUM_SEG }, (_, i) => {
        if (entranceSkip.has(i)) return null;
        const a = (i / NUM_SEG) * 2 * Math.PI;
        return (
          <Wall
            key={`wall-${i}`}
            position={[BLDG_R * Math.sin(a), WH / 2, BLDG_R * Math.cos(a)]}
            size={[segLen, WH, 0.2]}
            rotation={[0, a, 0]}
            type="glass"
          />
        );
      })}
      {/* Entrance pillars */}
      <Wall position={[3, WH / 2 + 0.15, BLDG_R - 0.1]} size={[0.4, WH + 0.3, 0.4]} />
      <Wall position={[-3, WH / 2 + 0.15, BLDG_R - 0.1]} size={[0.4, WH + 0.3, 0.4]} />
    </>
  );
}

function DividerWalls() {
  return (
    <>
      {divAngles.map((a, i) => (
        <Wall
          key={`div-${i}`}
          position={[divMidR * Math.sin(a), WH / 2, divMidR * Math.cos(a)]}
          size={[0.15, WH, divLen]}
          rotation={[0, a, 0]}
        />
      ))}
    </>
  );
}

function RoomLabels() {
  return (
    <>
      {Object.entries(RA).map(([sid, angle]) => {
        const station = STATIONS[sid];
        if (!station) return null;
        const lr = 13;
        return (
          <Html
            key={station.id}
            position={[lr * Math.sin(angle), 0.3, lr * Math.cos(angle)]}
            center
          >
            <div style={{
              color: station.color,
              fontWeight: 'bold',
              fontFamily: 'system-ui, sans-serif',
              fontSize: '0.75rem',
              textShadow: '0 1px 4px rgba(0,0,0,0.8)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              textTransform: 'uppercase',
              background: 'rgba(0,0,0,0.6)',
              padding: '2px 6px',
              borderRadius: '3px',
            }}>
              {station.icon} {station.label}
            </div>
          </Html>
        );
      })}
      {/* Trading Floor label */}
      <Html position={[0, 0.3, 0]} center>
        <div style={{
          color: STATIONS.desk.color,
          fontWeight: 'bold',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '0.85rem',
          textShadow: '0 1px 4px rgba(0,0,0,0.8)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
          background: 'rgba(0,0,0,0.6)',
          padding: '3px 8px',
          borderRadius: '4px',
        }}>
          {STATIONS.desk.icon} {STATIONS.desk.label}
        </div>
      </Html>
    </>
  );
}

// ── Main Declarative Stations Component ──

export function Stations() {
  return (
    <group>
      {/* Structural Layers */}
      <ColoredFloorSlabs />
      <OuterWalls />
      <DividerWalls />
      <RoomLabels />

      {/* Centerpiece & Effects */}
      <TradingPit />
      <Confetti />

      {/* Perimeter Stations */}
      <LobbyStation />
      <ExecOfficeStation />
      <WarRoomStation />
      <TradingToolsStation />
      <ResearchDeskStation />
      <RiskManagementStation />
      <BreakRoomStation />

      {/* Decorative Plants around Pit Perimeter */}
      {[0, 1, 2, 3].map(i => {
        const a = (i / 4) * 2 * Math.PI + Math.PI / 4;
        return <PottedPlant key={`pit-plant-${i}`} position={[Math.sin(a) * 12, 0, Math.cos(a) * 12]} />;
      })}
    </group>
  );
}
