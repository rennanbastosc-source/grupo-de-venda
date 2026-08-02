# PRD: Escala de Disparos — envio seguro, broadcast com jitter e operação sem Vercel Pro

> Origem: auditoria guiada pelo `SYSTEM-DESIGN.md` (2026-08-02). Decisões de produto tomadas em entrevista com o admin nesta mesma data.

## 1. Resumo Executivo & Problema

- **Problema:** A operação atual tem quatro fragilidades que impedem escalar o número de grupos por número de WhatsApp:
  1. O loop de dispatch nunca envia mais de 1 job por execução (bug do `now` congelado em `process.ts`), não há retry (`failed`/`skipped` são terminais), não há reaper para jobs presos em `sending`, e a idempotência de envio depende de um `Set` em memória do worker que some a cada deploy — qualquer correção de retry sem dedupe durável causa mensagem duplicada em grupo.
  2. O rate limit usa dois relógios (janela de silêncio em America/Sao_Paulo, tetos diários em UTC), gerando contabilidade errada entre 21h e meia-noite locais.
  3. A planilha Google Sheets é superfície de **escrita** (import com travas de não-rebaixamento), descentralizando a auditoria de ofertas que já tem tela dedicada no dashboard; e o status vivo do WhatsApp não tem histórico — quedas de conexão não são auditáveis.
  4. Os crons `*/5` dependem do plano Vercel Pro, que não será renovado (downgrade para Hobby no próximo mês — Hobby limita a 2 crons diários).
- **Proposta de Valor:** Broadcast seguro da mesma oferta para até 15 grupos espelhados com ritmo humanizado (jitter 2–5s), janela operacional 07:00–23:00 em fuso único (`America/Fortaleza`), mecanismo único de dedupe durável + retry + reaper que elimina perda e duplicação de mensagens, planilha rebaixada a espelho somente-leitura, auditoria de quedas de conexão no dashboard e agendamento externo via cron-job.org independente de plano pago da Vercel.
- **Público-Alvo / Personas:** Admin único (single-tenant) que opera o dashboard e o número de WhatsApp.

## 2. Requisitos Funcionais (RF)

- [ ] **RF-01 — Dedupe durável de envio:** o worker registra `job_id` em tabela `wa_sent_jobs` (PK = job_id) imediatamente após envio bem-sucedido, via PostgREST; antes de enviar, consulta a tabela e responde `{deduped:true}` sem reenviar se já existir. O `Set` em memória permanece como atalho.
- [ ] **RF-02 — Retry com backoff:** `dispatch_jobs` ganha coluna `attempts`; falha transitória devolve o job a `queued` com `scheduled_for = now + backoff`; após 3 tentativas o job vai a `failed` terminal.
- [ ] **RF-03 — Reaper automático:** no início de cada execução do dispatch, jobs em `sending` há mais de 10 minutos voltam a `queued` com `attempts` incrementado. Sem botão de UI (o dedupe durável torna o resgate inofensivo).
- [ ] **RF-04 — Relógio único:** constante única de timezone `America/Fortaleza` (UTC-3 fixo) aplicada à janela de silêncio, à virada de dia dos contadores (`dayStart`) e a qualquer cálculo de calendário do dispatch.
- [ ] **RF-05 — Janela operacional:** disparos apenas entre 07:00 e 23:00 (Fortaleza); silêncio de 23:01 a 06:59, usando o mecanismo existente de `sleep_start`/`sleep_end` que já cruza meia-noite.
- [ ] **RF-06 — Burst broadcast com jitter:** cada slot do cron (a cada 5 min) processa **1 oferta** e a envia a todos os grupos ativos em sequência com delay aleatório de 2–5s entre grupos; a mesma oferta vai para todos os grupos (espelhados).
- [ ] **RF-07 — Teto de 15 grupos ativos:** `POST /api/groups` e `PATCH /api/groups/[id]` recusam ativar o 16º grupo. A coluna `wa_groups.daily_limit` (nunca lida) é removida — grupos espelhados tornam limite por grupo sem sentido.
- [ ] **RF-08 — Caps duplos configuráveis:** `app_settings` passa a distinguir teto de **ofertas/dia** e teto de **mensagens/dia**, editáveis na UI de disparos, com defaults conservadores para subida gradual de volume.
- [ ] **RF-09 — Funil de caption dimensionado:** batch e frequência da geração de captions acompanham o cap de ofertas/dia vigente (não mais fixos em `CAPTION_BATCH=3` × 3 runs/dia).
- [ ] **RF-10 — Planilha espelho somente-leitura:** o import (`importFromSheets`) e suas travas morrem; o export vira sync de mão única e enxuto (colunas: link/caption, status enviado/pendente). O gatilho `caption_status: none → pending` sai do export e vira passo interno do pipeline (caption é gerada exista planilha ou não).
- [ ] **RF-11 — Auditoria de conexão WA:** tabela append-only de eventos (`connected`/`disconnected`/`logged_out` + motivo + timestamp) escrita pelo worker nas transições de `handleConnectionUpdate` via PostgREST; listagem consultável em `/dashboard/bot`. A tabela morta `wa_session` é dropada. O status vivo permanece na memória do worker (decisão explícita: não persistir status de socket).
- [ ] **RF-12 — Crons externos (cron-job.org):** rotas de cron respondem `202` imediatamente e executam o trabalho em background (`after()`/`waitUntil`), compatível com o timeout de ~30s do cron-job.org free; o array `crons` do `vercel.json` é esvaziado em commit próprio antes do downgrade; runbook documenta os jobs externos (URLs, headers com `CRON_SECRET`, agendas).

## 3. Requisitos Não-Funcionais (RNF) & Restrições

- **Performance / duração:** slot de burst com 15 grupos leva até ~75s (jitter máximo) — rotas de cron de dispatch com `maxDuration = 300`. Pré-requisito de infra: **Fluid Compute ativo** no projeto Vercel (Hobby só atinge 300s com Fluid); verificar antes do downgrade. Plano B (só se necessário): mover o pacing para o worker.
- **Segurança & Permissões:** `CRON_SECRET` continua o único gate das rotas de cron (header `x-cron-secret`/Bearer — já compatível com cron-job.org); `x-worker-secret` inalterado; secrets só server/env; `wa_sent_jobs` e tabela de eventos sem RLS, acesso só por service role (mesmo padrão de `wa_session_keys`).
- **Volume (regra de negócio imutável):** início conservador com teto configurável — a arquitetura suporta 192 slots/dia (07–23h a cada 5 min), mas o uso começa muito abaixo e sobe gradualmente observando o comportamento da conta. Texto idêntico replicado em massa é assinatura de antibot; o jitter humaniza o ritmo, não o volume.
- **Invariantes herdadas (nunca quebrar):** throw no load de creds WA ilegíveis (`auth-state.ts`); gate `creds.account` antes do socket; `status` preservado no upsert de offers; claim atômico `WHERE status='queued'`; degradação graciosa do provider ML sem cookie; guardas `ci.supabase.co`/`SCRAPE_MOCK=1` em todo módulo novo com rede/banco (AGENTS.md §11 e §14).
- **Compatibilidade:** worker permanece "burro" (`/send` unitário) — orquestração de fila, pacing e jitter vivem no app; Vercel Hobby + Render free + cron-job.org free sustentam a operação completa.

## 4. Métricas de Sucesso (KPIs)

- Zero mensagens duplicadas em grupos após deploy/restart do worker (validado por `wa_sent_jobs`).
- Zero jobs presos em `sending` por mais de 10 minutos (reaper) e zero jobs perdidos por falha transitória (retry).
- Operação de scrape/pipeline/dispatch íntegra por 7 dias consecutivos rodando exclusivamente via cron-job.org no plano Vercel Hobby.
- Quedas de conexão do WhatsApp consultáveis no dashboard com timestamp e motivo (zero idas ao banco para depurar).
- Contadores de teto diário e janela de silêncio virando no mesmo instante (fuso único Fortaleza).

## 5. Casos de Uso & Fluxos do Usuário

1. **Fluxo Principal (Happy Path):** cron-job.org chama `/api/cron/dispatch` a cada 5 min com o header do `CRON_SECRET` → rota responde `202` e segue em background → dentro da janela 07–23h, seleciona a oferta mais antiga com jobs `queued` → envia ao 1º grupo, aguarda 2–5s aleatórios, envia ao próximo, até cobrir os grupos ativos (≤15) → cada envio grava `wa_sent_jobs`, marca job `sent` e oferta `sent` → planilha espelho reflete o status no próximo sync.
2. **Fluxo de Exceção — worker cai no meio do burst:** jobs restantes permanecem `queued`; job em voo fica `sending` → no slot seguinte o reaper devolve-o a `queued` (`attempts+1`) → reenvio consulta `wa_sent_jobs`: se já entregue, worker responde `deduped:true` e o job é marcado `sent` sem duplicar mensagem; após 3 tentativas reais, `failed` terminal com erro legível.
3. **Fluxo de Exceção — queda de conexão WA:** transição gera evento append-only → admin abre `/dashboard/bot` e vê o histórico (quando caiu, motivo, quantas quedas na semana) sem tocar no banco.
