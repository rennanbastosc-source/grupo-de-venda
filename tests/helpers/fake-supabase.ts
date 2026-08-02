import type { SupabaseClient } from "@supabase/supabase-js";

export type Op = { method: string; args: unknown[] };
export type Handler = (table: string, ops: Op[]) => unknown;

/** Fake supabase-js: grava a cadeia de chamadas e delega a resolução. */
export function makeSupabase(handler: Handler) {
  return {
    from(table: string) {
      const ops: Op[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const builder: any = {};
      for (const m of [
        "select",
        "eq",
        "neq",
        "or",
        "lt",
        "lte",
        "gte",
        "in",
        "not",
        "is",
        "order",
        "limit",
        "update",
        "insert",
      ]) {
        builder[m] = (...args: unknown[]) => {
          ops.push({ method: m, args });
          return builder;
        };
      }
      builder.maybeSingle = async () => handler(table, ops);
      builder.then = (
        resolve: (v: unknown) => unknown,
        reject: (e: unknown) => unknown,
      ) => Promise.resolve(handler(table, ops)).then(resolve, reject);
      return builder;
    },
  } as unknown as SupabaseClient;
}

export function op(ops: Op[], method: string): Op | undefined {
  return ops.find((o) => o.method === method);
}

export function updatePayload(ops: Op[]): Record<string, unknown> | null {
  const u = op(ops, "update");
  return u ? (u.args[0] as Record<string, unknown>) : null;
}
