'use client';

import { useContext } from 'react';
import { TelemetryContext } from './telemetryStore';

export function useTelemetry() {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
}

export function useCurrentCycle() {
  const { currentCycle } = useTelemetry();
  return currentCycle;
}

export function useCycleEvents(cycleId: string) {
  const { eventsByCycle, currentCycle } = useTelemetry();
  if (eventsByCycle && eventsByCycle[cycleId]) {
    return eventsByCycle[cycleId];
  }
  if (currentCycle && currentCycle.cycle_id === cycleId) {
    return currentCycle.events || [];
  }
  return [];
}
