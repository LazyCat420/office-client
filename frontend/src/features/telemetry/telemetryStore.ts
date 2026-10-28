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

function resolveMergedCycleList<T>(oldList: T[] | undefined, newList: T[] | undefined): T[] {
  const safeOld = oldList || [];
  const safeNew = newList || [];
  if (safeOld.length > 0 && safeNew.length > 0) {
    return safeNew.length >= safeOld.length ? safeNew : safeOld;
  }
  if (safeOld.length > 0) {
    return safeOld;
  }
  return safeNew;
}

function mergeCycleStatusUpdate(previousCycle: CycleStatus | null, cycleState: CycleStatus): CycleStatus {
  const isSameCycle = Boolean(
    previousCycle && previousCycle.cycle_id && previousCycle.cycle_id === cycleState.cycle_id
  );
  if (!isSameCycle || !previousCycle) {
    return {
      ...cycleState,
      events: cycleState.events || [],
      results: cycleState.results || [],
    };
  }
  return {
    ...cycleState,
    events: resolveMergedCycleList(previousCycle.events, cycleState.events),
    results: resolveMergedCycleList(previousCycle.results, cycleState.results),
  };
}

function appendCycleEventsEntry(
  previousEvents: Record<string, CycleEvent[]>,
  cycleId: string,
  incomingEvents?: CycleEvent[],
): Record<string, CycleEvent[]> {
  const nextEventsMap = { ...previousEvents };
  const oldEvents = nextEventsMap[cycleId] || [];
  const hasNewerEvents = Array.isArray(incomingEvents) && incomingEvents.length >= oldEvents.length;
  nextEventsMap[cycleId] = hasNewerEvents ? incomingEvents! : oldEvents;

  const cycleKeys = Object.keys(nextEventsMap);
  if (cycleKeys.length > 5) {
    const oldestKey = cycleKeys.find(key => key !== cycleId);
    if (oldestKey) {
      delete nextEventsMap[oldestKey];
    }
  }
  return nextEventsMap;
}

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const [currentCycle, setCurrentCycle] = useState<CycleStatus | null>(null);
  const [eventsByCycle, setEventsByCycle] = useState<Record<string, CycleEvent[]>>({});

  const updateCycleState = useCallback((cycleState: CycleStatus) => {
    if (!cycleState) return;

    setCurrentCycle((previousCycle) => mergeCycleStatusUpdate(previousCycle, cycleState));

    if (cycleState.cycle_id) {
      setEventsByCycle((previousEvents) =>
        appendCycleEventsEntry(previousEvents, cycleState.cycle_id!, cycleState.events)
      );
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
