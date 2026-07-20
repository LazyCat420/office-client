/**
 * collisionMap.js — Static obstacle map for agent path avoidance.
 * /lego module: Pure math, no React. Reusable for any 2D nav mesh.
 *
 * Obstacles are derived from Stations.jsx furniture geometry.
 * Two shapes: circles { type:'circle', x, z, r } and
 *             boxes   { type:'box', cx, cz, hw, hd, cos, sin }
 *
 * All coordinates are world-space XZ (Y is up, ignored).
 */

import { ROOM_ANGLES as RA } from './roomGeometry';

/** The central trading pit — looked up by name, not by index. */
const PIT_OBSTACLE_ID = 'trading_pit';

// ── Helper: rotate a local room position (lx, lz) by room angle ──
function rotatePoint(lx, lz, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: lx * cos + lz * sin,
    z: -lx * sin + lz * cos,
  };
}

const ROOM_OFFSET = 7.5;

// ── Helper: create a circle obstacle from a room-local position ──
function roomCircle(angle, lx, lz, r) {
  const p = rotatePoint(lx, lz + ROOM_OFFSET, angle);
  return { type: 'circle', x: p.x, z: p.z, r };
}

// ── Helper: create a rotated box obstacle from a room-local position ──
function roomBox(angle, lx, lz, hw, hd) {
  const p = rotatePoint(lx, lz + ROOM_OFFSET, angle);
  return {
    type: 'box',
    cx: p.x, cz: p.z,
    hw, hd,             // half-width, half-depth (local)
    cos: Math.cos(angle),
    sin: Math.sin(angle),
  };
}

// ══════════════════════════════════════════════════════
// STATIC OBSTACLE LIST
// ══════════════════════════════════════════════════════

function buildObstacles() {
  const obs = [];

  // ── Trading Pit (center) ──
  // Central pillar r=0.8, desk cylinder r=2.8, inner monitors r=1.5,
  // outer monitors r=3.2 → single circle covers everything with margin
  obs.push({ id: PIT_OBSTACLE_ID, type: 'circle', x: 0, z: 0, r: 4.0 });

  // ── Potted plants around trading floor perimeter ──
  // Radius 12 matches Stations.jsx (they used to be at 8 here, which pinned
  // agents at the inner desk ring r=7.5 against invisible obstacles).
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * 2 * Math.PI + Math.PI / 4;
    obs.push({ type: 'circle', x: Math.sin(a) * 12, z: Math.cos(a) * 12, r: 0.6 });
  }

  // ── Room furniture (per room) ──
  // Table half-extents match the visual meshes in Stations.jsx — undersized
  // boxes let walking agents clip through table edges.
  // 1. Lobby
  obs.push(roomBox(RA.lobby, 0, 19, 2.0, 0.4));          // reception table [4 x 0.8]
  obs.push(roomCircle(RA.lobby, 0, 17.8, 0.35));          // chair
  obs.push(roomBox(RA.lobby, -3, 15.5, 1.2, 0.5));        // couch
  obs.push(roomCircle(RA.lobby, 3.5, 14, 0.5));           // plant
  obs.push(roomCircle(RA.lobby, -3.5, 20, 0.5));          // plant

  // 2. Exec Office
  obs.push(roomBox(RA.inbox, 0, 17.5, 2.0, 0.75));        // desk [4 x 1.5]
  obs.push(roomCircle(RA.inbox, 0, 16, 0.35));             // chair
  obs.push(roomBox(RA.inbox, 0, 14, 1.3, 0.5));            // couch
  obs.push(roomCircle(RA.inbox, 3, 20, 0.5));              // plant

  // 3. War Room
  obs.push(roomBox(RA.debate, 0, 16.5, 2.0, 1.25));        // big table [4 x 2.5]
  obs.push(roomCircle(RA.debate, -1.5, 15, 0.35));          // chair
  obs.push(roomCircle(RA.debate, 1.5, 15, 0.35));           // chair
  obs.push(roomCircle(RA.debate, 0, 18.2, 0.35));           // chair
  obs.push(roomCircle(RA.debate, -2.2, 16.5, 0.35));        // chair

  // 4. Trading Tools
  obs.push(roomBox(RA.tool_bench, 0, 17, 1.5, 2.0));        // table [3 x 4]
  obs.push(roomCircle(RA.tool_bench, 1.5, 17, 0.35));        // chair
  obs.push(roomCircle(RA.tool_bench, -1.5, 17, 0.35));       // chair
  obs.push(roomBox(RA.tool_bench, 3, 20, 0.4, 0.4));         // server rack
  obs.push(roomBox(RA.tool_bench, -3, 20, 0.4, 0.4));        // server rack

  // 5. Research Desk
  obs.push(roomBox(RA.research, 0, 17, 1.5, 2.5));           // long table [3 x 5]
  obs.push(roomCircle(RA.research, 1.5, 17, 0.35));           // chair
  obs.push(roomCircle(RA.research, -1.5, 17, 0.35));          // chair
  obs.push(roomBox(RA.research, 3.5, 20.5, 0.4, 0.4));       // server rack
  obs.push(roomBox(RA.research, -3.5, 20.5, 0.4, 0.4));      // server rack
  obs.push(roomCircle(RA.research, 4, 14, 0.5));              // plant

  // 6. Risk Management
  obs.push(roomBox(RA.error, 0, 17, 2.0, 0.8));               // table [4 x 1.6]
  obs.push(roomCircle(RA.error, 0, 15.5, 0.35));              // chair
  obs.push(roomBox(RA.error, 3, 20, 0.4, 0.4));               // server rack

  // 7. Break Room
  obs.push(roomBox(RA.smoke_break, -1.5, 18.5, 1.5, 0.5));    // counter table
  obs.push(roomBox(RA.smoke_break, 2, 16, 1.0, 1.0));          // small table
  obs.push(roomCircle(RA.smoke_break, 2, 14.8, 0.35));         // chair
  obs.push(roomCircle(RA.smoke_break, 2, 17.2, 0.35));         // chair
  obs.push(roomBox(RA.smoke_break, -1.5, 14.5, 1.3, 0.5));    // couch
  obs.push(roomCircle(RA.smoke_break, 4, 13, 0.5));            // plant

  return obs;
}

export const OBSTACLES = buildObstacles();

// ══════════════════════════════════════════════════════
// COLLISION QUERIES
// ══════════════════════════════════════════════════════

/**
 * Check if a point (x, z) is inside any obstacle, with margin for agent radius.
 */
export function isPointBlocked(x, z, agentRadius = 0.5) {
  for (const o of OBSTACLES) {
    if (o.type === 'circle') {
      const dx = x - o.x;
      const dz = z - o.z;
      const minDist = o.r + agentRadius;
      if (dx * dx + dz * dz < minDist * minDist) return true;
    } else if (o.type === 'box') {
      // Transform point into box-local space
      const dx = x - o.cx;
      const dz = z - o.cz;
      const localX = dx * o.cos - dz * o.sin;
      const localZ = dx * o.sin + dz * o.cos;
      if (Math.abs(localX) < o.hw + agentRadius &&
          Math.abs(localZ) < o.hd + agentRadius) return true;
    }
  }
  return false;
}

/**
 * Check if a point (x, z) intersects any obstacle.
 * Returns { normal: {x, z}, penetration } for the deepest collision, or null.
 */
export function getCollision(x, z, agentRadius = 0.5) {
  let maxPenetration = -1;
  let collisionNormal = null;

  for (const o of OBSTACLES) {
    if (o.type === 'circle') {
      const dx = x - o.x;
      const dz = z - o.z;
      const minDist = o.r + agentRadius;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        const penetration = minDist - dist;
        if (penetration > maxPenetration) {
          maxPenetration = penetration;
          if (dist > 0.0001) {
            collisionNormal = { x: dx / dist, z: dz / dist };
          } else {
            collisionNormal = { x: 1, z: 0 };
          }
        }
      }
    } else if (o.type === 'box') {
      const dx = x - o.cx;
      const dz = z - o.cz;
      const localX = dx * o.cos - dz * o.sin;
      const localZ = dx * o.sin + dz * o.cos;
      
      const halfW = o.hw + agentRadius;
      const halfD = o.hd + agentRadius;
      
      const absLocalX = Math.abs(localX);
      const absLocalZ = Math.abs(localZ);
      
      if (absLocalX < halfW && absLocalZ < halfD) {
        const penX = halfW - absLocalX;
        const penZ = halfD - absLocalZ;
        
        let localNormX = 0;
        let localNormZ = 0;
        let penetration = 0;
        
        if (penX < penZ) {
          penetration = penX;
          localNormX = localX >= 0 ? 1 : -1;
        } else {
          penetration = penZ;
          localNormZ = localZ >= 0 ? 1 : -1;
        }
        
        if (penetration > maxPenetration) {
          maxPenetration = penetration;
          // Transform local normal back to world space
          collisionNormal = {
            x: localNormX * o.cos + localNormZ * o.sin,
            z: -localNormX * o.sin + localNormZ * o.cos
          };
        }
      }
    }
  }

  if (maxPenetration > 0) {
    return { normal: collisionNormal, penetration: maxPenetration };
  }
  return null;
}

/**
 * Check if a line segment (x1,z1)→(x2,z2) intersects any obstacle.
 * Uses swept-circle test (agent is a moving circle).
 */
export function isLineBlocked(x1, z1, x2, z2, agentRadius = 0.5) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.001) return isPointBlocked(x1, z1, agentRadius);

  // Sample points along the line (every 0.5 units)
  const steps = Math.ceil(len / 0.5);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (isPointBlocked(x1 + dx * t, z1 + dz * t, agentRadius)) return true;
  }
  return false;
}

// ══════════════════════════════════════════════════════
// ROOM DOORWAYS — precomputed entry points at inner edge of each room
// ══════════════════════════════════════════════════════
// At radius ~14 from center, at each room's angle — the "hallway" between
// the trading floor and the perimeter rooms.
const DOORWAY_R = 14;
export const ROOM_DOORWAYS = {};
for (const [name, angle] of Object.entries(RA)) {
  ROOM_DOORWAYS[name] = [
    DOORWAY_R * Math.sin(angle),
    DOORWAY_R * Math.cos(angle),
  ];
}

/**
 * Find the first obstacle that blocks a line segment.
 * Returns the obstacle object or null.
 */
function findBlockingObstacle(x1, z1, x2, z2, agentRadius = 0.5) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.001) return null;

  const steps = Math.ceil(len / 0.5);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x1 + dx * t;
    const pz = z1 + dz * t;

    for (const o of OBSTACLES) {
      if (o.type === 'circle') {
        const ddx = px - o.x;
        const ddz = pz - o.z;
        const minDist = o.r + agentRadius;
        if (ddx * ddx + ddz * ddz < minDist * minDist) return o;
      } else if (o.type === 'box') {
        const ddx = px - o.cx;
        const ddz = pz - o.cz;
        const localX = ddx * o.cos - ddz * o.sin;
        const localZ = ddx * o.sin + ddz * o.cos;
        if (Math.abs(localX) < o.hw + agentRadius &&
            Math.abs(localZ) < o.hd + agentRadius) return o;
      }
    }
  }
  return null;
}

/**
 * Generate arc waypoints around a circle obstacle.
 */
function arcAroundCircle(obs, x1, z1, x2, z2, agentRadius = 0.5) {
  const avoidR = obs.r + agentRadius + 0.3;
  const angleStart = Math.atan2(x1 - obs.x, z1 - obs.z);
  const angleEnd = Math.atan2(x2 - obs.x, z2 - obs.z);

  let diff = angleEnd - angleStart;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  const arcSteps = Math.max(2, Math.ceil(Math.abs(diff) / (Math.PI / 4)));
  const waypoints = [];
  for (let i = 1; i < arcSteps; i++) {
    const t = i / arcSteps;
    const angle = angleStart + diff * t;
    waypoints.push([
      obs.x + avoidR * Math.sin(angle),
      obs.z + avoidR * Math.cos(angle),
    ]);
  }
  return waypoints;
}

/**
 * Generate detour waypoints around a box obstacle.
 * Picks the shorter route around either the "left" or "right" edge.
 */
function arcAroundBox(obs, x1, z1, x2, z2, agentRadius = 0.5) {
  const margin = agentRadius + 0.3;
  const hw = obs.hw + margin;
  const hd = obs.hd + margin;

  // Four corners of the expanded box in world space
  const corners = [
    [-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd],
  ].map(([lx, lz]) => [
    obs.cx + lx * obs.cos + lz * obs.sin,
    obs.cz - lx * obs.sin + lz * obs.cos,
  ]);

  // Pick the two corners that route around the "shorter" side
  // by finding corners closest to start and end points
  let bestPair = null;
  let bestDist = Infinity;

  for (let i = 0; i < 4; i++) {
    const c1 = corners[i];
    const c2 = corners[(i + 1) % 4];
    const dist = Math.hypot(c1[0] - x1, c1[1] - z1) +
                 Math.hypot(c1[0] - c2[0], c1[1] - c2[1]) +
                 Math.hypot(c2[0] - x2, c2[1] - z2);
    if (dist < bestDist) {
      bestDist = dist;
      bestPair = [c1, c2];
    }
  }

  return bestPair || [];
}

/**
 * Generate waypoints around any single obstacle.
 */
function arcAroundObstacle(obs, x1, z1, x2, z2, agentRadius = 0.5) {
  if (obs.type === 'circle') {
    return arcAroundCircle(obs, x1, z1, x2, z2, agentRadius);
  }
  return arcAroundBox(obs, x1, z1, x2, z2, agentRadius);
}

/**
 * Identify which room a point is in based on proximity to room centers.
 * Returns the room key or null if on the trading floor.
 */
function identifyRoom(x, z) {
  const R_ROOM = 23.5;
  const distFromCenter = Math.sqrt(x * x + z * z);

  // If close to center, it's the trading floor
  if (distFromCenter < 13) return null;

  // Find nearest room
  let bestRoom = null;
  let bestDist = Infinity;
  for (const [name, angle] of Object.entries(RA)) {
    const rx = R_ROOM * Math.sin(angle);
    const rz = R_ROOM * Math.cos(angle);
    const dx = x - rx;
    const dz = z - rz;
    const dist = dx * dx + dz * dz;
    if (dist < bestDist) {
      bestDist = dist;
      bestRoom = name;
    }
  }
  return bestRoom;
}

/**
 * Find waypoints to route around obstacles between (x1,z1) and (x2,z2).
 * Returns array of [x, z] intermediate points. Empty if path is clear.
 *
 * Strategy:
 * 1. If direct path is clear → return empty (no waypoints needed)
 * 2. If both points are in the same room → route around blocking obstacle
 * 3. If cross-room → route through doorways:
 *    source → source doorway → (pit arc if blocked) → dest doorway → dest
 */
export function findWaypoints(x1, z1, x2, z2, agentRadius = 0.5) {
  // 1. Fast path — nothing blocked
  if (!isLineBlocked(x1, z1, x2, z2, agentRadius)) return [];

  const srcRoom = identifyRoom(x1, z1);
  const dstRoom = identifyRoom(x2, z2);

  // 2. Same room or trading floor — try direct obstacle avoidance
  if (srcRoom === dstRoom) {
    const blocker = findBlockingObstacle(x1, z1, x2, z2, agentRadius);
    if (blocker) {
      return arcAroundObstacle(blocker, x1, z1, x2, z2, agentRadius);
    }
    return [];
  }

  // 3. Cross-room routing through doorways
  const waypoints = [];

  // Get doorway for source room (or nearest point on trading floor)
  const srcDoor = srcRoom ? ROOM_DOORWAYS[srcRoom] : [x1, z1];
  const dstDoor = dstRoom ? ROOM_DOORWAYS[dstRoom] : [x2, z2];

  // Segment 1: source → source doorway
  if (srcRoom && isLineBlocked(x1, z1, srcDoor[0], srcDoor[1], agentRadius)) {
    const blocker = findBlockingObstacle(x1, z1, srcDoor[0], srcDoor[1], agentRadius);
    if (blocker) {
      waypoints.push(...arcAroundObstacle(blocker, x1, z1, srcDoor[0], srcDoor[1], agentRadius));
    }
  }
  if (srcRoom) waypoints.push(srcDoor);

  // Segment 2: source doorway → dest doorway (may need to arc around pit)
  if (isLineBlocked(srcDoor[0], srcDoor[1], dstDoor[0], dstDoor[1], agentRadius)) {
    const pit = OBSTACLES.find(o => o.id === PIT_OBSTACLE_ID);
    if (pit) {
      waypoints.push(...arcAroundCircle(pit, srcDoor[0], srcDoor[1], dstDoor[0], dstDoor[1], agentRadius));
    }
  }

  // Add destination doorway
  if (dstRoom) waypoints.push(dstDoor);

  // Segment 3: dest doorway → dest (route around furniture in dest room)
  if (dstRoom && isLineBlocked(dstDoor[0], dstDoor[1], x2, z2, agentRadius)) {
    const blocker = findBlockingObstacle(dstDoor[0], dstDoor[1], x2, z2, agentRadius);
    if (blocker) {
      waypoints.push(...arcAroundObstacle(blocker, dstDoor[0], dstDoor[1], x2, z2, agentRadius));
    }
  }

  return waypoints;
}

/**
 * Nudge a position outward if it's blocked.
 * Pushes away from the nearest obstacle center.
 */
export function nudgeIfBlocked(x, z, agentRadius = 0.5) {
  // Iteratively resolve penetrations — getCollision handles both circles
  // and boxes (the old version only knew circles, so table blockages could
  // return positions that were still inside the table).
  let px = x;
  let pz = z;
  for (let i = 0; i < 8; i++) {
    const col = getCollision(px, pz, agentRadius + 0.3);
    if (!col) break;
    px += col.normal.x * (col.penetration + 0.05);
    pz += col.normal.z * (col.penetration + 0.05);
  }
  return { x: px, z: pz };
}
