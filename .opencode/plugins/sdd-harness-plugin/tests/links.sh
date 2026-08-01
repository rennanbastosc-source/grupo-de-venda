#!/usr/bin/env bash
# Verifica que todo link/caminho markdown citado nas skills aponta para um arquivo existente.
# (commands/sdd.md já carregou links relativos quebrados por ser cópia de skills/sdd/SKILL.md)
#
# Uso: bash tests/links.sh
set -uo pipefail
cd "$(dirname "$0")/.."
falhas=0

# 1. links markdown relativos: [texto](caminho.md) — resolvidos a partir da pasta do arquivo
while IFS= read -r origem; do
  while IFS= read -r alvo; do
    [ -z "$alvo" ] && continue
    case "$alvo" in http*|\#*) continue ;; esac
    if [ ! -e "$(dirname "$origem")/$alvo" ]; then
      echo "  ✗ $origem → [$alvo] não existe"
      falhas=$((falhas+1))
    fi
  done < <(grep -o '](\([^)]*\.md\))' "$origem" | sed 's/^](//; s/)$//')
done < <(find skills commands -name '*.md')

# 2. caminhos citados como `skills/.../arquivo.md` — resolvidos a partir da raiz do plugin
while IFS= read -r origem; do
  while IFS= read -r alvo; do
    [ -e "$alvo" ] || { echo "  ✗ $origem → \`$alvo\` não existe"; falhas=$((falhas+1)); }
  done < <(grep -o '`skills/[^`]*\.md`' "$origem" | tr -d '`' | sort -u)
done < <(find skills commands -name '*.md')

echo "Links das skills:"
[ "$falhas" -eq 0 ] && echo "  ✓ todas as referências resolvem" && echo && echo "✅ nenhum link quebrado" \
  || { echo; echo "❌ $falhas link(s) quebrado(s)"; exit 1; }
