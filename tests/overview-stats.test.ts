import { describe, expect, it } from "vitest";
import {
  aggregateJobCounts,
  dayBoundsSaoPaulo,
} from "@/lib/stats/overview";

describe("aggregateJobCounts", () => {
  it("counts sent failed queued", () => {
    const r = aggregateJobCounts([
      { status: "sent" },
      { status: "sent" },
      { status: "failed" },
      { status: "queued" },
      { status: "sending" },
      { status: "skipped" },
    ]);
    expect(r.dispatchesSent).toBe(2);
    expect(r.dispatchesFailed).toBe(1);
    expect(r.dispatchesQueued).toBe(2);
  });

  it("zeros on empty", () => {
    expect(aggregateJobCounts([])).toEqual({
      dispatchesSent: 0,
      dispatchesFailed: 0,
      dispatchesQueued: 0,
    });
  });
});

describe("dayBoundsSaoPaulo", () => {
  it("returns YYYY-MM-DD and UTC bounds", () => {
    const { date, startIso, endIso } = dayBoundsSaoPaulo(
      new Date("2026-07-29T15:00:00.000Z"),
    );
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(startIso).toBe(`${date}T03:00:00.000Z`);
    expect(endIso.endsWith("T03:00:00.000Z")).toBe(true);
    expect(new Date(endIso).getTime()).toBeGreaterThan(
      new Date(startIso).getTime(),
    );
  });
});
