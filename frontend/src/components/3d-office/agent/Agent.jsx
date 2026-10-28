/**
 * Agent.jsx — Thin wrapper that composes animation loop + visual rig.
 * /lego module: Delegates all animation logic to useAnimationLoop,
 * all rendering to AgentVisualRig.
 *
 * Waypoint support: when agent.waypoints is set, the spring target
 * cycles through each waypoint before reaching the final destination.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useSpring } from '@react-spring/three';
import { useFrame } from '@react-three/fiber';
import { AGENT_STATES } from '../routing/stateMachine';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import { soundManager } from '../SoundManager';
import { AgentVisualRig } from './AgentVisualRig';
import { useAnimationLoop } from './useAnimationLoop';

function resolveNominalCoord(targetVal, fallbackVal) {
  return targetVal !== undefined ? targetVal : (fallbackVal || 0);
}

function computeAgentSpringTarget(agent, isFired, isWalking, waypoints, wpIndex) {
  if (agent._dragOverride) {
    return [agent._dragX, 0.5, agent._dragZ];
  }
  const tx = resolveNominalCoord(agent.targetX, agent.x);
  const tz = resolveNominalCoord(agent.targetZ, agent.z);
  if (isFired) {
    return [tx, -50, tz - 5];
  }
  if (isWalking && waypoints.length > 0 && wpIndex < waypoints.length) {
    const wp = waypoints[wpIndex];
    return [wp[0], 0, wp[1]];
  }
  return [tx, 0, tz];
}

function computeAgentSpringConfig(dragOverride, isFired, isWalking) {
  if (dragOverride) return { mass: 0.5, tension: 300, friction: 20 };
  if (isFired) return { mass: 2, tension: 15.0, friction: 5.0 };
  if (isWalking) return { mass: 1, tension: 35.0, friction: 15.0 };
  return { mass: 1, tension: 6.0, friction: 8.0 };
}

function stepAgentWaypointFrame(walkState, cur, setWpIndex) {
  const { isWalking, waypoints, wpIndex, targetX, targetZ, x, z, id, onArrive } = walkState;
  if (!isWalking) return;
  if (waypoints.length > 0 && wpIndex < waypoints.length) {
    const wp = waypoints[wpIndex];
    const dx = cur[0] - wp[0];
    const dz = cur[2] - wp[1];
    if (dx * dx + dz * dz < 1.0) {
      setWpIndex(i => Math.min(i + 1, waypoints.length));
    }
    return;
  }
  const tx = resolveNominalCoord(targetX, x);
  const tz = resolveNominalCoord(targetZ, z);
  const dx = cur[0] - tx;
  const dz = cur[2] - tz;
  if (dx * dx + dz * dz < 0.25 && onArrive) {
    onArrive(id);
  }
}

function isLoungeStation(station) {
  return station === 'lobby' || station === 'smoke_break';
}

function shouldShowAgentToolBadge(agent, isWorking, isError, isWalking) {
  const isAtLounge = isLoungeStation(agent.station) && (!isWalking || isLoungeStation(agent.targetStation));
  return Boolean((isWorking || isError || isWalking) && !isAtLounge && agent.tool);
}

function computeSmokeIntensity(station, lastActionTime, isWorking, isWalking) {
  if (station === 'smoke_break') return 1.0;
  if (station === 'lobby' || (!isWorking && !isWalking)) return 0.1;
  const elapsed = (Date.now() - (lastActionTime || 0)) / 1000;
  if (elapsed < 3) return 0.9;
  if (elapsed < 10) return 0.6;
  if (elapsed < 20) return 0.4;
  return 0.2;
}

export function Agent({ agent, isSelected, onSelect, onArrive, onStartDrag, isDragTarget }) {
  const isWorking = agent.state === AGENT_STATES.WORKING;
  const isWalking = agent.state === AGENT_STATES.WALKING;
  const isError = agent.state === AGENT_STATES.ERROR;
  const isSpawning = agent.state === AGENT_STATES.SPAWNING;
  const isExiting = agent.state === AGENT_STATES.EXITING;
  const isFired = agent.state === AGENT_STATES.FIRED;

  const waypoints = useMemo(() => agent.waypoints || [], [agent.waypoints]);
  const [wpIndex, setWpIndex] = useState(0);

  const wpKey = useMemo(() => waypoints.length + '-' + (agent.targetX || 0).toFixed(1), [waypoints.length, agent.targetX]);
  useEffect(() => { setWpIndex(0); }, [wpKey]);

  const currentTarget = useMemo(
    () => computeAgentSpringTarget(agent, isFired, isWalking, waypoints, wpIndex),
    [isFired, isWalking, waypoints, wpIndex, agent.targetX, agent.targetZ, agent.x, agent.z, agent._dragOverride, agent._dragX, agent._dragZ]
  );

  const springConfig = useMemo(
    () => computeAgentSpringConfig(agent._dragOverride, isFired, isWalking),
    [isWalking, isFired, agent._dragOverride]
  );

  const { position } = useSpring({
    position: currentTarget,
    config: springConfig,
    onChange: () => {
      if (isWalking && Math.random() < 0.02) soundManager.playStep();
    },
  });

  const walkStateRef = useRef(null);
  walkStateRef.current = {
    isWalking,
    waypoints,
    wpIndex,
    targetX: agent.targetX,
    targetZ: agent.targetZ,
    x: agent.x,
    z: agent.z,
    id: agent.id,
    onArrive,
  };

  useFrame(() => {
    stepAgentWaypointFrame(walkStateRef.current, position.get(), setWpIndex);
  });

  const { bodyScale } = useSpring({
    from: { bodyScale: isSpawning ? 0 : 1 },
    to: { bodyScale: isExiting ? 0 : 1 },
    config: { mass: 1, tension: 300, friction: 20 },
  });

  useEffect(() => {
    if (isWorking) soundManager.playPop();
  }, [isWorking]);

  const parentRef = useRef();
  const bodyRef = useRef();
  const leftLegRef = useRef();
  const rightLegRef = useRef();
  const leftArmRef = useRef();
  const rightArmRef = useRef();
  const colliderRef = useRef(null);

  const { animProp } = useAnimationLoop(agent, position, {
    parentRef, bodyRef, leftArmRef, rightArmRef, leftLegRef, rightLegRef, colliderRef,
  });

  const showToolBadge = shouldShowAgentToolBadge(agent, isWorking, isError, isWalking);
  const smokeIntensity = useMemo(
    () => computeSmokeIntensity(agent.station, agent.lastActionTime, isWorking, isWalking),
    [agent.station, agent.lastActionTime, isWorking, isWalking]
  );

  useEffect(() => {
    if (isFired) {
      soundManager.playPop();
      window.dispatchEvent(new CustomEvent('break-window'));
    }
  }, [isFired]);

  return (
    <>
      {!isExiting && !isFired && (
        <RigidBody ref={colliderRef} type="kinematicPosition" colliders={false}>
          <CapsuleCollider args={[0.4, 0.35]} position={[0, 0.75, 0]} />
        </RigidBody>
      )}
      <AgentVisualRig
        agent={agent}
        isSelected={isSelected}
        onSelect={onSelect}
        onStartDrag={onStartDrag}
        isDragTarget={isDragTarget}
        isExiting={isExiting}
        isError={isError}
        showToolBadge={showToolBadge}
        animProp={animProp}
        smokeIntensity={smokeIntensity}
        parentRef={parentRef}
        bodyScale={bodyScale}
        bodyRef={bodyRef}
        leftArmRef={leftArmRef}
        rightArmRef={rightArmRef}
        leftLegRef={leftLegRef}
        rightLegRef={rightLegRef}
      />
    </>
  );
}
