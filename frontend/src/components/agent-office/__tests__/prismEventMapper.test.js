import { describe, it, expect } from "vitest";
import { mapPrismEvent, isPrismWebhookEvent } from "../prismEventMapper";

const classify = () => "tool_bench";

function prismEvent(eventType, data, ts = "2026-07-01T12:00:00.000Z") {
  return { eventType, data, webhookTimestamp: ts, webhookEventId: "evt_1" };
}

describe("isPrismWebhookEvent", () => {
  it("detects events with an eventType field", () => {
    expect(isPrismWebhookEvent({ eventType: "generation.started" })).toBe(true);
    expect(isPrismWebhookEvent({ type: "chunk" })).toBe(false);
    expect(isPrismWebhookEvent(null)).toBe(false);
  });
});

describe("mapPrismEvent", () => {
  it("returns [] for null events and unknown event types", () => {
    expect(mapPrismEvent(null, classify)).toEqual([]);
    expect(mapPrismEvent({ eventType: "some.unknown" }, classify)).toEqual([]);
  });

  it("skips events for non-pipeline agents without model context", () => {
    const events = mapPrismEvent(
      prismEvent("generation.started", { agent: "prism-agent" }),
      classify,
    );
    expect(events).toEqual([]);
  });

  it("maps generation.started to a station start event", () => {
    const events = mapPrismEvent(
      prismEvent("generation.started", { agent: "QUANT", model: "m1", provider: "vllm" }),
      classify,
    );
    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event.agentId).toBe("QUANT_RESEARCH_AGENT");
    expect(event.station).toBe("research");
    expect(event.type).toBe("research_start");
    expect(event.status).toBe("start");
    expect(event.toolEmoji).toBe("🧠");
    expect(event.ts).toBe(Date.parse("2026-07-01T12:00:00.000Z"));
    expect(event.meta.source).toBe("prism");
  });

  it("labels ToT/GoT agents as graph exploration", () => {
    const events = mapPrismEvent(
      prismEvent("generation.started", { agent: "PLANNER_ToT" }),
      classify,
    );
    expect(events).toHaveLength(1);
    expect(events[0].tool).toBe("exploring graph");
    expect(events[0].toolEmoji).toBe("🌳");
  });

  it("falls back to PRISM_AGENT when only model context is present", () => {
    const events = mapPrismEvent(
      prismEvent("generation.started", { model: "gpt-x", provider: "vllm" }),
      classify,
    );
    expect(events).toHaveLength(1);
    expect(events[0].agentId).toBe("PRISM_AGENT");
  });

  it("maps generation.completed to progress + voice events", () => {
    const events = mapPrismEvent(
      prismEvent("generation.completed", { agent: "QUANT" }),
      classify,
    );
    expect(events).toHaveLength(2);
    expect(events[0].status).toBe("progress");
    expect(events[1].type).toBe("agent_voice");
  });

  it("maps tool_call.started to start + voice events with the tool name", () => {
    const events = mapPrismEvent(
      prismEvent("request.tool_call.started", { agent: "QUANT", toolName: "web_search" }),
      classify,
    );
    expect(events).toHaveLength(2);
    expect(events[0].tool).toBe("web_search");
    expect(events[0].status).toBe("start");
    expect(events[1].type).toBe("agent_voice");
    expect(events[1].quote).toContain("web search");
  });

  it("suppresses intermediate tool events for graph-exploration agents", () => {
    const started = mapPrismEvent(
      prismEvent("request.tool_call.started", { agent: "PLANNER_GoT", toolName: "x" }),
      classify,
    );
    const completed = mapPrismEvent(
      prismEvent("request.tool_call.completed", { agent: "PLANNER_GoT", toolName: "x" }),
      classify,
    );
    expect(started).toEqual([]);
    expect(completed).toEqual([]);
  });

  it("maps tool_call.completed to done, or error when status is error", () => {
    const done = mapPrismEvent(
      prismEvent("request.tool_call.completed", { agent: "QUANT", toolName: "t" }),
      classify,
    );
    expect(done[0].status).toBe("done");
    expect(done[0].label).toContain("completed");

    const failed = mapPrismEvent(
      prismEvent("request.tool_call.completed", { agent: "QUANT", toolName: "t", status: "error" }),
      classify,
    );
    expect(failed[0].status).toBe("error");
    expect(failed[0].label).toContain("failed");
  });

  it("maps request.created to a progress event with the operation", () => {
    const events = mapPrismEvent(
      prismEvent("request.created", { agent: "QUANT", operation: "chat" }),
      classify,
    );
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe("progress");
    expect(events[0].tool).toBe("chat");
  });
});
