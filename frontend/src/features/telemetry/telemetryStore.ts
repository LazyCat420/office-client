'use client';

import React, { createContext, useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api';

export interface CycleEvent {
  ts: number | string;
  phase: string;
  step?: string;
  detail?: string;
  status: string;
  data?: Record<string, unknown> | null;
  elapsed_ms?: number;
  [key: string]: unknown;
}

export interface CycleResult {
  ticker?: string;
  decision?: string;
  confidence?: number;
  reasoning?: string;
  [key: string]: unknown;
}

export interface CycleStatus {
  cycle_id?: string;
  status: string;
  phase?: string;
  events?: CycleEvent[];
  results?: CycleResult[];
  [key: string]: unknown;
}

export interface TelemetryContextType {
  currentCycle: CycleStatus | null;
  eventsByCycle: Record<string, CycleEvent[]>;
  refreshCycleStatus: () => Promise<CycleStatus | undefined>;
}

export const TelemetryContext = createContext<TelemetryContextType | null>(null);

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const [currentCycle, setCurrentCycle] = useState<CycleStatus | null>(null);
  const [eventsByCycle, setEventsByCycle] = useState<Record<string, CycleEvent[]>>({});

  const updateCycleState = useCallback((cycleState: CycleStatus) => {
    if (!cycleState) return;

    let resolvedEvents: CycleEvent[] = cycleState.events || [];
    let resolvedResults: CycleResult[] = cycleState.results || [];

    setCurrentCycle((previousCycle) => {
      if (previousCycle && previousCycle.cycle_id && previousCycle.cycle_id === cycleState.cycle_id) {
        const hasOldEvents = previousCycle.events && previousCycle.events.length > 0;
        const hasNewEvents = cycleState.events && cycleState.events.length > 0;
        const hasOldResults = previousCycle.results && previousCycle.results.length > 0;
        const hasNewResults = cycleState.results && cycleState.results.length > 0;

        if (hasOldEvents && hasNewEvents) {
          // Prefer newer payload when same or greater length (may have updated statuses)
          resolvedEvents = (cycleState.events && previousCycle.events && cycleState.events.length >= previousCycle.events.length)
            ? cycleState.events
            : (previousCycle.events || []);
        } else if (hasOldEvents && !hasNewEvents) {
          resolvedEvents = previousCycle.events || [];
        }

        if (hasOldResults && hasNewResults) {
          resolvedResults = (cycleState.results && previousCycle.results && cycleState.results.length >= previousCycle.results.length)
            ? cycleState.results
            : (previousCycle.results || []);
        } else if (hasOldResults && !hasNewResults) {
          resolvedResults = previousCycle.results || [];
        }
      }
      return { ...cycleState, events: resolvedEvents, results: resolvedResults };
    });

    if (cycleState.cycle_id) {
      setEventsByCycle((previousEvents) => {
        const nextEventsMap = { ...previousEvents };
        const oldEvents = nextEventsMap[cycleState.cycle_id!] || [];
        const finalEvents = (cycleState.events && Array.isArray(cycleState.events) && cycleState.events.length >= oldEvents.length)
          ? cycleState.events
          : oldEvents;
        nextEventsMap[cycleState.cycle_id!] = finalEvents;

        // Keep at most 5 cycles to prevent unbounded memory growth
        const cycleKeys = Object.keys(nextEventsMap);
        if (cycleKeys.length > 5) {
          const oldestKey = cycleKeys.find(key => key !== cycleState.cycle_id);
          if (oldestKey) {
            delete nextEventsMap[oldestKey];
          }
        }
        return nextEventsMap;
      });
    }
  }, []);

  const loadCycleStatus = useCallback(async (summaryOnly = false) => {
    try {
      const cycleState = await api.getCycleStatus(summaryOnly) as CycleStatus | null;
      if (cycleState && cycleState.status !== 'Backend unreachable') {
        updateCycleState(cycleState);
      }
      return cycleState;
    } catch (fetchError: unknown) {
      console.warn('[TelemetryStore] Failed to load cycle status:', fetchError);
    }
  }, [updateCycleState]);

  useEffect(() => {
    // Initial fetch to paint immediately
    loadCycleStatus(false);

    let isSubscribed = true;
    let eventSourceInstance: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isSSEActive = false;

    // Heartbeat: poll every 10s as fallback for missed SSE events.
    // This catches cycle-end transitions the SSE stream might miss
    // due to reconnect gaps or JSON dedup.
    const heartbeatInterval = setInterval(() => {
      if (isSubscribed) {
        loadCycleStatus(false); // full payload to catch missed SSE events
      }
    }, 10_000);

    const connectSSE = () => {
      if (!isSubscribed) return;

      eventSourceInstance = new EventSource('/api/v1/run-cycle/status/stream');

      eventSourceInstance.onmessage = (event: MessageEvent) => {
        if (!isSubscribed) return;
        isSSEActive = true;
        try {
          const cycleData = JSON.parse(event.data) as CycleStatus;
          if (cycleData && cycleData.status !== 'Backend unreachable') {
            updateCycleState(cycleData);
          }
        } catch (parseError: unknown) {
          console.error('[TelemetryStore] Failed to parse cycle status stream:', parseError);
        }
      };

      eventSourceInstance.onerror = (errorEvent: Event) => {
        console.error('[TelemetryStore] Cycle status stream error, reconnecting...', errorEvent);
        isSSEActive = false;
        if (eventSourceInstance) eventSourceInstance.close();
        if (isSubscribed) {
          // Immediate full fetch to bridge the SSE gap
          loadCycleStatus(false);
          reconnectTimer = setTimeout(connectSSE, 2000);
        }
      };
    };

    connectSSE();

    return () => {
      isSubscribed = false;
      if (eventSourceInstance) eventSourceInstance.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(heartbeatInterval);
    };
  }, [loadCycleStatus, updateCycleState]);

  const refreshCycleStatus = useCallback(() => {
    return loadCycleStatus(false) as Promise<CycleStatus | undefined>;
  }, [loadCycleStatus]);

  const value = {
    currentCycle,
    eventsByCycle,
    refreshCycleStatus,
  };

  return React.createElement(TelemetryContext.Provider, { value }, children);
}
