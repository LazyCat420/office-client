import React, { useRef, useMemo, useState } from 'react';
import { animated } from '@react-spring/three';
import { useFrame } from '@react-three/fiber';
import { ToolEmoji } from './ToolEmoji';
import { HandheldProp } from './HandheldProps';
import { Html } from '@react-three/drei';
import { ProceduralHat, FACE_Y, FACE_Z, EYE_X } from './ProceduralHats';
import { normalizeAccessories } from './avatarConfig';

function resolveAvatarColors(ac, fallbackColor) {
  return {
    body: ac?.outfit_color || fallbackColor,
    legs: ac?.accent_color || fallbackColor,
    skin: ac?.skin_color || null,
    hair: ac?.hair_color || null,
  };
}

const BUBBLE_TYPE_PRESETS = {
  thinking: {
    borderColor: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.25)',
    headerText: '💭 Thinking',
    headerColor: '#f59e0b',
  },
  error: {
    borderColor: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.25)',
    headerText: '⚠️ Error',
    headerColor: '#ef4444',
  },
  success: {
    borderColor: '#10b981',
    glowColor: 'rgba(16, 185, 129, 0.25)',
    headerText: '✨ Success',
    headerColor: '#10b981',
  },
};

function computeBubbleStyles(bubble, bubbleType, agentColor) {
  if (!bubble) return null;
  const type = bubbleType || 'info';
  const color = agentColor || '#818cf8';
  if (type === 'voice') {
    return {
      borderColor: color,
      glowColor: `${color}44`,
      headerText: '🔊 Speaking',
      headerColor: color,
    };
  }
  return BUBBLE_TYPE_PRESETS[type] || {
    borderColor: 'rgba(255, 255, 255, 0.15)',
    glowColor: 'rgba(0, 0, 0, 0.3)',
    headerText: 'ℹ️ Info',
    headerColor: '#cbd5e1',
  };
}

function AgentSpeechBubble({ bubble, isSpeaking, bubbleStyles, isExiting }) {
  if (!bubble || !bubbleStyles) return null;
  return (
    <Html position={[0, 1.85, 0]} center style={{ pointerEvents: 'none', transition: 'opacity 0.3s', opacity: isExiting ? 0 : 1 }}>
      <div style={{
        position: 'relative',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(8px)',
        border: `1px solid ${bubbleStyles.borderColor}`,
        boxShadow: `0 4px 20px rgba(0, 0, 0, 0.5), 0 0 10px ${bubbleStyles.glowColor}`,
        padding: '8px 12px',
        borderRadius: '12px',
        color: '#f8fafc',
        fontSize: '11px',
        fontWeight: '500',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '180px',
        minWidth: '120px',
        textAlign: 'center',
        wordBreak: 'break-word',
        animation: 'agent-bubble-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        transformOrigin: 'bottom center',
        zIndex: 1000,
      }}>
        <div style={{
          position: 'absolute',
          bottom: '-5px',
          left: '50%',
          transform: 'translateX(-50%) rotate(45deg)',
          width: '8px',
          height: '8px',
          background: 'rgba(15, 23, 42, 0.95)',
          borderRight: `1px solid ${bubbleStyles.borderColor}`,
          borderBottom: `1px solid ${bubbleStyles.borderColor}`,
        }} />
        <div style={{
          fontSize: '8px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: bubbleStyles.headerColor,
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
        }}>
          {bubbleStyles.headerText}
        </div>
        <div style={{ lineHeight: '1.4' }}>
          {bubble}
          {isSpeaking && (
            <span style={{
              animation: 'agent-cursor-blink 1s step-end infinite',
              marginLeft: '2px',
              fontWeight: 'bold',
              color: bubbleStyles.headerColor,
            }}>_</span>
          )}
        </div>
      </div>
    </Html>
  );
}

function AgentHoverBadge({ agentId, agentColor, isSelected, isExiting, onSelect }) {
  const color = agentColor || '#818cf8';
  return (
    <Html position={[0, 1.55, 0]} center style={{ pointerEvents: 'auto', transition: 'opacity 0.3s', opacity: isExiting ? 0 : 1 }}>
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (onSelect) onSelect(agentId);
        }}
        style={{
          color: isSelected ? '#ffffff' : '#cbd5e1',
          background: isSelected ? color : 'rgba(15, 23, 42, 0.9)',
          border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.15)',
          padding: '3px 8px',
          borderRadius: '12px',
          fontSize: '9px',
          fontWeight: '700',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          letterSpacing: '0.8px',
          boxShadow: isSelected ? `0 0 10px ${color}` : '0 2px 8px rgba(0,0,0,0.3)',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
        }}
      >
        {agentId}
      </div>
    </Html>
  );
}

function SingleAgentEye({ side, hasGlasses, isError }) {
  const eyeRadius = hasGlasses ? 0.085 : 0.05;
  const eyeZ = FACE_Z + (hasGlasses ? 0.04 : 0.05);
  return (
    <group position={[side * EYE_X, FACE_Y, eyeZ]}>
      {hasGlasses && (
        <mesh position={[0, 0, -0.001]}>
          <circleGeometry args={[eyeRadius + 0.015, 24]} />
          <meshBasicMaterial color="#ddd" />
        </mesh>
      )}
      <mesh>
        <circleGeometry args={[eyeRadius, hasGlasses ? 24 : 16]} />
        <meshBasicMaterial color={isError ? '#ef4444' : '#fff'} />
      </mesh>
      {hasGlasses && (
        <mesh position={[0, 0, 0.001]}>
          <circleGeometry args={[eyeRadius * 0.45, 16]} />
          <meshBasicMaterial color="#222" />
        </mesh>
      )}
    </group>
  );
}

function AgentVisorAndEyes({ hasGlasses, isError }) {
  return (
    <>
      <mesh position={[0, FACE_Y, FACE_Z - 0.05]}>
        <boxGeometry args={[0.6, 0.3, 0.2]} />
        <meshStandardMaterial color="#111" roughness={0.2} metalness={0.8} />
      </mesh>
      <SingleAgentEye side={-1} hasGlasses={hasGlasses} isError={isError} />
      <SingleAgentEye side={1} hasGlasses={hasGlasses} isError={isError} />
    </>
  );
}

const LEFT_HAND_PROPS = new Set(['document', 'magnifyingGlass']);
const RIGHT_HAND_PROPS = new Set(['hammer', 'phone', 'envelope', 'cigarette', 'broom', 'mop', 'sponge', 'sword']);

function AgentArmBone({ armRef, xPos, activeProp, smokeIntensity }) {
  return (
    <group position={[xPos, 0.5, 0]} ref={armRef}>
      <mesh position={[0, -0.125, 0]}>
        <capsuleGeometry args={[0.03, 0.25, 4, 8]} />
        <meshStandardMaterial color="#111" roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.04, 0.02, 8, 16]} />
        <meshStandardMaterial color="#fff" roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.3, 0]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial color="#fff" roughness={0.8} />
      </mesh>
      {activeProp && (
        <HandheldProp
          type={activeProp}
          smokeIntensity={activeProp === 'cigarette' ? smokeIntensity : undefined}
        />
      )}
    </group>
  );
}

function AgentLegBone({ legRef, xPos, legsColor }) {
  return (
    <group position={[xPos, 0.05, 0]} ref={legRef}>
      <mesh position={[0, -0.25, 0]}>
        <capsuleGeometry args={[0.06, 0.3, 4, 8]} />
        <meshStandardMaterial color={legsColor} roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.47, 0.06]}>
        <boxGeometry args={[0.12, 0.08, 0.18]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} />
      </mesh>
    </group>
  );
}

export function AgentVisualRig({
  agent,
  isSelected,
  onSelect,
  onStartDrag,
  isDragTarget,
  isExiting,
  isError,
  showToolBadge,
  animProp,
  smokeIntensity = 0.3,
  parentRef,
  bodyScale,
  bodyRef,
  leftArmRef,
  rightArmRef,
  leftLegRef,
  rightLegRef,
}) {
  const [hovered, setHovered] = useState(false);

  const avatarColors = useMemo(
    () => resolveAvatarColors(agent.avatar_config, agent.color),
    [agent.avatar_config, agent.color]
  );

  const accessories = useMemo(
    () => normalizeAccessories(agent.avatar_config),
    [agent.avatar_config]
  );
  const hasGlasses = accessories.some((a) => ['glasses', 'sunglasses', 'square_glasses'].includes(a));

  const bubbleStyles = useMemo(
    () => computeBubbleStyles(agent.bubble, agent.bubbleType, agent.color),
    [agent.bubble, agent.bubbleType, agent.color]
  );

  React.useEffect(() => {
    if (!hovered) {
      document.body.style.cursor = 'auto';
    } else {
      document.body.style.cursor = isDragTarget ? 'grabbing' : 'grab';
    }
    return () => { document.body.style.cursor = 'auto'; };
  }, [hovered, isDragTarget]);

  const pressTimerRef = React.useRef(null);
  const didDragRef = React.useRef(false);

  const handlePointerDown = React.useCallback((e) => {
    e.stopPropagation();
    didDragRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      didDragRef.current = true;
      if (onStartDrag) onStartDrag(agent.id, e);
    }, 200);
  }, [agent.id, onStartDrag]);

  const handlePointerUp = React.useCallback((e) => {
    e.stopPropagation();
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (!didDragRef.current && onSelect) {
      onSelect(agent.id);
    }
  }, [agent.id, onSelect]);

  React.useEffect(() => {
    return () => {
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    };
  }, []);

  const leftProp = LEFT_HAND_PROPS.has(animProp) ? animProp : null;
  const rightProp = RIGHT_HAND_PROPS.has(animProp) ? animProp : null;

  return (
    <group ref={parentRef}>
      <animated.group scale={bodyScale}>
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.5, 16]} />
          <meshBasicMaterial color="black" transparent opacity={0.3} />
        </mesh>

        {isSelected && (
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.65, 0.75, 32]} />
            <meshBasicMaterial color={agent.color || '#818cf8'} transparent opacity={0.8} toneMapped={false} />
          </mesh>
        )}

        <ToolEmoji
          toolEmoji={agent.toolEmoji || agent.tool}
          toolName={agent.tool}
          visible={showToolBadge}
          agentColor={agent.color}
        />

        <AgentSpeechBubble
          bubble={agent.bubble}
          isSpeaking={agent.isSpeaking}
          bubbleStyles={bubbleStyles}
          isExiting={isExiting}
        />

        {(hovered || isSelected) && (
          <AgentHoverBadge
            agentId={agent.id}
            agentColor={agent.color}
            isSelected={isSelected}
            isExiting={isExiting}
            onSelect={onSelect}
          />
        )}

        <group ref={bodyRef}>
          <mesh
            position={[0, 0.5, 0]}
            castShadow
            receiveShadow
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(true);
            }}
            onPointerOut={() => setHovered(false)}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
          >
            <capsuleGeometry args={[0.4, 0.6, 4, 16]} />
            <meshStandardMaterial
              color={avatarColors.body}
              roughness={0.6}
              transparent={isExiting}
              opacity={isExiting ? 0.3 : 1}
              emissive={isDragTarget ? avatarColors.body : '#000000'}
              emissiveIntensity={isDragTarget ? 0.4 : 0}
            />
          </mesh>

          <AgentVisorAndEyes hasGlasses={hasGlasses} isError={isError} />

          {accessories.map((type) => (
            <ProceduralHat
              key={type}
              type={type}
              mainColor={avatarColors.body}
              accentColor={avatarColors.legs}
            />
          ))}

          <AgentArmBone armRef={leftArmRef} xPos={-0.45} activeProp={leftProp} smokeIntensity={smokeIntensity} />
          <AgentArmBone armRef={rightArmRef} xPos={0.45} activeProp={rightProp} smokeIntensity={smokeIntensity} />
          <AgentLegBone legRef={leftLegRef} xPos={-0.18} legsColor={avatarColors.legs} />
          <AgentLegBone legRef={rightLegRef} xPos={0.18} legsColor={avatarColors.legs} />
        </group>
      </animated.group>
    </group>
  );
}
