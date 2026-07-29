export type WaSessionStatus =
  | "disconnected"
  | "qr"
  | "connecting"
  | "connected";

export type WaGroupInput = {
  jid: string;
  name: string;
  active?: boolean;
  daily_limit?: number | null;
  notes?: string | null;
};

export type WaGroup = WaGroupInput & {
  id: string;
  created_at?: string;
  updated_at?: string;
};
