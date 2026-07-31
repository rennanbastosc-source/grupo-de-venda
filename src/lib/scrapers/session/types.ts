export type MarketplaceSource = "mercadolivre" | "amazon" | "shopee";

export type SessionStatus = "ok" | "expired" | "error" | "unknown";

export type PlatformSession = {
  source: MarketplaceSource;
  cookies: Record<string, string>;
  cookieHeader: string;
  status: SessionStatus;
  lastError?: string;
  updatedAt?: string;
};

export type SessionStatusPublic = {
  source: MarketplaceSource;
  status: SessionStatus;
  lastError: string | null;
  updatedAt: string | null;
};
