#!/usr/bin/env bash
# Garante que o alvo de schema/ops é o banco certo.
# Uso:
#   bash scripts/assert-db-env.sh production
#   bash scripts/assert-db-env.sh staging
#   bash scripts/assert-db-env.sh production --push   # db push no linked (só se production)
#
# Refs canônicas (Supabase free: 2 projetos):
#   production = fyotfffqjrtxwfupzhij  (grupo-de-venda, sa-east-1)
#   staging    = ojnxywrzeouyzowcgmoe  (legado renomeado mentalmente p/ staging)
#
# O repo `supabase link` deve permanecer em **production**.
# Staging: push via workdir isolado (ver docs/runbooks/staging-preview.md).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-}"
ACTION="${2:-}"

PROD_REF="fyotfffqjrtxwfupzhij"
STAGING_REF="ojnxywrzeouyzowcgmoe"

if [[ -z "$TARGET" || ( "$TARGET" != "production" && "$TARGET" != "staging" ) ]]; then
  echo "uso: $0 production|staging [--push|--list]"
  exit 2
fi

if [[ "$TARGET" == "production" ]]; then
  EXPECT="$PROD_REF"
else
  EXPECT="$STAGING_REF"
fi

LINKED=""
if [[ -f "$ROOT/supabase/.temp/project-ref" ]]; then
  LINKED="$(tr -d '[:space:]' < "$ROOT/supabase/.temp/project-ref")"
elif [[ -f "$ROOT/supabase/.temp/linked-project.json" ]]; then
  LINKED="$(python3 -c "import json;print(json.load(open('$ROOT/supabase/.temp/linked-project.json'))['ref'])" 2>/dev/null || true)"
fi

echo "target=$TARGET expected_ref=$EXPECT linked_ref=${LINKED:-none}"

if [[ "$TARGET" == "production" ]]; then
  if [[ -z "$LINKED" ]]; then
    echo "FAIL: repo sem supabase link (esperado production $PROD_REF)"
    exit 1
  fi
  if [[ "$LINKED" != "$PROD_REF" ]]; then
    echo "FAIL: linked=$LINKED ≠ production=$PROD_REF"
    echo "hint: npx supabase link --project-ref $PROD_REF"
    exit 1
  fi
  echo "ok: repo linked em production"
  if [[ "$ACTION" == "--list" ]]; then
    npx supabase migration list --linked
  fi
  if [[ "$ACTION" == "--push" ]]; then
    npx supabase db push --linked --yes
    npx supabase migration list --linked
  fi
  exit 0
fi

# staging: NÃO exige link do repo (evitar trocar o link de prod por engano)
echo "ok: staging ref=$STAGING_REF (push via workdir isolado — ver runbook)"
if [[ "$ACTION" == "--push" ]]; then
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  mkdir -p "$TMP/supabase"
  cp -a "$ROOT/supabase/migrations" "$TMP/supabase/"
  # config mínima + link
  printf 'project_id = "%s"\n' "$STAGING_REF" > "$TMP/supabase/config.toml"
  (
    cd "$TMP"
    npx supabase link --project-ref "$STAGING_REF" --yes
    npx supabase db push --linked --yes
    npx supabase migration list --linked
  )
fi
if [[ "$ACTION" == "--list" ]]; then
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  mkdir -p "$TMP/supabase"
  cp -a "$ROOT/supabase/migrations" "$TMP/supabase/"
  printf 'project_id = "%s"\n' "$STAGING_REF" > "$TMP/supabase/config.toml"
  (
    cd "$TMP"
    npx supabase link --project-ref "$STAGING_REF" --yes
    npx supabase migration list --linked
  )
fi
exit 0
