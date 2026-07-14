import { describe, it, expect } from "vitest";
import {
  cleanAgentId,
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
