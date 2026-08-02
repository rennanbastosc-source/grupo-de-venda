export type WaSessionStatus =
  | "disconnected"
  | "waiting_pairing"
  | "qr"
  | "connecting"
  | "connected"
  | "logged_out";

export type WaGroupInput = {
  jid: string;
  name: string;
  active?: boolean;
  notes?: string | null;
};

export type WaGroup = WaGroupInput & {
  id: string;
  created_at?: string;
  updated_at?: string;
};
