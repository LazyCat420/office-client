import { describe, it, expect } from "vitest";
import { mapEvent } from "../eventMapper";

function backendEvent(overrides = {}) {
  return {
    ts: "2026-07-01T12:00:00.000Z",
    phase: "analyzing",
    step: "step",
    detail: "",
    status: "ok",
    data: {},
    ...overrides,
  };
}

describe("mapEvent agent identity", () => {
  it("canonicalizes doubled v3_v3_ step prefixes to a single V3_ id", () => {
    const [event] = mapEvent(backendEvent({ step: "v3_v3_junior_analyst_done_UBER" }));
    expect(event.agentId).toBe("V3_JUNIOR_ANALYST");
  });

  it("recognizes the V3 roster agents without _agent/_analyst suffixes", () => {
    const cases = [
      { step: "v3_regime_engine_start_UBER", agentId: "V3_REGIME_ENGINE", station: "research" },
      { step: "v3_portfolio_manager_done_UBER", agentId: "V3_PORTFOLIO_MANAGER" },
      { step: "v3_decision_synthesizer_done_UBER", agentId: "V3_DECISION_SYNTHESIZER" },
      { step: "v3_debate_judge_done_UBER", agentId: "V3_DEBATE_JUDGE", station: "debate" },
      { step: "v3_board_of_directors_done_UBER", agentId: "V3_BOARD_OF_DIRECTORS", station: "debate" },
    ];
    for (const { step, agentId, station } of cases) {
      const [event] = mapEvent(backendEvent({ step }));
      expect(event.agentId).toBe(agentId);
      if (station) expect(event.station).toBe(station);
    }
  });

  it("spawns a real debater as counter-advocate for debate events, never a phantom _adv clone", () => {
    const events = mapEvent(backendEvent({ step: "v3_debate_judge_done_UBER" }));
    expect(events).toHaveLength(2);
    expect(events[1].agentId).toBe("BEARISH_DEBATER");
  });
});

describe("mapEvent skipped handling", () => {
  it("maps skipped to done but marks the event as skipped", () => {
    const [event] = mapEvent(backendEvent({ step: "v3_triage_done_UBER", status: "skipped" }));
    expect(event.status).toBe("done");
    expect(event.skipped).toBe(true);
  });

  it("does not mark normal completions as skipped", () => {
    const [event] = mapEvent(backendEvent({ step: "v3_v3_junior_analyst_done_UBER", status: "ok" }));
    expect(event.status).toBe("done");
    expect(event.skipped).toBe(false);
  });
});
