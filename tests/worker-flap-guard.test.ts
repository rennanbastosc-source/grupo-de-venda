/**
 * Documenta o contrato do ramo timedOut: com account NÃO pode forçar
 * waiting_pairing (era o flap). Lógica espelhada do client.ts para unit test
 * sem subir Baileys.
 */
import { describe, expect, it } from "vitest";

/** Espelho do critério em handleConnectionUpdate (close). */
function nextStatusOnClose(opts: {
  code: number | undefined;
  hasAccount: boolean;
  pendingPairingPhone: string | null;
  DisconnectReason: { timedOut: number; loggedOut: number; restartRequired: number };
}): "waiting_pairing" | "disconnected" | "logged_out" | "connecting" {
  const { code, hasAccount, pendingPairingPhone, DisconnectReason } = opts;
  if (code === DisconnectReason.restartRequired) return "connecting";
  if (code === DisconnectReason.loggedOut) return "logged_out";
  if (
    pendingPairingPhone !== null ||
    (!hasAccount && code === DisconnectReason.timedOut)
  ) {
    return "waiting_pairing";
  }
  return "disconnected";
}

const DR = { timedOut: 408, loggedOut: 401, restartRequired: 515 };

describe("flap guard (timedOut + account)", () => {
  it("timeout COM account → disconnected (reconnect), não waiting_pairing", () => {
    expect(
      nextStatusOnClose({
        code: DR.timedOut,
        hasAccount: true,
        pendingPairingPhone: null,
        DisconnectReason: DR,
      }),
    ).toBe("disconnected");
  });

  it("timeout SEM account → waiting_pairing", () => {
    expect(
      nextStatusOnClose({
        code: DR.timedOut,
        hasAccount: false,
        pendingPairingPhone: null,
        DisconnectReason: DR,
      }),
    ).toBe("waiting_pairing");
  });

  it("pair pendente → waiting_pairing mesmo com account", () => {
    expect(
      nextStatusOnClose({
        code: DR.timedOut,
        hasAccount: true,
        pendingPairingPhone: "5585",
        DisconnectReason: DR,
      }),
    ).toBe("waiting_pairing");
  });
});
