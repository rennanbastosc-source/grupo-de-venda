export function assertCronSecret(request: Request): Response | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return Response.json(
      { error: "CRON_SECRET não configurado" },
      { status: 500 },
    );
  }
  const auth = request.headers.get("authorization");
  const header = request.headers.get("x-cron-secret");
  const ok =
    header === expected ||
    auth === `Bearer ${expected}`;
  if (!ok) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
