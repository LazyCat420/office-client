import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * CloudLayer — Animated volumetric-looking clouds surrounding the skyscraper.
 * 
 * Uses instanced billboard planes with a soft radial-gradient canvas texture.
 * Clouds are arranged in concentric rings at various heights around and below
 * the building, creating the illusion of being at the 100th floor.
 * 
 * Performance: ~250 instanced planes with a single draw call.
 * No raymarching, no volumetrics — just smart billboard placement.
 */

const BLDG_R = 32; // Must match building radius

// Cloud ring definitions: [minR, maxR, minY, maxY, count, sizeMin, sizeMax, opacity]
const CLOUD_RINGS = [
  // Close thick base clouds at floor level — dense fog wrapping the building
  { minR: 34, maxR: 48, minY: -4,  maxY: 4,   count: 40, sizeMin: 8,  sizeMax: 18, opacity: 0.38 },
  // Mid-distance clouds — larger, softer
  { minR: 45, maxR: 75, minY: -8,  maxY: 10,  count: 50, sizeMin: 12, sizeMax: 26, opacity: 0.28 },
  // Far horizon clouds — very large, atmospheric
  { minR: 70, maxR: 130, minY: -12, maxY: 16,  count: 45, sizeMin: 20, sizeMax: 42, opacity: 0.20 },
  // Very distant haze layer
  { minR: 110, maxR: 200, minY: -6,  maxY: 12,  count: 25, sizeMin: 30, sizeMax: 55, opacity: 0.12 },
  // Dense under-building cloud blanket — sea of clouds below the tower
  { minR: 0, maxR: 110, minY: -32, maxY: -18, count: 50, sizeMin: 25, sizeMax: 50, opacity: 0.35 },
];

const TOTAL_CLOUDS = CLOUD_RINGS.reduce((sum, r) => sum + r.count, 0);

/**
 * Generate a soft circular cloud puff texture via Canvas.
 * Radial gradient: white center → transparent edge.
 */
function createCloudTexture() {
  if (typeof document === 'undefined') return null;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);

  // Overlapping puff clusters to create organic volumetric cloud shapes
  // Top highlight colors simulate sunlight, bottom shadows simulate depth/ambient
  const puffs = [
    // Center puff
    { x: 128, y: 128, r: 52, color: 'rgba(250, 245, 235, 0.95)', shadow: 'rgba(140, 145, 175, 0.45)' },
    // Left puff
    { x: 82,  y: 128, r: 42, color: 'rgba(245, 240, 230, 0.90)', shadow: 'rgba(130, 135, 165, 0.40)' },
    // Right puff
    { x: 174, y: 128, r: 44, color: 'rgba(245, 240, 230, 0.90)', shadow: 'rgba(130, 135, 165, 0.40)' },
    // Top-left puff (bright sunlight highlight)
    { x: 105, y: 100, r: 38, color: 'rgba(255, 250, 245, 0.98)', shadow: 'rgba(150, 155, 185, 0.35)' },
    // Top-right puff (bright sunlight highlight)
    { x: 151, y: 102, r: 36, color: 'rgba(255, 250, 245, 0.98)', shadow: 'rgba(150, 155, 185, 0.35)' },
    // Bottom puff (deep in shadow)
    { x: 128, y: 154, r: 40, color: 'rgba(170, 175, 205, 0.80)', shadow: 'rgba(95, 100, 130, 0.50)' },
  ];

  puffs.forEach(puff => {
    // Shift gradient highlight up-left to match directional lighting
    const gradient = ctx.createRadialGradient(
      puff.x - puff.r * 0.15, puff.y - puff.r * 0.2, 0,
      puff.x, puff.y, puff.r
    );
    gradient.addColorStop(0, puff.color);
    gradient.addColorStop(0.3, puff.color);
    gradient.addColorStop(0.75, puff.shadow);
    gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(puff.x, puff.y, puff.r, 0, Math.PI * 2);
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function CloudLayer() {
  const meshRef = useRef();

  // Generate cloud texture once
  const cloudTexture = useMemo(() => createCloudTexture(), []);

  // Pre-compute cloud data (position, size, speed, phase)
  const cloudData = useMemo(() => {
    const data = [];

    for (const ring of CLOUD_RINGS) {
      for (let i = 0; i < ring.count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = ring.minR + Math.random() * (ring.maxR - ring.minR);
        const y = ring.minY + Math.random() * (ring.maxY - ring.minY);
        const size = ring.sizeMin + Math.random() * (ring.sizeMax - ring.sizeMin);

        data.push({
          angle,
          radius: r,
          y,
          size,
          opacity: ring.opacity * (0.6 + Math.random() * 0.4),
          // Drift speed (radians per second) — very slow rotation
          driftSpeed: (0.0008 + Math.random() * 0.002) * (Math.random() > 0.5 ? 1 : -1),
          // Vertical bob
          bobSpeed: 0.04 + Math.random() * 0.08,
          bobAmp: 0.2 + Math.random() * 0.6,
          bobPhase: Math.random() * Math.PI * 2,
          // Constrained Z-rotation so cloud highlight stays on top
          zRotation: (Math.random() - 0.5) * 0.35, // -10 to +10 degrees
          aspectRatioOffset: (Math.random() - 0.5) * 0.15,
        });
      }
    }

    return data;
  }, []);

  // Animation: slowly drift clouds and apply vertical bob
  useFrame((state) => {
    if (!meshRef.current) return;

    const time = state.clock.getElapsedTime();
    const dummy = new THREE.Object3D();

    for (let i = 0; i < cloudData.length; i++) {
      const cloud = cloudData[i];

      // Rotate around building center
      const currentAngle = cloud.angle + time * cloud.driftSpeed;
      const x = Math.sin(currentAngle) * cloud.radius;
      const z = Math.cos(currentAngle) * cloud.radius;
      const y = cloud.y + Math.sin(time * cloud.bobSpeed + cloud.bobPhase) * cloud.bobAmp;

      dummy.position.set(x, y, z);

      // Billboard: copy camera orientation directly for perfect alignment
      dummy.quaternion.copy(state.camera.quaternion);
      // Small Z rotation within screen plane
      dummy.rotateZ(cloud.zRotation);

      // Scale by cloud size
      dummy.scale.set(cloud.size, cloud.size * (0.55 + cloud.aspectRatioOffset), 1);

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, TOTAL_CLOUDS]}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={cloudTexture}
        transparent
        opacity={0.7}
        depthWrite={false}
        side={THREE.DoubleSide}
        fog={false}
        onBeforeCompile={(shader) => {
          // 1. Inject varying in vertex shader
          shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `#include <common>
            varying vec3 vWorldPos;`
          );

          // 2. Calculate world position in vertex shader
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            vec4 localPosition = vec4(position, 1.0);
            #ifdef USE_INSTANCING
              localPosition = instanceMatrix * localPosition;
            #endif
            vWorldPos = (modelMatrix * localPosition).xyz;`
          );

          // 3. Inject varying in fragment shader
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `#include <common>
            varying vec3 vWorldPos;`
          );

          // 4. Perform discard logic in fragment shader
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            // The office building has an outer radius of 32.
            // If the pixel is inside the cylinder and within the office height range (floor y=0 to ceiling y=4.5), discard it.
            // We use 32.1 for the radius and y from -0.5 to 5.0 to give a clean safety margin.
            float distToCenter = length(vWorldPos.xz);
            if (distToCenter < 32.1 && vWorldPos.y > -0.5 && vWorldPos.y < 5.0) {
              discard;
            }`
          );
        }}
      />
    </instancedMesh>
  );
}
