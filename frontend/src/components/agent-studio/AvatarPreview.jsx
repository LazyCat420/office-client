import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { AgentVisualRig } from '../3d-office/agent/AgentVisualRig';

function SpinningRig({ agentConfig }) {
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

export default function AvatarPreview({ form }) {
  return (
    <div className="agent-studio__avatar-preview" style={{ 
      width: '100%', 
      height: '350px', 
      borderRadius: '16px',
      background: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)',
      position: 'relative',
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.1)',
      marginBottom: '1.5rem',
      boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
    }}>
      <Canvas shadows camera={{ position: [0, 1, 4], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight 
          position={[5, 5, 5]} 
          intensity={1} 
          castShadow 
          shadow-mapSize-width={1024} 
          shadow-mapSize-height={1024} 
        />
        <directionalLight position={[-5, 5, -5]} intensity={0.3} />
        
        <SpinningRig agentConfig={form} />
        
        <ContactShadows 
          position={[0, -1.2, 0]} 
          opacity={0.6} 
          scale={5} 
          blur={2} 
          far={2} 
        />
        
        <OrbitControls 
          enablePan={false} 
          enableZoom={true} 
          minDistance={2} 
          maxDistance={6}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>
      <div style={{
        position: 'absolute',
        bottom: '12px',
        width: '100%',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.4)',
        fontSize: '0.7rem',
        pointerEvents: 'none',
        textTransform: 'uppercase',
        letterSpacing: '1px'
      }}>
        Drag to rotate • Scroll to zoom
      </div>
    </div>
  );
}
