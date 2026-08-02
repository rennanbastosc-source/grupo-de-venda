import { describe, expect, it } from "vitest";
import {
  activeLimitError,
  assertJidUnique,
  MAX_ACTIVE_GROUPS,
  normalizeJid,
  validateGroupInput,
} from "@/lib/wa/groups";

describe("validateGroupInput", () => {
  it("accepts valid group jid", () => {
    const r = validateGroupInput({
      jid: "120363ABC@g.us",
      name: " Promo ",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.jid).toBe("120363abc@g.us");
      expect(r.value.name).toBe("Promo");
    }
  });

  it("ignora daily_limit legado sem erro", () => {
    const r = validateGroupInput({
      jid: "1@g.us",
      name: "x",
      daily_limit: 10,
    } as Parameters<typeof validateGroupInput>[0]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect("daily_limit" in r.value).toBe(false);
    }
  });

  it("rejects bad jid", () => {
    const r = validateGroupInput({ jid: "not-a-jid", name: "x" });
    expect(r.ok).toBe(false);
  });

  it("requires name", () => {
    const r = validateGroupInput({ jid: "1@g.us", name: "  " });
    expect(r.ok).toBe(false);
  });
});

describe("assertJidUnique", () => {
  it("detects duplicate", () => {
    expect(
      assertJidUnique("1@g.us", [], undefined, [
        { id: "a", jid: "1@g.us" },
      ]),
    ).toBe("jid já cadastrado");
  });

  it("allows same id on update", () => {
    expect(
      assertJidUnique("1@g.us", [], "a", [{ id: "a", jid: "1@g.us" }]),
    ).toBeNull();
  });
});

describe("normalizeJid", () => {
  it("lowercases", () => {
    expect(normalizeJid(" X@G.US ")).toBe("x@g.us");
  });
});

describe("activeLimitError (teto de grupos ativos)", () => {
  it("permite até o teto", () => {
    expect(activeLimitError(MAX_ACTIVE_GROUPS - 1)).toBeNull();
  });

  it("bloqueia o 16º ativo com mensagem legível", () => {
    const err = activeLimitError(MAX_ACTIVE_GROUPS);
    expect(err).toMatch(/15 grupos ativos/);
  });
});
