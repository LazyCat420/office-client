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
import { STATION_FACING } from '../animations';
import { soundManager } from '../SoundManager';
import { AgentVisualRig } from './AgentVisualRig';
import { useAnimationLoop } from './useAnimationLoop';

export function Agent({ agent, isSelected, onSelect, onArrive }) {
  const isWorking = agent.state === AGENT_STATES.WORKING;
  const isWalking = agent.state === AGENT_STATES.WALKING;
  const isError = agent.state === AGENT_STATES.ERROR;
  const isSpawning = agent.state === AGENT_STATES.SPAWNING;
  const isExiting = agent.state === AGENT_STATES.EXITING;

  // ── Waypoint tracking ──
  const waypoints = useMemo(() => agent.waypoints || [], [agent.waypoints]);
  const [wpIndex, setWpIndex] = useState(0);

  // Reset waypoint index when agent gets new waypoints
  const wpKey = useMemo(() => waypoints.length + '-' + (agent.targetX || 0).toFixed(1), [waypoints.length, agent.targetX]);
  useEffect(() => { setWpIndex(0); }, [wpKey]);

  // Determine current spring target (next waypoint or final destination)
  const currentTarget = useMemo(() => {
    if (isWalking && waypoints.length > 0 && wpIndex < waypoints.length) {
      const wp = waypoints[wpIndex];
      return [wp[0], 0, wp[1]];
    }
    return [
      agent.targetX !== undefined ? agent.targetX : (agent.x || 0),
      0,
      agent.targetZ !== undefined ? agent.targetZ : (agent.z || 0),
    ];
  }, [isWalking, waypoints, wpIndex, agent.targetX, agent.targetZ, agent.x, agent.z]);

  const springConfig = useMemo(() => {
    if (isWalking) {
      return { mass: 1, tension: 35.0, friction: 15.0 };
    }
    return { mass: 1, tension: 6.0, friction: 8.0 };
  }, [isWalking]);

  // ── Spring: smooth position interpolation ──
  const { position } = useSpring({
    position: currentTarget,
    config: springConfig,
    onChange: () => {
      if (isWalking && Math.random() < 0.02) soundManager.playStep();
    },
  });

  // ── Ref for waypoint state to prevent stale closures in useFrame ──
  const walkStateRef = useRef({
    isWalking,
    waypoints,
    wpIndex,
    targetX: agent.targetX,
    targetZ: agent.targetZ,
    x: agent.x,
    z: agent.z,
    id: agent.id,
    onArrive
  });
  walkStateRef.current = {
    isWalking,
    waypoints,
    wpIndex,
    targetX: agent.targetX,
    targetZ: agent.targetZ,
    x: agent.x,
    z: agent.z,
    id: agent.id,
    onArrive
  };

  // ── Advance waypoint when close enough or trigger arrival ──
  useFrame(() => {
    const { isWalking, waypoints, wpIndex, targetX, targetZ, x, z, id, onArrive } = walkStateRef.current;
    if (!isWalking) return;
    const cur = position.get();

    if (waypoints.length > 0 && wpIndex < waypoints.length) {
      const wp = waypoints[wpIndex];
      const dx = cur[0] - wp[0];
      const dz = cur[2] - wp[1];
      if (dx * dx + dz * dz < 1.0) { // within 1 unit
        setWpIndex(i => Math.min(i + 1, waypoints.length));
      }
    } else {
      // Check distance to final destination slot
      const tx = targetX !== undefined ? targetX : (x || 0);
      const tz = targetZ !== undefined ? targetZ : (z || 0);
      const dx = cur[0] - tx;
      const dz = cur[2] - tz;
      if (dx * dx + dz * dz < 0.25) { // within 0.5 units
        if (onArrive) {
          onArrive(id);
        }
      }
    }
  });

  // ── Spring: spawn/exit scale ──
  const { bodyScale } = useSpring({
    from: { bodyScale: isSpawning ? 0 : 1 },
    to: { bodyScale: isExiting ? 0 : 1 },
    config: { mass: 1, tension: 300, friction: 20 },
  });

  useEffect(() => {
    if (isWorking) soundManager.playPop();
  }, [isWorking]);

  // ── Bone refs ──
  const parentRef = useRef();
  const bodyRef = useRef();
  const leftLegRef = useRef();
  const rightLegRef = useRef();
  const leftArmRef = useRef();
  const rightArmRef = useRef();

  // ── Animation loop (delegated) ──
  const { animProp } = useAnimationLoop(agent, position, {
    parentRef, bodyRef, leftArmRef, rightArmRef, leftLegRef, rightLegRef,
  });

  const isAtLounge = (agent.station === 'lobby' || agent.station === 'smoke_break') && (!isWalking || agent.targetStation === 'lobby' || agent.targetStation === 'smoke_break');
  const showToolBadge = (isWorking || isError || isWalking) && !isAtLounge && agent.tool;

  // ── Compute smoke intensity based on agent workload ──
  // Busy working agents produce thick smoke, idle agents have wispy trails
  const smokeIntensity = useMemo(() => {
    if (agent.station === 'smoke_break') return 1.0;  // full smoke break — big clouds
    if (agent.station === 'lobby') return 0.1;         // barely lit
    if (!isWorking && !isWalking) return 0.1;          // idle
    // Working stations — intensity based on how recently agent acted
    const elapsed = (Date.now() - (agent.lastActionTime || 0)) / 1000;
    if (elapsed < 3) return 0.9;   // just did something — heavy stress smoke
    if (elapsed < 10) return 0.6;  // actively working
    if (elapsed < 20) return 0.4;  // moderate
    return 0.2;                    // been a while, calming down
  }, [agent.station, agent.lastActionTime, isWorking, isWalking]);

  return (
    <AgentVisualRig
      agent={agent}
      isSelected={isSelected}
      onSelect={onSelect}
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
  );
}
