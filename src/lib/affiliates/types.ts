export type ProviderKind = "livelo" | "meliuz" | "generic";

export type ProviderConfig = {
  template?: string;
  params?: Record<string, string>;
  base_url?: string;
};

export type AffiliateProvider = {
  id: string;
  slug: string;
  name: string;
  kind: ProviderKind;
  config: ProviderConfig;
  active: boolean;
};

export type EmitResult =
  | { ok: true; affiliateUrl: string }
  | { ok: false; error: string };
