import { describe, it, expect } from "vitest";
import {
  cleanAgentId,
  canonicalAgentId,
  getHomeStation,
  getStationForAgentOrTool,
} from "../agentUtils";

describe("cleanAgentId", () => {
  it("returns null for empty and non-pipeline agents", () => {
    expect(cleanAgentId(null)).toBeNull();
    expect(cleanAgentId("")).toBeNull();
    expect(cleanAgentId("prism-agent")).toBeNull();
    expect(cleanAgentId("USER_CHAT")).toBeNull();
    expect(cleanAgentId("system")).toBeNull();
  });

  it("strips CUSTOM_ and DELEGATION_ prefixes", () => {
    expect(cleanAgentId("CUSTOM_MY_AGENT")).toBe("MY_AGENT");
    expect(cleanAgentId("DELEGATION_MY_AGENT")).toBe("MY_AGENT");
  });

  it("maps janitor variants to DATA_JANITOR", () => {
    expect(cleanAgentId("SYSTEM_JANITOR_AGENT")).toBe("DATA_JANITOR");
    expect(cleanAgentId("DATA_JANITOR_CRITIC_AGENT")).toBe("DATA_JANITOR");
    expect(cleanAgentId("weekly_janitor_run")).toBe("DATA_JANITOR");
  });

  it("maps debater aliases", () => {
    expect(cleanAgentId("bullish_researcher")).toBe("BULLISH_DEBATER");
    expect(cleanAgentId("BEAR_CASE_AGENT")).toBe("BEARISH_DEBATER");
  });

  it("maps persona-keyed names to 3D office counterparts", () => {
    expect(cleanAgentId("fundamental")).toBe("QUANT_RESEARCH_AGENT");
    expect(cleanAgentId("risk")).toBe("PRE_TRADE_RISK");
    expect(cleanAgentId("pm")).toBe("PORTFOLIO_ALLOCATOR");
    expect(cleanAgentId("trader")).toBe("PORTFOLIO_ALLOCATOR");
    expect(cleanAgentId("planner")).toBe("PLANNER");
  });

  it("normalizes worker agent names", () => {
    expect(cleanAgentId("scout_worker_3")).toBe("SCOUT_worker_3");
  });

  it("passes through unrecognized agents unchanged", () => {
    expect(cleanAgentId("MY_SPECIAL_AGENT")).toBe("MY_SPECIAL_AGENT");
  });
});

describe("canonicalAgentId", () => {
  it("passes through falsy input", () => {
    expect(canonicalAgentId(null)).toBeNull();
    expect(canonicalAgentId("")).toBe("");
  });

  it("uppercases lowercase ids", () => {
    expect(canonicalAgentId("v3_junior_analyst")).toBe("V3_JUNIOR_ANALYST");
  });

  it("strips a leading CUSTOM_ prefix", () => {
    expect(canonicalAgentId("CUSTOM_V3_JUNIOR_ANALYST")).toBe("V3_JUNIOR_ANALYST");
  });

  it("collapses a doubled V3_V3_ prefix", () => {
    expect(canonicalAgentId("V3_V3_JUNIOR_ANALYST")).toBe("V3_JUNIOR_ANALYST");
    expect(canonicalAgentId("v3_v3_junior_analyst")).toBe("V3_JUNIOR_ANALYST");
  });

  it("converges all three event-source identities to one key", () => {
    const polled = canonicalAgentId("V3_V3_JUNIOR_ANALYST");
    const systemSse = canonicalAgentId(cleanAgentId("v3_junior_analyst"));
    const prismSse = canonicalAgentId(cleanAgentId("CUSTOM_V3_JUNIOR_ANALYST"));
    expect(polled).toBe("V3_JUNIOR_ANALYST");
    expect(systemSse).toBe("V3_JUNIOR_ANALYST");
    expect(prismSse).toBe("V3_JUNIOR_ANALYST");
  });
});

describe("getHomeStation", () => {
  it("routes debaters to the war room", () => {
    expect(getHomeStation("BULLISH_DEBATER")).toBe("debate");
  });

  it("routes risk agents to risk management", () => {
    expect(getHomeStation("PRE_TRADE_RISK")).toBe("error");
  });

  it("routes janitors based on 2D/3D flag", () => {
    expect(getHomeStation("DATA_JANITOR", true)).toBe("janitor");
    expect(getHomeStation("DATA_JANITOR", false)).toBe("tool_bench");
  });

  it("routes allocators/executors to the exec office", () => {
    expect(getHomeStation("PORTFOLIO_ALLOCATOR")).toBe("inbox");
    expect(getHomeStation("SYNTHESIZER")).toBe("inbox");
  });

  it("routes research/quant agents to the research desk", () => {
    expect(getHomeStation("QUANT_RESEARCH_AGENT")).toBe("research");
    expect(getHomeStation("RETRIEVER")).toBe("research");
  });

  it("routes the V3 roster to their home rooms", () => {
    expect(getHomeStation("V3_QUANT_ANALYST", true)).toBe("research");
    expect(getHomeStation("V3_JUNIOR_ANALYST", true)).toBe("research");
    expect(getHomeStation("V3_FUNDAMENTAL_ANALYST", true)).toBe("research");
    expect(getHomeStation("V3_REGIME_ENGINE", true)).toBe("research");
    expect(getHomeStation("V3_BOARD_OF_DIRECTORS", true)).toBe("debate");
    expect(getHomeStation("V3_DEBATE_JUDGE", true)).toBe("debate");
    expect(getHomeStation("V3_PORTFOLIO_MANAGER", true)).toBe("inbox");
    expect(getHomeStation("V3_DECISION_SYNTHESIZER", true)).toBe("inbox");
  });

  it("returns null for unknown agents", () => {
    expect(getHomeStation("MYSTERY_AGENT")).toBeNull();
    expect(getHomeStation(null)).toBeNull();
  });
});

describe("getStationForAgentOrTool", () => {
  it("prefers the agent's home station", () => {
    const classify = () => "tool_bench";
    expect(getStationForAgentOrTool("QUANT_RESEARCH_AGENT", "web_search", classify)).toBe("research");
  });

  it("falls back to tool classification when the agent has no home", () => {
    const classify = (tool) => (tool === "web_search" ? "search_bay" : "desk");
    expect(getStationForAgentOrTool("MYSTERY_AGENT", "web_search", classify)).toBe("search_bay");
  });
});
