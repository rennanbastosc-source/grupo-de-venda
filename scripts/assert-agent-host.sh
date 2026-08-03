#!/usr/bin/env bash
# Valida segregação de harness: OpenCode = OMO slim; Claude Code = superpowers.
# Uso: bash scripts/assert-agent-host.sh
# Exit 0 = host + plugins coerentes; 1 = conflito ou host ambíguo.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OPENCODE_USER_CFG="${OPENCODE_CONFIG:-$HOME/.config/opencode/opencode.jsonc}"
OPENCODE_USER_CFG_JSON="$HOME/.config/opencode/opencode.json"
CLAUDE_PROJ_SETTINGS="$ROOT/.claude/settings.json"
FAIL=0

detect_host() {
  # Sinais explícitos primeiro
  if [[ -n "${OPENCODE_SESSION:-}" || -n "${OPENCODE_CONFIG_DIR:-}" || -n "${OPENCODE:-}" ]]; then
    echo "opencode"
    return
  fi
  if [[ -n "${CLAUDECODE:-}" || -n "${CLAUDE_CODE_ENTRYPOINT:-}" || -n "${CLAUDE_SESSION_ID:-}" ]]; then
    echo "claude"
    return
  fi
  # Heurística por parent / argv
  local tree
  tree="$(ps -o args= -p $$ 2>/dev/null || true)"
  tree+=" $(ps -o args= -p $PPID 2>/dev/null || true)"
  if echo "$tree" | grep -qiE 'opencode|oh-my-opencode'; then
    echo "opencode"
    return
  fi
  if echo "$tree" | grep -qiE 'claude|@anthropic'; then
    echo "claude"
    return
  fi
  # Fallback: se só um dos configs de projeto "manda" no cwd
  if [[ -f "$CLAUDE_PROJ_SETTINGS" ]] && grep -q 'superpowers' "$CLAUDE_PROJ_SETTINGS" 2>/dev/null; then
    if [[ -f "$ROOT/opencode.json" ]] && ! grep -q 'superpowers' "$ROOT/opencode.json" 2>/dev/null; then
      echo "ambiguous"
      return
    fi
  fi
  echo "unknown"
}

cfg_has() {
  local file="$1" pattern="$2"
  [[ -f "$file" ]] && grep -qE "$pattern" "$file" 2>/dev/null
}

HOST="$(detect_host)"
echo "host_detect=$HOST"

case "$HOST" in
  opencode)
    echo "expected_harness=oh-my-opencode-slim (+ ponytail, sdd)"
    # OpenCode NÃO deve carregar superpowers
    for f in "$OPENCODE_USER_CFG" "$OPENCODE_USER_CFG_JSON" "$ROOT/opencode.json"; do
      if cfg_has "$f" 'superpowers'; then
        echo "FAIL: $f menciona superpowers (proibido no OpenCode)"
        FAIL=1
      fi
    done
    ok_omo=0
    for f in "$OPENCODE_USER_CFG" "$OPENCODE_USER_CFG_JSON"; do
      if cfg_has "$f" 'oh-my-opencode-slim'; then
        ok_omo=1
      fi
    done
    if [[ "$ok_omo" -ne 1 ]]; then
      echo "FAIL: oh-my-opencode-slim ausente em ~/.config/opencode"
      FAIL=1
    else
      echo "ok: oh-my-opencode-slim presente no config user OpenCode"
    fi
    if cfg_has "$ROOT/opencode.json" 'sdd-harness-plugin'; then
      echo "ok: sdd-harness-plugin no opencode.json do repo"
    else
      echo "WARN: sdd-harness-plugin não listado em opencode.json (skills SDD podem faltar)"
    fi
    ;;
  claude)
    echo "expected_harness=superpowers (+ ponytail hooks se configurados)"
    if [[ ! -f "$CLAUDE_PROJ_SETTINGS" ]]; then
      echo "FAIL: .claude/settings.json ausente"
      FAIL=1
    elif ! cfg_has "$CLAUDE_PROJ_SETTINGS" 'superpowers@claude-plugins-official'; then
      echo "FAIL: superpowers não habilitado em .claude/settings.json"
      FAIL=1
    else
      echo "ok: superpowers habilitado no projeto Claude"
    fi
    # Claude não deve depender de OMO slim como harness de processo
    if cfg_has "$CLAUDE_PROJ_SETTINGS" 'oh-my-opencode-slim'; then
      echo "FAIL: oh-my-opencode-slim no settings Claude (segregação quebrada)"
      FAIL=1
    fi
    ;;
  ambiguous|unknown)
    echo "WARN: host não detectado com certeza (rode de dentro do OpenCode ou Claude Code)"
    echo "hint: export OPENCODE=1  ou  CLAUDECODE=1  se o assert for manual"
    # Ainda valida configs estáticas
    if cfg_has "$OPENCODE_USER_CFG" 'superpowers' || cfg_has "$OPENCODE_USER_CFG_JSON" 'superpowers'; then
      echo "FAIL: config user OpenCode contém superpowers"
      FAIL=1
    fi
    if [[ -f "$CLAUDE_PROJ_SETTINGS" ]] && ! cfg_has "$CLAUDE_PROJ_SETTINGS" 'superpowers@claude-plugins-official'; then
      echo "FAIL: Claude project sem superpowers"
      FAIL=1
    fi
    if [[ "$HOST" == "unknown" ]]; then
      FAIL=1
    fi
    ;;
esac

if [[ "$FAIL" -ne 0 ]]; then
  echo "result=FAIL"
  exit 1
fi
echo "result=OK"
exit 0
