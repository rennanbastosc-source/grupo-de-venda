# MVP Scope & Slice Breakdown: Escala de Disparos

> Feature: `escala-disparos` · Branch: `feat/escala-disparos` · PRD: `docs/prd/PRD-escala-disparos.md`

## 1. Escopo de Entrega (Must-Have vs. Nice-To-Have)

### 🔴 Must-Have (Obrigatório para o MVP)
- Dedupe durável de envio (`wa_sent_jobs`) + retry com `attempts`/backoff + reaper automático de `sending` preso — os três são **um mecanismo só** e pré-requisito do burst.
- Fuso único `America/Fortaleza` em janela de silêncio e virada de dia; janela operacional 07:00–23:00 com silêncio 23:01–06:59.
- Burst broadcast: 1 oferta por slot de 5 min para todos os grupos ativos (teto 15) com jitter 2–5s; correção do bug do `now` congelado; remoção de `wa_groups.daily_limit`.
- Caps duplos configuráveis (ofertas/dia e mensagens/dia) com defaults conservadores, editáveis na UI.
- Rotas de cron no padrão `202` + background (`after()`/`waitUntil`) e migração dos agendamentos para cron-job.org com `vercel.json` esvaziado.
- Funil de caption dimensionado pelo cap vigente.
- Planilha rebaixada a espelho somente-leitura (sync de mão única, import morto, gatilho de caption interno).
- Log append-only de eventos de conexão WA + consulta em `/dashboard/bot`; drop da tabela morta `wa_session`.

### 🟡 Nice-To-Have (Postergado para versões futuras)
- Encurtador de link de parceiro Amazon (citado explicitamente como posterior; ML `meli.la` e Amazon atual permanecem como estão).
- Variação de texto por grupo para reduzir fingerprint de conteúdo idêntico.
- Badge/contador de jobs "resgatados" pelo reaper na UI.
- Múltiplos números de WhatsApp / múltiplos workers (fora de escopo; várias premissas de consumidor único mudariam).
- Uptime agregado / gráficos de estabilidade da conexão (o MVP entrega a lista de eventos).

## 2. Fatiamento de Entregas (Slices)

### 📦 Fatia 01: Envio seguro — dedupe durável, retry e reaper
- **Objetivo:** Migration `wa_sent_jobs` (PK job_id) + coluna `attempts` em `dispatch_jobs`; worker consulta/grava `wa_sent_jobs` via PostgREST e responde `{deduped:true}`; retry com backoff (máx. 3 tentativas → `failed` terminal); reaper no início do processamento (`sending` > 10 min → `queued`, `attempts+1`). Testes cobrindo duplicação pós-restart, backoff e resgate.
- **Dependências:** Nenhuma.
- **Status:** `PENDENTE`

### 📦 Fatia 02: Relógio único, janela operacional e caps duplos
- **Objetivo:** Constante única `America/Fortaleza` aplicada a `dayStart` e janela de silêncio (mata o bug dos dois relógios); configuração da janela 07:00–23:00 / silêncio 23:01–06:59; `app_settings` com caps separados de ofertas/dia e mensagens/dia (defaults conservadores) + edição na UI de disparos. Testes de virada de dia e janela cruzando meia-noite.
- **Dependências:** Nenhuma.
- **Status:** `PENDENTE`

### 📦 Fatia 03: Burst broadcast com jitter e teto de grupos
- **Objetivo:** Novo loop do dispatch: 1 oferta por slot → envio sequencial a todos os grupos ativos com delay aleatório 2–5s; morte do bug do `now` congelado; `maxDuration=300` no cron de dispatch; rotas de cron respondendo `202` com trabalho em background; teto de 15 grupos ativos na API de grupos; drop de `wa_groups.daily_limit`. Testes do burst (ordem, jitter, respeito aos caps) e do teto de grupos.
- **Dependências:** Fatia 01, Fatia 02.
- **Status:** `PENDENTE`

### 📦 Fatia 04: Migração dos crons para cron-job.org
- **Objetivo:** Esvaziar o array `crons` do `vercel.json` (commit próprio, antes do downgrade); runbook em `docs/` com os jobs externos (URLs, header `CRON_SECRET`, agendas: scrape 3×/dia, pipeline +15 min, dispatch e keepalive `*/5`); verificação documentada do Fluid Compute ativo. Período de convivência Vercel+cron-job.org coberto pela idempotência existente.
- **Dependências:** Fatia 03 (padrão `202` já no ar).
- **Status:** `PENDENTE`

### 📦 Fatia 05: Funil de caption dimensionado pelo cap
- **Objetivo:** Batch e frequência da geração de captions derivados do cap de ofertas/dia (fim do `CAPTION_BATCH=3` fixo), garantindo que o pipeline apronte ofertas no ritmo que o dispatch consome. Testes do dimensionamento.
- **Dependências:** Fatia 02 (caps existirem).
- **Status:** `PENDENTE`

### 📦 Fatia 06: Planilha espelho somente-leitura
- **Objetivo:** Remover `importFromSheets` e as travas de não-rebaixamento; export vira sync de mão única com colunas enxutas (link/caption, status enviado/pendente); gatilho `caption_status none → pending` movido para dentro do pipeline (independente de Sheets); limpeza de código/colunas que só serviam ao import. Testes do sync e do novo gatilho.
- **Dependências:** Nenhuma (independente; pode entrar em qualquer ordem).
- **Status:** `PENDENTE`

### 📦 Fatia 07: Auditoria de conexão WA
- **Objetivo:** Migration: drop `wa_session` (morta) + tabela append-only de eventos de conexão; worker grava eventos nas transições de `handleConnectionUpdate` (PostgREST, mesmo canal das keys); endpoint de leitura + listagem em `/dashboard/bot` (quedas com timestamp e motivo). Status vivo permanece em memória do worker. Testes dos eventos e da rota.
- **Dependências:** Nenhuma (independente; pode entrar em qualquer ordem).
- **Status:** `PENDENTE`

**Total: 7 fatias.**

## 3. Invariantes & Riscos Identificados

- **Invariante 1:** O status vivo da sessão WA vive na memória do worker; nenhuma fatia o persiste em banco (o log de eventos é histórico, não status).
- **Invariante 2:** Claim atômico `WHERE status='queued'` preservado; retry/reaper operam **por cima** dele, nunca no lugar dele.
- **Invariante 3:** Nenhum reenvio sem consulta prévia a `wa_sent_jobs` — retry sem dedupe durável é proibido (risco de mensagem duplicada em grupo).
- **Invariante 4:** Throw no load de creds WA ilegíveis e gate `creds.account` intocados (área de maior risco do sistema).
- **Invariante 5:** Volume inicial conservador com teto configurável; subida gradual é decisão do admin, nunca default do código.
- **Invariante 6:** Guardas `ci.supabase.co`/`SCRAPE_MOCK=1` em todo módulo novo com acesso a rede/banco.
- **Risco 1:** Fluid Compute inativo no projeto → Hobby não atinge `maxDuration=300` e o burst não cabe no serverless. → **Mitigação:** verificação antes do downgrade (Fatia 04); plano B: mover pacing para o worker (só se confirmado o bloqueio).
- **Risco 2:** Timeout ~30s do cron-job.org free abortando a requisição no meio do burst. → **Mitigação:** padrão `202` + `waitUntil` na Fatia 03; job externo nunca espera o trabalho.
- **Risco 3:** Antibot do WhatsApp (texto idêntico em massa a partir de um número). → **Mitigação:** jitter 2–5s, janela humana 07–23h, caps conservadores com subida gradual; variação de texto por grupo fica como nice-to-have.
- **Risco 4:** Convivência Vercel cron + cron-job.org durante a transição disparando o mesmo endpoint 2×. → **Mitigação:** idempotência existente (claim atômico, upserts) + dedupe durável da Fatia 01.
- **Risco 5:** Downgrade do plano acontecer antes da Fatia 04 → crons `*/5` deixam de existir e a operação para silenciosamente. → **Mitigação:** ordem de implementação prioriza Fatias 01→04; runbook permite ativar cron-job.org manualmente a qualquer momento, mesmo antes do `202`-pattern (com jobs marcando timeout, mas funcionais).
