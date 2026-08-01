#!/usr/bin/env bash
# Verifica o contrato central do Motor de Escopo por Feature:
# dois fluxos SDD paralelos (worktrees simultâneas) produzem artefatos disjuntos
# e integram na base sem conflito.
#
# Uso: bash tests/isolamento-fluxos.sh
set -euo pipefail

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
G="git -c user.email=t@t -c user.name=t"
falhas=0
ok(){ echo "  ✓ $1"; }
falha(){ echo "  ✗ $1"; falhas=$((falhas+1)); }

cd "$TMP" && git init -q -b main .
# /sdd-implement garante esta linha na governança de versão
printf 'STATE.md merge=union\n' > .gitattributes
git add .gitattributes && $G commit -q -m init

# Cria um fluxo SDD completo no layout canônico: PRD/MVP/specs + bloco no STATE.md
fluxo(){ # $1=slug  $2=nº de fatias
  mkdir -p docs/prd docs/mvp docs/specs
  printf '# PRD %s\n' "$1" > "docs/prd/PRD-$1.md"
  { printf '# MVP %s\n' "$1"; seq -f '### Fatia %02g' 1 "$2"; } > "docs/mvp/MVP-$1.md"
  for n in $(seq -f '%02g' 1 "$2"); do
    printf '# Fatia %s %s\nStatus: CONCLUÍDO\n' "$n" "$1" > "docs/specs/spec-$1-fatia-$n.md"
  done
  printf '# STATE\n\n## Features Integradas\n\n### %s  ·  2026-01-01  ·  PR #9\n- Invariantes: inv-%s\n\n' "$1" "$1" > STATE.md
  git add "docs/prd/PRD-$1.md" "docs/mvp/MVP-$1.md" docs/specs/spec-"$1"-fatia-*.md STATE.md
  $G commit -q -m "feat($1): docs"
}

git checkout -q -b feat/auth && fluxo auth 2
git worktree add -q "$TMP/wt-b" -b feat/billing main
(cd "$TMP/wt-b" && fluxo billing 1)

echo "Isolamento entre fluxos SDD paralelos:"

# 1. nenhum nome de spec em comum entre as duas features
comuns=$(comm -12 \
  <(git ls-tree -r --name-only feat/auth    docs/specs/ | xargs -n1 basename | sort) \
  <(git ls-tree -r --name-only feat/billing docs/specs/ | xargs -n1 basename | sort))
[ -z "$comuns" ] && ok "specs de features distintas não colidem" \
                 || falha "specs colidem: $comuns"

# 2. as duas branches integram sem conflito
git checkout -q main && $G merge -q --no-edit feat/auth
if $G merge --no-edit feat/billing >/dev/null 2>&1; then
  ok "as duas branches integram sem conflito"
else
  falha "conflito ao integrar: $($G diff --name-only --diff-filter=U | tr '\n' ' ')"
  $G merge --abort 2>/dev/null || true
fi

# 3. nada foi sobrescrito: os artefatos das duas features sobrevivem à integração
[ -f docs/specs/spec-auth-fatia-01.md ] && [ -f docs/specs/spec-billing-fatia-01.md ] \
  && ok "specs das duas features coexistem após o merge" \
  || falha "spec perdida no merge"

# 4. STATE.md append-only preserva os dois registros, sem marcador de conflito
if grep -q '### auth' STATE.md && grep -q '### billing' STATE.md && ! grep -q '<<<<<<<' STATE.md; then
  ok "STATE.md preserva os blocos das duas features (merge=union)"
else
  falha "STATE.md perdeu um bloco ou ficou com marcador de conflito"
fi

echo
[ "$falhas" -eq 0 ] && echo "✅ isolamento garantido" || { echo "❌ $falhas falha(s)"; exit 1; }
