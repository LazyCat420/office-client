import React, { useState, useCallback, useMemo } from 'react';
import { Toucan } from './primitives/Toucan';
import { GlassCup } from './primitives/GlassCup';
import { soundManager } from './SoundManager';
import { ROOM_ANGLES } from './routing/roomGeometry';

/**
 * ToucanScene — Manages the toucan and all breakable glass cups in the office.
 *
 * Places glass cups on the break room tables and counters, calculates their 
 * world positions (accounting for the room's rotation), and feeds those to 
 * the Toucan for collision detection.
 *
 * The break room is at angle RA.smoke_break = 12 * Math.PI / 7 ≈ 5.385 rad.
 */

const SMOKE_BREAK_ANGLE = ROOM_ANGLES.smoke_break;

// Cup positions in LOCAL break room coordinates (before rotation)
// These sit on the two tables in the break room
const CUP_LOCAL_POSITIONS = [
  // On the white counter table at [-1.5, 0, 18.5], table height 0.85
  [-0.8, 0.96, 18.5],   // Cup 1 — near coffee maker
  [-1.2, 0.96, 18.3],   // Cup 2 — next to cup 1
  [-1.8, 0.96, 18.7],   // Cup 3 — other side
  [-0.5, 0.96, 18.6],   // Cup 4 — edge of counter

  // On the brown table at [2, 0, 16], table height 0.75
  [1.7, 0.86, 16.2],    // Cup 5 — on the dining table
  [2.3, 0.86, 15.8],    // Cup 6 — across from cup 5
  [2.0, 0.86, 16.5],    // Cup 7 — center-ish
];

// Convert local positions to world positions (rotate by smoke_break angle)
function localToWorld(localPos, angle) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const x = localPos[0] * cos + localPos[2] * sin;
  const z = -localPos[0] * sin + localPos[2] * cos;
  return [x, localPos[1], z];
}

export function ToucanScene() {
  const [brokenCups, setBrokenCups] = useState(new Set());

  // Calculate world positions for all cups
  const cupWorldPositions = useMemo(() => {
    return CUP_LOCAL_POSITIONS.map(pos => localToWorld(pos, SMOKE_BREAK_ANGLE));
  }, []);

  // Get only unbroken cup positions for the toucan
  const activeCupPositions = useMemo(() => {
    return cupWorldPositions.map((pos, i) => brokenCups.has(i) ? null : pos);
  }, [cupWorldPositions, brokenCups]);

  const handleBreakCup = useCallback((index) => {
    setBrokenCups(prev => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
    // soundManager.init();
    // soundManager.playGlassBreak?.();
  }, []);

  const handleWindowBreak = useCallback(() => {
    // soundManager.init();
    // soundManager.playGlassBreak?.();
  }, []);

  return (
    <>
      {/* ═══ Glass cups in break room ═══ */}
      <group rotation={[0, SMOKE_BREAK_ANGLE, 0]}>
        {CUP_LOCAL_POSITIONS.map((pos, i) => (
          !brokenCups.has(i) && (
            <GlassCup
              key={`cup-${i}`}
              position={pos}
              onBreak={() => handleBreakCup(i)}
            />
          )
        ))}
      </group>

      {/* ═══ The Toucan ═══ */}
      <Toucan
        glassCupPositions={activeCupPositions}
        onBreakCup={handleBreakCup}
        onWindowBreak={handleWindowBreak}
      />
    </>
  );
}
