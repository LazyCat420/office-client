import React from 'react';
import { Monitor } from './Monitor';

/**
 * TradingPit — Central octagonal trading station with inner/outer monitor rings.
 * The centerpiece of the trading floor.
 */
export function TradingPit() {
  return (
    <group position={[0, 0, 0]}>
      {/* Central Pillar / Ticker */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.8, 0.8, 3, 8]} />
        <meshStandardMaterial color="#0f172a" roughness={0.7} />
      </mesh>
      {/* Ticker Screens on Pillar */}
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 0.6, 8]} />
        <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.5} />
      </mesh>
      
      {/* Circular Desk / Post */}
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.8, 2.6, 0.9, 16]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.46, 0]}>
        <cylinderGeometry args={[1.8, 1.8, 0.95, 16]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>
      
      {/* Inner ring monitors */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
        const angle = (i * Math.PI) / 4;
        return <Monitor key={`in-${i}`} position={[Math.sin(angle) * 1.5, 0.95, Math.cos(angle) * 1.5]} rotation={[0, angle, 0]} />;
      })}
      
      {/* Outer ring monitors */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => {
        const angle = (i * Math.PI) / 6;
        return <Monitor key={`out-${i}`} position={[Math.sin(angle) * 3.2, 0.95, Math.cos(angle) * 3.2]} rotation={[0, angle + Math.PI, 0]} screenColor="#eab308" />;
      })}
    </group>
  );
}
