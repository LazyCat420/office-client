import React, { useMemo } from 'react';
import * as THREE from 'three';

/**
 * SkyDome — A large background sphere showing a twilight gradient sky.
 * 
 * Provides the atmosphere visible beyond the clouds.
 * Uses a CanvasTexture vertical gradient:
 * - Deep indigo at the zenith (top)
 * - Warm amber/coral at the horizon
 * - Dark navy below the horizon
 * 
 * Also includes subtle stars near the top.
 */

const SKY_RADIUS = 250;

/**
 * Generate a twilight sky gradient texture.
 */
function createSkyTexture() {
  const width = 512;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Vertical gradient — top to bottom
  const gradient = ctx.createLinearGradient(0, 0, 0, height);

  // Zenith — deep space
  gradient.addColorStop(0, '#050510');
  // Upper sky — deep indigo
  gradient.addColorStop(0.15, '#0a0a2e');
  // Mid sky — twilight blue
  gradient.addColorStop(0.35, '#1a1a4e');
  // Above horizon — purple/magenta transition
  gradient.addColorStop(0.48, '#2d1b4e');
  // Horizon glow — warm amber/coral
  gradient.addColorStop(0.52, '#4a2040');
  gradient.addColorStop(0.55, '#8b3a3a');
  gradient.addColorStop(0.58, '#c4653a');
  gradient.addColorStop(0.60, '#d4854a');
  // Below horizon — fading to dark
  gradient.addColorStop(0.65, '#6b3a30');
  gradient.addColorStop(0.75, '#1a1020');
  gradient.addColorStop(1.0, '#050510');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Add subtle stars in the upper portion
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height * 0.4; // Only upper 40%
    const size = Math.random() * 1.5 + 0.5;
    const brightness = Math.random();

    ctx.globalAlpha = brightness * 0.7;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  // Add a few brighter stars
  ctx.fillStyle = 'rgba(200, 220, 255, 1.0)';
  for (let i = 0; i < 15; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height * 0.3;
    const size = Math.random() * 2 + 1;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function SkyDome() {
  const skyTexture = useMemo(() => createSkyTexture(), []);

  return (
    <group name="sky-dome">
      {/* Main sky sphere */}
      <mesh>
        <sphereGeometry args={[SKY_RADIUS, 32, 32]} />
        <meshBasicMaterial
          map={skyTexture}
          side={THREE.BackSide}
          fog={false}
        />
      </mesh>

      {/* Horizon glow ring — subtle emissive ring at horizon level */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[SKY_RADIUS * 0.95, 8, 8, 64]} />
        <meshBasicMaterial
          color="#c4653a"
          transparent
          opacity={0.06}
          fog={false}
        />
      </mesh>
    </group>
  );
}
