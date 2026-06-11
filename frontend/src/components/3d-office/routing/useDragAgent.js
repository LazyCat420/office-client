/**
 * useDragAgent.js
 *
 * Custom React hook that manages the 3D drag lifecycle for agent reassignment.
 *
 * Interaction flow:
 * 1. User pointerDown on an agent mesh → disable MapControls, set isDragging
 * 2. User moves pointer → project ray onto Y=0.8 plane, update drag position
 * 3. User pointerUp → find nearest room, validate constraints, dispatch override
 *
 * Visual feedback:
 * - Agent lifts 0.5 units on Y during drag
 * - Nearest room is highlighted (via nearestRoom state)
 * - Invalid drops show reason (via dropError state)
 */

import { useCallback, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { STATIONS } from './stateMachine';
import { canMoveAgent } from './roomConstraints';

// Rooms that are valid drop targets (excludes exit_door, window, janitor)
const DROP_TARGET_ROOMS = [
  'lobby', 'research', 'desk', 'debate', 'inbox',
  'error', 'tool_bench', 'smoke_break',
];

// Pre-compute room centers for distance checks
const ROOM_CENTERS = {};
for (const roomId of DROP_TARGET_ROOMS) {
  const s = STATIONS[roomId];
  if (s) {
    ROOM_CENTERS[roomId] = new THREE.Vector3(s.x, 0, s.z);
  }
}

// Ground plane for raycasting during drag (Y = 0.8 — agent hovers above floor)
const DRAG_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.8);

/**
 * @param {object} options
 * @param {object} options.agents - Current agents map
 * @param {function} options.onDropAgent - Callback(agentId, fromRoom, toRoom) when agent is dropped
 * @param {React.MutableRefObject} options.controlsRef - Ref to MapControls for disabling
 * @returns {object} Drag state and handlers
 */
export function useDragAgent({ agents, onDropAgent, controlsRef }) {
  const { camera, raycaster, pointer } = useThree();

  const [isDragging, setIsDragging] = useState(false);
  const [draggedAgentId, setDraggedAgentId] = useState(null);
  const [dragPosition, setDragPosition] = useState(null);
  const [nearestRoom, setNearestRoom] = useState(null);
  const [dropAllowed, setDropAllowed] = useState(true);
  const [dropError, setDropError] = useState(null);

  // Refs to avoid stale closures
  const dragStateRef = useRef({
    agentId: null,
    originalPosition: null,
    originalStation: null,
  });

  const intersectPoint = useRef(new THREE.Vector3());

  /**
   * Start dragging an agent.
   * Called from the agent mesh's onPointerDown.
   */
  const startDrag = useCallback((agentId, event) => {
    if (!agentId || !agents[agentId]) return;

    // Prevent the event from reaching MapControls
    event.stopPropagation();

    const agent = agents[agentId];
    const fromRoom = agent.targetStation || agent.station;

    dragStateRef.current = {
      agentId,
      originalPosition: { x: agent.x || agent.targetX, z: agent.z || agent.targetZ },
      originalStation: fromRoom,
    };

    setDraggedAgentId(agentId);
    setIsDragging(true);
    setDropError(null);

    // Disable MapControls during drag
    if (controlsRef?.current) {
      controlsRef.current.enabled = false;
    }

    // Set initial drag position
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(DRAG_PLANE, intersectPoint.current)) {
      setDragPosition({
        x: intersectPoint.current.x,
        z: intersectPoint.current.z,
      });
    }
  }, [agents, camera, raycaster, pointer, controlsRef]);

  /**
   * Update drag position as pointer moves.
   * Called from the canvas's onPointerMove.
   */
  const updateDrag = useCallback((event) => {
    if (!isDragging || !draggedAgentId) return;

    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(DRAG_PLANE, intersectPoint.current)) {
      const pos = {
        x: intersectPoint.current.x,
        z: intersectPoint.current.z,
      };
      setDragPosition(pos);

      // Find nearest room
      let minDist = Infinity;
      let nearest = null;
      const dragVec = new THREE.Vector3(pos.x, 0, pos.z);

      for (const roomId of DROP_TARGET_ROOMS) {
        const center = ROOM_CENTERS[roomId];
        if (!center) continue;
        const dist = dragVec.distanceTo(center);
        if (dist < minDist) {
          minDist = dist;
          nearest = roomId;
        }
      }

      setNearestRoom(nearest);

      // Check constraints
      if (nearest) {
        const fromRoom = dragStateRef.current.originalStation;
        const result = canMoveAgent(
          draggedAgentId,
          fromRoom,
          nearest,
          agents
        );
        setDropAllowed(result.allowed);
        setDropError(result.allowed ? null : result.reason);
      }
    }
  }, [isDragging, draggedAgentId, camera, raycaster, pointer, agents]);

  /**
   * End the drag — drop agent into nearest room or snap back.
   * Called from the canvas's onPointerUp.
   */
  const endDrag = useCallback(() => {
    if (!isDragging || !draggedAgentId) return;

    const fromRoom = dragStateRef.current.originalStation;

    // Re-enable MapControls
    if (controlsRef?.current) {
      controlsRef.current.enabled = true;
    }

    if (nearestRoom && dropAllowed && nearestRoom !== fromRoom) {
      // Valid drop — dispatch the override
      if (onDropAgent) {
        onDropAgent(draggedAgentId, fromRoom, nearestRoom);
      }
    }
    // If not allowed or same room, the agent just snaps back (no action)

    // Reset all drag state
    setIsDragging(false);
    setDraggedAgentId(null);
    setDragPosition(null);
    setNearestRoom(null);
    setDropAllowed(true);
    setDropError(null);
    dragStateRef.current = {
      agentId: null,
      originalPosition: null,
      originalStation: null,
    };
  }, [isDragging, draggedAgentId, nearestRoom, dropAllowed, controlsRef, onDropAgent]);

  /**
   * Cancel drag (e.g., Escape key or pointer leaving canvas).
   */
  const cancelDrag = useCallback(() => {
    if (!isDragging) return;

    if (controlsRef?.current) {
      controlsRef.current.enabled = true;
    }

    setIsDragging(false);
    setDraggedAgentId(null);
    setDragPosition(null);
    setNearestRoom(null);
    setDropAllowed(true);
    setDropError(null);
    dragStateRef.current = {
      agentId: null,
      originalPosition: null,
      originalStation: null,
    };
  }, [isDragging, controlsRef]);

  return {
    // State
    isDragging,
    draggedAgentId,
    dragPosition,
    nearestRoom,
    dropAllowed,
    dropError,
    // Handlers
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
  };
}

export { DROP_TARGET_ROOMS, ROOM_CENTERS };
