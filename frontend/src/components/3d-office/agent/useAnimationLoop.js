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

const BLDG_R = 31.5;
const AGENT_RADIUS = 0.45;

function computeAgentIdMetrics(agentId) {
  let h = 0;
  for (let i = 0; i < agentId.length; i++) h += agentId.charCodeAt(i);
  return { timeOffset: (h % 100) * 0.1, idHash: h };
}

function selectDebateAnimation(currentAgent, sharedT) {
  const beat = Math.floor(sharedT / 1.8) % 2;
  const leads = currentAgent.id < currentAgent.opponentId;
  const variant = (leads === (beat === 0)) ? 0 : 2;
  return getAnimation('debate', variant, sharedT);
}

function selectStationOrRoleAnimation(currentAgent, t, sharedT) {
  if (isJanitorAgent(currentAgent)) {
    return getAnimation('janitor', currentAgent.animVariant || 0, t);
  }
  if (currentAgent.station === 'debate' && currentAgent.opponentId) {
    return selectDebateAnimation(currentAgent, sharedT);
  }
  return getAnimation(currentAgent.station, currentAgent.animVariant || 0, t);
}

function isActiveStationState(state) {
  return state === AGENT_STATES.WORKING || state === AGENT_STATES.IDLE || state === AGENT_STATES.ERROR;
}

function selectAgentAnimation(currentAgent, t, sharedT, idHash, gestureActive) {
  if (currentAgent.state === AGENT_STATES.WALKING) return walkingAnim(t);
  if (gestureActive) return getGestureAnimation(currentAgent.gesture, t);
  if (currentAgent.isSpeaking) return getTalkingAnimation(idHash, t);
  if (isActiveStationState(currentAgent.state)) {
    return selectStationOrRoleAnimation(currentAgent, t, sharedT);
  }
  return getAnimation('lobby', 0, t);
}

function stepAirPhysics(curX, curZ, distFromCenter, off, vel, dt) {
  vel.y -= 25.0 * dt;
  off.y += vel.y * dt;

  if (off.y < -30) {
    off.x = -curX;
    off.z = -curZ;
    off.y = 15;
    vel.y = 0;
    vel.x = 0;
    vel.z = 0;
  } else if (off.y > 0) {
    off.x = -curX;
    off.z = -curZ;
    vel.x = 0;
    vel.z = 0;
  }

  if (off.y <= 0 && distFromCenter <= BLDG_R) {
    off.y = 0;
    vel.y = 0;
  }
}

function constrainToBuildingWall(candX, candZ, distFromCenter, off, vel) {
  if (distFromCenter <= BLDG_R) return;
  const inEntranceGap = candZ > 20.0 && Math.abs(candX) < 5.0;
  if (inEntranceGap) {
    if (candZ > 32.5) {
      off.y = -0.01;
      vel.y = 0;
    }
    return;
  }
  const overlap = distFromCenter - BLDG_R;
  const nx = candX / distFromCenter;
  const nz = candZ / distFromCenter;
  off.x -= nx * overlap;
  off.z -= nz * overlap;

  const vNormal = vel.x * nx + vel.z * nz;
  if (vNormal > 0) {
    const restitution = 0.4;
    vel.x -= (1 + restitution) * vNormal * nx;
    vel.z -= (1 + restitution) * vNormal * nz;
  }
}

function registerAgentPosition(agentId, candX, candZ) {
  let entry = sharedAgentPositions.get(agentId);
  if (!entry) {
    entry = { id: agentId, x: candX, z: candZ };
    sharedAgentPositions.set(agentId, entry);
    sharedAgentPositionsList.push(entry);
  } else {
    entry.x = candX;
    entry.z = candZ;
  }
}

function resolveFurnitureCollision(candX, candZ, off, vel) {
  const col = getCollision(candX, candZ, AGENT_RADIUS);
  if (!col) return;
  off.x += col.normal.x * col.penetration;
  off.z += col.normal.z * col.penetration;
  const vNormal = vel.x * col.normal.x + vel.z * col.normal.z;
  if (vNormal < 0) {
    vel.x -= vNormal * col.normal.x;
    vel.z -= vNormal * col.normal.z;
  }
}

function resolvePairRepulsion(candX, candZ, otherPos, off, vel, minDist, softDist, dt) {
  const dx = candX - otherPos.x;
  const dz = candZ - otherPos.z;
  const distSq = dx * dx + dz * dz;
  if (distSq >= softDist * softDist) return;
  if (distSq < 0.000001) {
    off.x += 0.3;
    off.z += 0.2;
    return;
  }
  const dist = Math.sqrt(distSq);
  const nx = dx / dist;
  const nz = dz / dist;
  if (distSq < minDist * minDist) {
    const penetration = minDist - dist;
    off.x += nx * penetration * 0.5;
    off.z += nz * penetration * 0.5;
    const vNormal = vel.x * nx + vel.z * nz;
    if (vNormal < 0) {
      vel.x -= vNormal * nx;
      vel.z -= vNormal * nz;
    }
  } else {
    const strength = 1 - (dist - minDist) / (softDist - minDist);
    const force = strength * strength * 2.0;
    vel.x += nx * force * dt;
    vel.z += nz * force * dt;
  }
}

function resolveAgentCollisions(agentId, isWalking, candX, candZ, off, vel, dt) {
  if (isWalking) {
    resolveFurnitureCollision(candX, candZ, off, vel);
  }
  const minAgentDist = AGENT_RADIUS * 2.0;
  const softRepelDist = AGENT_RADIUS * 3.0;
  for (let i = 0; i < sharedAgentPositionsList.length; i++) {
    const otherPos = sharedAgentPositionsList[i];
    if (otherPos.id !== agentId) {
      resolvePairRepulsion(candX, candZ, otherPos, off, vel, minAgentDist, softRepelDist, dt);
    }
  }
}

function applyLoungingWander(curX, curZ, off, t, timeOffset, wanderK) {
  const wanderSpeed1 = 0.15 + (timeOffset % 0.1);
  const wanderSpeed2 = 0.12 + (timeOffset % 0.08);
  const wanderAmp = 0.35;
  const wx = Math.sin(t * wanderSpeed1) * Math.cos(t * wanderSpeed2 * 0.7) * wanderAmp;
  const wz = Math.cos(t * wanderSpeed2) * Math.sin(t * wanderSpeed1 * 0.6) * wanderAmp;
  off.x += (wx - off.x) * wanderK;
  off.z += (wz - off.z) * wanderK;

  const restCol = getCollision(curX, curZ, AGENT_RADIUS);
  const restPenetration = restCol ? restCol.penetration : 0;
  const wanderCol = getCollision(curX + off.x, curZ + off.z, AGENT_RADIUS);
  if (wanderCol && wanderCol.penetration > restPenetration) {
    const excess = wanderCol.penetration - restPenetration;
    off.x += wanderCol.normal.x * excess;
    off.z += wanderCol.normal.z * excess;
  }
}

function countNearbyAgents(agentId, candX, candZ) {
  let nearbyCount = 0;
  for (let i = 0; i < sharedAgentPositionsList.length; i++) {
    if (sharedAgentPositionsList[i].id === agentId) continue;
    const dx2 = candX - sharedAgentPositionsList[i].x;
    const dz2 = candZ - sharedAgentPositionsList[i].z;
    if (dx2 * dx2 + dz2 * dz2 < 4.0) nearbyCount++;
  }
  return nearbyCount;
}

function clampVelocity(vel, maxVel) {
  if (vel.x > maxVel) vel.x = maxVel;
  if (vel.x < -maxVel) vel.x = -maxVel;
  if (vel.z > maxVel) vel.z = maxVel;
  if (vel.z < -maxVel) vel.z = -maxVel;
}

function stepSpringOffset(agentId, curX, curZ, candX, candZ, off, vel, inAir, dt) {
  const stiffness = countNearbyAgents(agentId, candX, candZ) > 2 ? 6.0 : 15.0;
  const damping = 6.0;
  let forceX = 0;
  let forceZ = 0;

  if (inAir) {
    if (off.y > 0) {
      off.x = -curX;
      off.z = -curZ;
      vel.x = 0;
      vel.z = 0;
    }
  } else {
    const clampedOffX = Math.max(-5.0, Math.min(5.0, off.x));
    const clampedOffZ = Math.max(-5.0, Math.min(5.0, off.z));
    forceX = -stiffness * clampedOffX - damping * vel.x;
    forceZ = -stiffness * clampedOffZ - damping * vel.z;
  }

  vel.x += forceX * dt;
  vel.z += forceZ * dt;
  clampVelocity(vel, 20.0);

  if (!inAir || off.y < 0) {
    off.x += vel.x * dt;
    off.z += vel.z * dt;
  }
}

function syncWorldTransform(parentRef, colliderRef, curX, curZ, off) {
  if (!parentRef || !parentRef.current) return;
  parentRef.current.position.set(curX + off.x, off.y || 0, curZ + off.z);
  if (colliderRef && colliderRef.current) {
    parentRef.current.getWorldPosition(_worldPos);
    colliderRef.current.setNextKinematicTranslation(_worldPos);
  }
}

function normalizeAngleDelta(targetAngle, currentAngle) {
  let diff = targetAngle - currentAngle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

function shouldFaceColleague(currentAgent) {
  return currentAgent.station === 'debate' || Boolean(currentAgent.isSpeaking) || Boolean(currentAgent.gesture);
}

function resolveStationTargetAngle(currentAgent, candX, candZ) {
  let stationAngle = currentAgent.facing !== undefined
    ? currentAgent.facing
    : (STATION_FACING[currentAgent.station] || 0);
  const faceTargetId = currentAgent.opponentId || currentAgent.talkingTo;
  if (faceTargetId && shouldFaceColleague(currentAgent)) {
    const target = sharedAgentPositions.get(faceTargetId);
    if (target) {
      stationAngle = Math.atan2(target.x - candX, target.z - candZ);
    }
  }
  return stationAngle;
}

function updateFacingAngle(currentAgent, isWalking, curX, curZ, candX, candZ, prevNominalPosRef, facingRef, turnK) {
  if (isWalking) {
    const dx = curX - prevNominalPosRef.current.x;
    const dz = curZ - prevNominalPosRef.current.z;
    if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
      facingRef.current += normalizeAngleDelta(Math.atan2(dx, dz), facingRef.current) * turnK;
    }
  } else {
    const stationAngle = resolveStationTargetAngle(currentAgent, candX, candZ);
    facingRef.current += normalizeAngleDelta(stationAngle, facingRef.current) * turnK;
  }
  prevNominalPosRef.current = { x: curX, z: curZ };
}

function lerpVector3Attr(vec3, target, lerpSpeed) {
  if (!target) return;
  vec3.x += (target[0] - vec3.x) * lerpSpeed;
  vec3.y += (target[1] - vec3.y) * lerpSpeed;
  vec3.z += (target[2] - vec3.z) * lerpSpeed;
}

function lerpSingleLimb(limbRef, limbAnim, defaultPos, lerpSpeed) {
  if (!limbRef || !limbRef.current) return;
  lerpVector3Attr(limbRef.current.rotation, limbAnim.rotation, lerpSpeed);
  lerpVector3Attr(limbRef.current.position, limbAnim.position || defaultPos, lerpSpeed);
}

function applyBodyAndLimbsTransform(currentRefs, anim, facing, lerpSpeed) {
  const { bodyRef, leftArmRef, rightArmRef, leftLegRef, rightLegRef } = currentRefs;
  if (bodyRef && bodyRef.current) {
    const bPos = anim.body.position || [0, 0, 0];
    bodyRef.current.rotation.order = 'YXZ';
    bodyRef.current.position.set(bPos[0], bPos[1], bPos[2]);
    bodyRef.current.rotation.set(anim.body.rotation[0], facing + anim.body.rotation[1], anim.body.rotation[2]);
  }
  lerpSingleLimb(leftArmRef, anim.leftArm, [-0.45, 0.5, 0], lerpSpeed);
  lerpSingleLimb(rightArmRef, anim.rightArm, [0.45, 0.5, 0], lerpSpeed);
  lerpSingleLimb(leftLegRef, anim.leftLeg, [-0.18, 0.05, 0], lerpSpeed);
  lerpSingleLimb(rightLegRef, anim.rightLeg, [0.18, 0.05, 0], lerpSpeed);
}

function maybeThrowResearchPaper(currentAgent, prevProp, nextProp, gestureActive, curX, curZ, off, facing) {
  if (currentAgent.station !== 'research' || prevProp !== 'document' || nextProp !== null) return;
  if (gestureActive || currentAgent.isSpeaking) return;
  const throwSpeed = 5.0 + Math.random() * 2.0;
  const angle = facing + (Math.random() - 0.5) * 0.5;
  const velX = Math.sin(angle) * throwSpeed;
  const velZ = Math.cos(angle) * throwSpeed;
  const velY = 2.0 + Math.random() * 2.0;
  const pX = curX + off.x + Math.sin(facing) * 0.5;
  const pZ = curZ + off.z + Math.cos(facing) * 0.5;
  throwPaper([pX, 1.2, pZ], [velX, velY, velZ]);
}

function maybeThrowHandoffEnvelope(currentAgent, lastHandoffRef, curX, curZ, off) {
  if (!currentAgent.handoffAt || currentAgent.handoffAt === lastHandoffRef.current) return;
  lastHandoffRef.current = currentAgent.handoffAt;
  const target = currentAgent.handoffTo ? sharedAgentPositions.get(currentAgent.handoffTo) : null;
  if (!target) return;
  const dx = target.x - curX;
  const dz = target.z - curZ;
  const dist = Math.hypot(dx, dz) || 1;
  const speed = Math.max(3, Math.min(dist * 2.2, 8));
  const velY = 2.4 + Math.random() * 0.6;
  const pX = curX + off.x + (dx / dist) * 0.4;
  const pZ = curZ + off.z + (dz / dist) * 0.4;
  throwPaper([pX, 0.95, pZ], [(dx / dist) * speed, velY, (dz / dist) * speed], { color: '#f5e6c8' });
}

function isCommTool(tool) {
  if (!tool) return false;
  const lower = tool.toLowerCase();
  return lower.includes('investigation') || lower.includes('note');
}

function resolveStationDedicatedProp(agent) {
  if (isJanitorAgent(agent) || agent.station === 'janitor') {
    return getAnimation('janitor', agent.animVariant || 0, 0).prop;
  }
  if (agent.station === 'debate') return 'sword';
  if (agent.station === 'smoke_break') return 'cigarette';
  return undefined;
}

function resolveAgentHandheldProp(agent, hasActiveState) {
  if (agent.gesture) return GESTURE_PROPS[agent.gesture] || null;
  if (agent.isSpeaking || !hasActiveState) return null;
  const dedicated = resolveStationDedicatedProp(agent);
  if (dedicated !== undefined) return dedicated;
  if (isCommTool(agent.tool)) return 'envelope';
  return getAnimation(agent.station, agent.animVariant || 0, 0).prop;
}

/**
 * @param {Object} agent — agent state from stateMachine
 * @param {Object} position — spring animated position { get: () => [x, y, z] }
 * @param {Object} refs — { parentRef, bodyRef, leftArmRef, rightArmRef, leftLegRef, rightLegRef }
 * @returns {{ animProp: string|null }} — the current handheld prop name
 */
export function useAnimationLoop(agent, position, refs) {
  const agentRef = useRef(agent);
  const refsRef = useRef(refs);

  useEffect(() => {
    agentRef.current = agent;
    refsRef.current = refs;
  });

  const isWalking = agent.state === AGENT_STATES.WALKING;
  const hasActiveState = isWalking || isActiveStationState(agent.state);

  const bounceOffsetRef = useRef({ x: 0, y: 0, z: 0 });
  const bounceVelocityRef = useRef({ x: 0, y: 0, z: 0 });
  const prevNominalPosRef = useRef({ x: agent.x || 0, z: agent.z || 0 });
  const facingRef = useRef(agent.facing !== undefined ? agent.facing : 0);
  const prevPropRef = useRef(null);
  const lastHandoffRef = useRef(0);

  const { timeOffset, idHash } = useMemo(() => computeAgentIdMetrics(agent.id), [agent.id]);

  useEffect(() => {
    return () => {
      sharedAgentPositions.delete(agent.id);
      const idx = sharedAgentPositionsList.findIndex(p => p.id === agent.id);
      if (idx !== -1) sharedAgentPositionsList.splice(idx, 1);
    };
  }, [agent.id]);

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
    const curPos = position.get();
    const curX = curPos[0];
    const curZ = curPos[2];
    if (isNaN(curX) || isNaN(curZ)) return;

    const currentIsWalking = currentAgent.state === AGENT_STATES.WALKING;
    const sharedT = state.clock.getElapsedTime();
    const t = sharedT + timeOffset;
    const gestureActive = Boolean(currentAgent.gesture && currentAgent.gestureUntil && Date.now() < currentAgent.gestureUntil);
    const anim = selectAgentAnimation(currentAgent, t, sharedT, idHash, gestureActive);

    const dt = Math.min(delta, 0.1);
    const dampK = (rate) => 1 - Math.exp(-rate * dt);
    const off = bounceOffsetRef.current;
    const vel = bounceVelocityRef.current;
    const candX = curX + off.x;
    const candZ = curZ + off.z;
    const distFromCenter = Math.hypot(candX, candZ);
    const inAir = Boolean(off.y);

    if (inAir) {
      stepAirPhysics(curX, curZ, distFromCenter, off, vel, dt);
    } else {
      constrainToBuildingWall(candX, candZ, distFromCenter, off, vel);
      resolveAgentCollisions(currentAgent.id, currentIsWalking, candX, candZ, off, vel, dt);
    }
    registerAgentPosition(currentAgent.id, candX, candZ);

    const isLounging = currentAgent.station === 'lobby' || currentAgent.station === 'smoke_break';
    if (!currentIsWalking && !inAir && isLounging) {
      applyLoungingWander(curX, curZ, off, t, timeOffset, dampK(0.12));
    }

    stepSpringOffset(currentAgent.id, curX, curZ, candX, candZ, off, vel, inAir, dt);
    syncWorldTransform(currentRefs.parentRef, currentRefs.colliderRef, curX, curZ, off);
    updateFacingAngle(currentAgent, currentIsWalking, curX, curZ, candX, candZ, prevNominalPosRef, facingRef, dampK(10));
    applyBodyAndLimbsTransform(currentRefs, anim, facingRef.current, dampK(17));

    const prevProp = prevPropRef.current;
    prevPropRef.current = anim.prop;
    maybeThrowResearchPaper(currentAgent, prevProp, anim.prop, gestureActive, curX, curZ, off, facingRef.current);
    maybeThrowHandoffEnvelope(currentAgent, lastHandoffRef, curX, curZ, off);
  });

  const animProp = useMemo(
    () => resolveAgentHandheldProp(agent, hasActiveState),
    [hasActiveState, agent.tool, agent.station, agent.animVariant, agent.id, agent.gesture, agent.isSpeaking]
  );

  return { animProp };
}
