'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AgentVisualRig } from './AgentVisualRig';

export default function OfficeSpinningRig({ agentConfig }) {
  const groupRef = useRef();

  // Slowly rotate the agent on the Y axis
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5;
    }
  });

  // Convert the flat form data into an agent object that AgentVisualRig expects
  const rigAgent = useMemo(() => ({
    id: 'Preview',
    color: agentConfig.avatar_config?.outfit_color || '#3b82f6',
    avatar_config: agentConfig.avatar_config || {},
    tool: '',
    state: 'idle',
    pose: 'stand',
  }), [agentConfig]);

  return (
    <group ref={groupRef} position={[0, -1.2, 0]}>
      <AgentVisualRig
        agent={rigAgent}
        isSelected={false}
        isExiting={false}
        showToolBadge={false}
        bodyScale={1.5}
      />
    </group>
  );
}
