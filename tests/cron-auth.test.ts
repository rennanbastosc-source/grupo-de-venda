import { describe, expect, it } from "vitest";
import { assertCronSecret } from "@/lib/cron-auth";

describe("assertCronSecret", () => {
  it("rejects without secret configured", () => {
    const prev = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    const r = assertCronSecret(new Request("http://x/api/cron/scrape"));
    expect(r?.status).toBe(500);
    if (prev) process.env.CRON_SECRET = prev;
  });

  it("rejects wrong secret", () => {
    process.env.CRON_SECRET = "good";
    const r = assertCronSecret(
      new Request("http://x", { headers: { "x-cron-secret": "bad" } }),
    );
    expect(r?.status).toBe(401);
  });

  it("accepts bearer or header", () => {
    process.env.CRON_SECRET = "good";
    expect(
      assertCronSecret(
        new Request("http://x", { headers: { "x-cron-secret": "good" } }),
      ),
    ).toBeNull();
    expect(
      assertCronSecret(
        new Request("http://x", {
          headers: { authorization: "Bearer good" },
        }),
      ),
    ).toBeNull();
  });
});
