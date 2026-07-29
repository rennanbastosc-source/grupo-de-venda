import { describe, expect, it } from "vitest";
import { resolveAuthRedirect } from "@/lib/supabase/middleware";

describe("resolveAuthRedirect", () => {
  it("redirects unauthenticated user away from dashboard", () => {
    expect(resolveAuthRedirect("/dashboard", false)).toBe("/login");
    expect(resolveAuthRedirect("/dashboard/grupos", false)).toBe("/login");
  });

  it("redirects authenticated user away from login", () => {
    expect(resolveAuthRedirect("/login", true)).toBe("/dashboard");
  });

  it("allows dashboard when authenticated", () => {
    expect(resolveAuthRedirect("/dashboard", true)).toBeNull();
  });

  it("allows login when unauthenticated", () => {
    expect(resolveAuthRedirect("/login", false)).toBeNull();
  });
});
