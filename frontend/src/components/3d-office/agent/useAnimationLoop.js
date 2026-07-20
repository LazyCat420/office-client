/**
 * useAnimationLoop.js — The useFrame animation tick for agents.
 * /lego module: Extracted from Agent.jsx for reuse and isolation.
 *
 * Handles:
 * - Animation state selection (walking vs working vs idle)
 * - Facing angle interpolation (smooth turning)
 * - Limb rotation lerping (smooth transitions between animation states)
 * - Returns the current animation prop (document, hammer, etc.)
 */

import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { AGENT_STATES, getCollision } from '../routing';

export const sharedAgentPositions = new Map();
export const sharedAgentPositionsList = [];
import { getAnimation, getTalkingAnimation, getGestureAnimation, walkingAnim, STATION_FACING, GESTURE_PROPS } from '../animations';
import { throwPaper } from '../primitives/PaperManager';
import * as THREE from 'three';

// Hoisted scratch vector for kinematic collider sync (avoid per-frame alloc)
const _worldPos = new THREE.Vector3();

/** An agent is a janitor by tool assignment or by name, whatever station it's at. */
const isJanitorAgent = (agent) =>
  agent.tool === 'janitor' || Boolean(agent.id && agent.id.toLowerCase().includes('janitor'));

/**
 * @param {Object} agent — agent state from stateMachine
 * @param {Object} position — spring animated position { get: () => [x, y, z] }
 * @param {Object} refs — { parentRef, bodyRef, leftArmRef, rightArmRef, leftLegRef, rightLegRef }
 * @returns {{ animProp: string|null }} — the current handheld prop name
 */
export function useAnimationLoop(agent, position, refs) {
  // Store refs and agent in mutable references to avoid stale closure issues in useFrame
  const agentRef = useRef(agent);
  const refsRef = useRef(refs);

  useEffect(() => {
    agentRef.current = agent;
    refsRef.current = refs;
  });

  const isWorking = agent.state === AGENT_STATES.WORKING;
  const isWalking = agent.state === AGENT_STATES.WALKING;
  const isError = agent.state === AGENT_STATES.ERROR;
  const isIdle = agent.state === AGENT_STATES.IDLE;

  // Collision/bounce physical state variables
  const bounceOffsetRef = useRef({ x: 0, z: 0 });
  const bounceVelocityRef = useRef({ x: 0, z: 0 });
  const prevNominalPosRef = useRef({ x: agent.x || 0, z: agent.z || 0 });
  const facingRef = useRef(agent.facing !== undefined ? agent.facing : 0);
  const prevPropRef = useRef(null);
  const lastHandoffRef = useRef(0); // throw a hand-off envelope once per agent_done

  const { timeOffset, idHash } = useMemo(() => {
    let h = 0;
    for (let i = 0; i < agent.id.length; i++) h += agent.id.charCodeAt(i);
    return { timeOffset: (h % 100) * 0.1, idHash: h };
  }, [agent.id]);

  useEffect(() => {
    return () => {
      sharedAgentPositions.delete(agent.id);
      const idx = sharedAgentPositionsList.findIndex(p => p.id === agent.id);
      if (idx !== -1) sharedAgentPositionsList.splice(idx, 1);
    };
  }, [agent.id]);

  // Snap facing to correct angle when agent arrives at a station (walking → working/idle)
  const prevWalkingRef = useRef(isWalking);
  useEffect(() => {
    if (prevWalkingRef.current && !isWalking && agent.facing !== undefined) {
      facingRef.current = agent.facing;
    }
    prevWalkingRef.current = isWalking;
  }, [isWalking, agent.facing]);

  useFrame((state, delta) => {
    const currentAgent = agentRef.current;
    const currentRefs = refsRef.current;
    const { parentRef, bodyRef, leftArmRef, rightArmRef, leftLegRef, rightLegRef, colliderRef } = currentRefs;

    const currentIsWorking = currentAgent.state === AGENT_STATES.WORKING;
    const currentIsWalking = currentAgent.state === AGENT_STATES.WALKING;
    const currentIsError = currentAgent.state === AGENT_STATES.ERROR;
    const currentIsIdle = currentAgent.state === AGENT_STATES.IDLE;

    const t = state.clock.getElapsedTime() + timeOffset;

    // Reaction gestures and speech gestures override station poses (but never
    // the walk cycle — a stationary gesture on a sliding agent looks broken).
    const gestureActive = currentAgent.gesture
      && currentAgent.gestureUntil && Date.now() < currentAgent.gestureUntil;

    let anim;
    if (currentIsWalking) {
      anim = walkingAnim(t);
    } else if (gestureActive) {
      anim = getGestureAnimation(currentAgent.gesture, t);
    } else if (currentAgent.isSpeaking) {
      anim = getTalkingAnimation(idHash, t);
    } else if (currentIsWorking || currentIsIdle || currentIsError) {
      if (isJanitorAgent(currentAgent)) {
        // Use the agent's own variant so the janitor mops and cleans windows
        // instead of sweeping forever; getAnimation wraps out-of-range indices.
        anim = getAnimation('janitor', currentAgent.animVariant || 0, t);
      } else if (currentAgent.station === 'debate' && currentAgent.opponentId) {
        // Two debaters take turns: one thrusts while the other parries, swapping
        // every beat, so the War Room reads as a real exchange, not two solos.
        // Uses the SHARED clock (not the per-agent offset t) so the two stay
        // complementary and their timing lines up (lunge meets block).
        const sharedT = state.clock.getElapsedTime();
        const beat = Math.floor(sharedT / 1.8) % 2;
        const leads = currentAgent.id < currentAgent.opponentId; // stable ordering
        const variant = (leads === (beat === 0)) ? 0 : 2; // 0 = thrust, 2 = parry
        anim = getAnimation('debate', variant, sharedT);
      } else {
        anim = getAnimation(currentAgent.station, currentAgent.animVariant || 0, t);
      }
    } else {
      anim = getAnimation('lobby', 0, t);
    }

    const curPos = position.get();
    const curX = curPos[0];
    const curZ = curPos[2];
    if (isNaN(curX) || isNaN(curZ)) return;

    // ── Check Edge Falling and Glass Wall Constraint ──
    const dt = Math.min(delta, 0.1); // cap time-step to prevent physics explosion during tab out
    // Framerate-independent damping factor: replaces fixed per-frame lerp
    // constants (which made turn/limb speed depend on FPS). rate ≈ -ln(1-k)·60
    // reproduces the old feel at 60fps.
    const dampK = (rate) => 1 - Math.exp(-rate * dt);
    const BLDG_R = 31.5;
    
    // Use candidate position (spring pos + bounce offset) for edge check
    const candX = curX + bounceOffsetRef.current.x;
    const candZ = curZ + bounceOffsetRef.current.z;
    const distFromCenter = Math.sqrt(candX * candX + candZ * candZ);
    
    if (!bounceOffsetRef.current.y) bounceOffsetRef.current.y = 0;
    if (!bounceVelocityRef.current.y) bounceVelocityRef.current.y = 0;

    const inAir = bounceOffsetRef.current.y !== 0;

    if (inAir) {
      // Free fall or respawn fall
      bounceVelocityRef.current.y -= 25.0 * dt; // gravity
      bounceOffsetRef.current.y += bounceVelocityRef.current.y * dt;

      if (bounceOffsetRef.current.y < -30) {
        // Respawn falling from the sky in the middle (0,0)
        bounceOffsetRef.current.x = -curX;
        bounceOffsetRef.current.z = -curZ;
        bounceOffsetRef.current.y = 15;
        bounceVelocityRef.current.y = 0;
        bounceVelocityRef.current.x = 0;
        bounceVelocityRef.current.z = 0;
      } else if (bounceOffsetRef.current.y > 0) {
        // Lock horizontal coordinates to (0,0) while falling from sky
        bounceOffsetRef.current.x = -curX;
        bounceOffsetRef.current.z = -curZ;
        bounceVelocityRef.current.x = 0;
        bounceVelocityRef.current.z = 0;
      }

      // Land check: if they were falling from sky and crossed back to ground
      if (bounceOffsetRef.current.y <= 0 && distFromCenter <= BLDG_R) {
        bounceOffsetRef.current.y = 0;
        bounceVelocityRef.current.y = 0;
      }
    } else {
      // On the ground: Check if we walked past the building radius
      if (distFromCenter > BLDG_R) {
        const inEntranceGap = candZ > 20.0 && Math.abs(candX) < 5.0;
        if (inEntranceGap) {
          // If walking beyond the south exit threshold, trigger a fall
          if (candZ > 32.5) {
            bounceOffsetRef.current.y = -0.01;
            bounceVelocityRef.current.y = 0;
          }
        } else {
          // Constrain position to inside the outer glass wall
          const overlap = distFromCenter - BLDG_R;
          const nx = candX / distFromCenter;
          const nz = candZ / distFromCenter;
          
          bounceOffsetRef.current.x -= nx * overlap;
          bounceOffsetRef.current.z -= nz * overlap;
          
          // Reflect / cancel velocity pointing outwards
          const vNormal = bounceVelocityRef.current.x * nx + bounceVelocityRef.current.z * nz;
          if (vNormal > 0) {
            const restitution = 0.4;
            bounceVelocityRef.current.x -= (1 + restitution) * vNormal * nx;
            bounceVelocityRef.current.z -= (1 + restitution) * vNormal * nz;
          }
        }
      }
    }

    // ── Collision and Slide Physics (Ground Only) ──
    const off = bounceOffsetRef.current;
    const vel = bounceVelocityRef.current;
    const agentRadius = 0.45; // slightly smaller than default 0.5 to allow smooth movement through narrow paths

    // Register position for agent-to-agent collisions (fast flat array lookup/update)
    let entry = sharedAgentPositions.get(currentAgent.id);
    if (!entry) {
      entry = { id: currentAgent.id, x: candX, z: candZ };
      sharedAgentPositions.set(currentAgent.id, entry);
      sharedAgentPositionsList.push(entry);
    } else {
      entry.x = candX;
      entry.z = candZ;
    }

    if (!inAir) {
      // Static furniture collision only applies while walking. Stationary
      // agents rest at hand-placed spots (chairs, couches, desk sides) that
      // intentionally overlap furniture collision margins — pushing them out
      // every frame made them fight the position spring and jitter against
      // tables instead of settling into their seat.
      if (currentIsWalking) {
        const col = getCollision(candX, candZ, agentRadius);
        if (col) {
          // 1. Resolve penetration immediately (push position out of obstacle)
          off.x += col.normal.x * col.penetration;
          off.z += col.normal.z * col.penetration;

          // 2. Slide physics: cancel velocity directed into the obstacle to prevent jitter
          const vNormal = vel.x * col.normal.x + vel.z * col.normal.z;
          if (vNormal < 0) {
            vel.x -= vNormal * col.normal.x;
            vel.z -= vNormal * col.normal.z;
          }
        }
      }

      // ── Agent vs Agent Collisions (Anti-Clump Repulsion) ──
      const minAgentDist = agentRadius * 2.0;   // hard separation (~0.9 units)
      const softRepelDist = agentRadius * 3.0;  // soft push range (~1.35 units)
      const softRepelDistSq = softRepelDist * softRepelDist;
      const minAgentDistSq = minAgentDist * minAgentDist;

      for (let i = 0; i < sharedAgentPositionsList.length; i++) {
        const otherPos = sharedAgentPositionsList[i];
        if (otherPos.id === currentAgent.id) continue;
        
        const dx = candX - otherPos.x;
        const dz = candZ - otherPos.z;
        const distSq = dx * dx + dz * dz;
        
        // Fast prune: bypass Math.sqrt for agents that are far apart
        if (distSq >= softRepelDistSq) continue;
        
        if (distSq < 0.000001) {
          // Exactly overlapping — push in a random direction based on ID
          off.x += 0.3;
          off.z += 0.2;
          continue;
        }

        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const nz = dz / dist;

        if (distSq < minAgentDistSq) {
          // Hard collision — immediate position correction
          const penetration = minAgentDist - dist;
          off.x += nx * penetration * 0.5;
          off.z += nz * penetration * 0.5;
          
          // Damp velocity pointing towards the other agent
          const vNormal = vel.x * nx + vel.z * nz;
          if (vNormal < 0) {
            vel.x -= vNormal * nx;
            vel.z -= vNormal * nz;
          }
        } else {
          // Soft repulsion — gentle continuous push to prevent gradual drift-in
          const strength = (1 - (dist - minAgentDist) / (softRepelDist - minAgentDist));
          const force = strength * strength * 2.0; // quadratic falloff with gentle force
          vel.x += nx * force * dt;
          vel.z += nz * force * dt;
        }
      }
    }

    // ── Idle Micro-Wander (only at lounging stations to look natural) ──
    const isLounging = currentAgent.station === 'lobby' || currentAgent.station === 'smoke_break';
    if (!currentIsWalking && !inAir && isLounging) {
      const wanderSpeed1 = 0.15 + (timeOffset % 0.1);
      const wanderSpeed2 = 0.12 + (timeOffset % 0.08);
      const wanderAmp = 0.35;
      const wx = Math.sin(t * wanderSpeed1) * Math.cos(t * wanderSpeed2 * 0.7) * wanderAmp;
      const wz = Math.cos(t * wanderSpeed2) * Math.sin(t * wanderSpeed1 * 0.6) * wanderAmp;
      const wanderK = dampK(0.12);
      off.x += (wx - off.x) * wanderK;
      off.z += (wz - off.z) * wanderK;

      // Keep the wander from walking a lounging agent into the furniture.
      // Their resting spot may legitimately overlap a couch or table (see the
      // note above), so only the *extra* penetration the wander introduced is
      // resolved — the seat itself is left exactly where it was placed.
      const restCol = getCollision(curX, curZ, agentRadius);
      const restPenetration = restCol ? restCol.penetration : 0;
      const wanderCol = getCollision(curX + off.x, curZ + off.z, agentRadius);
      if (wanderCol && wanderCol.penetration > restPenetration) {
        const excess = wanderCol.penetration - restPenetration;
        off.x += wanderCol.normal.x * excess;
        off.z += wanderCol.normal.z * excess;
      }
    }

    // 4. Spring restoring force pulling offset back to (0,0)
    // Dynamically reduce stiffness when crowded to prevent jitter
    let nearbyCount = 0;
    for (let i = 0; i < sharedAgentPositionsList.length; i++) {
      if (sharedAgentPositionsList[i].id === currentAgent.id) continue;
      const dx2 = candX - sharedAgentPositionsList[i].x;
      const dz2 = candZ - sharedAgentPositionsList[i].z;
      if (dx2 * dx2 + dz2 * dz2 < 4.0) nearbyCount++;
    }
    const stiffness = nearbyCount > 2 ? 6.0 : 15.0;
    const damping = 6.0;       // damping force (higher = less crazy bouncing)
    let forceX = 0;
    let forceZ = 0;

    if (inAir) {
      if (off.y > 0) {
        // Falling from sky: lock to center
        off.x = -curX;
        off.z = -curZ;
        vel.x = 0;
        vel.z = 0;
      } else {
        // Falling off building: drift with gravity, no spring force
        forceX = 0;
        forceZ = 0;
      }
    } else {
      // On the ground: normal spring force
      const clampedOffX = Math.max(-5.0, Math.min(5.0, off.x));
      const clampedOffZ = Math.max(-5.0, Math.min(5.0, off.z));
      forceX = -stiffness * clampedOffX - damping * vel.x;
      forceZ = -stiffness * clampedOffZ - damping * vel.z;
    }

    vel.x += forceX * dt;
    vel.z += forceZ * dt;

    // Cap velocity to prevent physics explosions
    const maxVel = 20.0;
    if (vel.x > maxVel) vel.x = maxVel;
    if (vel.x < -maxVel) vel.x = -maxVel;
    if (vel.z > maxVel) vel.z = maxVel;
    if (vel.z < -maxVel) vel.z = -maxVel;

    // Update position horizontally if on the ground or falling off the building
    if (!inAir || off.y < 0) {
      off.x += vel.x * dt;
      off.z += vel.z * dt;
    }

    // Apply resolved position to parent ref
    if (parentRef && parentRef.current) {
      parentRef.current.position.set(curX + off.x, off.y || 0, curZ + off.z);

      // Drive the kinematic rapier capsule to the agent's world position so
      // dynamic bodies (thrown papers, glass shards) collide with agents.
      if (colliderRef && colliderRef.current) {
        parentRef.current.getWorldPosition(_worldPos);
        colliderRef.current.setNextKinematicTranslation(_worldPos);
      }
    }

    // ── Facing interpolation ──
    if (currentIsWalking) {
      const dx = curX - prevNominalPosRef.current.x;
      const dz = curZ - prevNominalPosRef.current.z;
      if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - facingRef.current;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        facingRef.current += diff * dampK(10);
      }
    } else {
      let stationAngle = currentAgent.facing !== undefined
        ? currentAgent.facing
        : (STATION_FACING[currentAgent.station] || 0);

      // Turn to face a conversation/report target. Generalizes the old
      // debater-only face-off: any agent with an opponentId (debate) or a
      // `talkingTo` edge (set from the backend `data.target`, i.e. the agent it
      // reports to) orients toward that colleague while at station or speaking.
      const faceTargetId = currentAgent.opponentId || currentAgent.talkingTo;
      if (faceTargetId && (currentAgent.station === 'debate' || currentAgent.isSpeaking || currentAgent.gesture)) {
        const target = sharedAgentPositions.get(faceTargetId);
        if (target) {
          const dx = target.x - candX;
          const dz = target.z - candZ;
          stationAngle = Math.atan2(dx, dz);
        }
      }

      let diff = stationAngle - facingRef.current;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      facingRef.current += diff * dampK(10);
    }

    prevNominalPosRef.current = { x: curX, z: curZ };

    // ── Apply body position + rotation ──
    if (bodyRef && bodyRef.current) {
      bodyRef.current.rotation.order = 'YXZ';
      bodyRef.current.position.set(
        anim.body.position ? anim.body.position[0] : 0,
        anim.body.position ? anim.body.position[1] : 0,
        anim.body.position ? anim.body.position[2] : 0
      );
      bodyRef.current.rotation.set(
        anim.body.rotation[0],
        facingRef.current + anim.body.rotation[1],
        anim.body.rotation[2]
      );
    }

    // ── Limb lerping ──
    const lerpSpeed = dampK(17);
    const lerpLimb = (limbRef, targetRot, defaultPos, targetPos) => {
      if (limbRef && limbRef.current) {
        if (targetRot) {
          limbRef.current.rotation.x += (targetRot[0] - limbRef.current.rotation.x) * lerpSpeed;
          limbRef.current.rotation.y += (targetRot[1] - limbRef.current.rotation.y) * lerpSpeed;
          limbRef.current.rotation.z += (targetRot[2] - limbRef.current.rotation.z) * lerpSpeed;
        }
        const tPos = targetPos || defaultPos;
        if (tPos) {
          limbRef.current.position.x += (tPos[0] - limbRef.current.position.x) * lerpSpeed;
          limbRef.current.position.y += (tPos[1] - limbRef.current.position.y) * lerpSpeed;
          limbRef.current.position.z += (tPos[2] - limbRef.current.position.z) * lerpSpeed;
        }
      }
    };

    lerpLimb(leftArmRef, anim.leftArm.rotation, [-0.45, 0.5, 0], anim.leftArm.position);
    lerpLimb(rightArmRef, anim.rightArm.rotation, [0.45, 0.5, 0], anim.rightArm.position);
    lerpLimb(leftLegRef, anim.leftLeg.rotation, [-0.18, 0.05, 0], anim.leftLeg.position);
    lerpLimb(rightLegRef, anim.rightLeg.rotation, [0.18, 0.05, 0], anim.rightLeg.position);

    // ── Paper Throwing Logic ──
    const prevProp = prevPropRef.current;
    prevPropRef.current = anim.prop;

    if (currentAgent.station === 'research' && prevProp === 'document' && anim.prop === null
      && !gestureActive && !currentAgent.isSpeaking) {
      // Trigger throw if we just released the document prop!
      const throwSpeed = 5.0 + Math.random() * 2.0;
      const angle = facingRef.current + (Math.random() - 0.5) * 0.5;
      
      const velX = Math.sin(angle) * throwSpeed;
      const velZ = Math.cos(angle) * throwSpeed;
      const velY = 2.0 + Math.random() * 2.0;

      // Position: slightly in front of agent and up
      const pX = curX + off.x + Math.sin(facingRef.current) * 0.5;
      const pZ = curZ + off.z + Math.cos(facingRef.current) * 0.5;
      const pY = 1.2;

      throwPaper([pX, pY, pZ], [velX, velY, velZ]);
    }

    // ── Report hand-off — lob a sealed (cream) envelope toward the colleague
    // this agent reports to. Fired once per agent_done (handoffAt changes), and
    // aimed at the target's live position so it arcs across the office to them.
    if (currentAgent.handoffAt && currentAgent.handoffAt !== lastHandoffRef.current) {
      lastHandoffRef.current = currentAgent.handoffAt;
      const target = currentAgent.handoffTo && sharedAgentPositions.get(currentAgent.handoffTo);
      if (target) {
        const dx = target.x - curX;
        const dz = target.z - curZ;
        const dist = Math.hypot(dx, dz) || 1;
        const speed = Math.max(3, Math.min(dist * 2.2, 8));
        const velY = 2.4 + Math.random() * 0.6;
        const pX = curX + off.x + (dx / dist) * 0.4;
        const pZ = curZ + off.z + (dz / dist) * 0.4;
        throwPaper([pX, 0.95, pZ], [(dx / dist) * speed, velY, (dz / dist) * speed], { color: '#f5e6c8' });
      }
    }
  });

  // ── Determine active handheld prop ──
  const animProp = useMemo(() => {
    // Paperwork gestures (report/seal/present) keep their document/envelope in
    // hand; every other gesture and speech frees the hands — a talk/reaction
    // pose reads wrong with a sword or document welded to the hand.
    if (agent.gesture) return GESTURE_PROPS[agent.gesture] || null;
    if (agent.isSpeaking) return null;

    if (!isWorking && !isWalking && !isError && !isIdle) return null;

    // Janitor prop comes from the same variant the pose does, so the tool in
    // hand always matches the motion (broom/sweep, mop/mop, sponge/windows).
    if (isJanitorAgent(agent)) {
      return getAnimation('janitor', agent.animVariant || 0, 0).prop;
    }

    // Station-first overrides — these stations ALWAYS use their dedicated prop
    // regardless of what tool is active. This prevents debate tools from
    // falling through to the envelope check below.
    if (agent.station === 'debate') return 'sword';
    if (agent.station === 'smoke_break') return 'cigarette';
    // Janitor station — let animation variant pick broom/mop/sponge
    if (agent.station === 'janitor') {
      const anim = getAnimation('janitor', agent.animVariant || 0, 0);
      return anim.prop;
    }

    // Comm tools use envelope — only truly communication-oriented tools.
    // Debate tools (post_finding, read_team_findings, propose_constitution_amendment)
    // are handled by the station override above.
    const tool = agent.tool;
    if (tool) {
      const lower = tool.toLowerCase();
      if (lower.includes('investigation') || lower.includes('note')
        || tool === 'request_investigation' || tool === 'add_agent_note') {
        return 'envelope';
      }
    }
    const anim = getAnimation(agent.station, agent.animVariant || 0, 0);
    return anim.prop;
  }, [isWorking, isWalking, isError, isIdle, agent.tool, agent.station, agent.animVariant, agent.id, agent.gesture, agent.isSpeaking]);

  return { animProp };
}
