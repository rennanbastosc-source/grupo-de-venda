# MVP Scope & Slice Breakdown: Conexão Baileys no Dashboard

## 1. Escopo de Entrega (Must-Have vs. Nice-To-Have)

### 🔴 Must-Have (Obrigatório para o MVP)
- Worker Baileys: socket, pairing code + QR, reconexão automática, logout/limpeza de sessão
- Persistência de credenciais (Supabase/Postgres cifrado preferencial; 1 sessão/deploy)
- Mailbox/API Next ↔ worker: pedido de pareamento, código, QR, status, reconnect, disconnect
- UI dashboard: telefone → código + QR → status ao vivo → número conectado → desconectar + reconectar
- Auth admin (já existente); secrets só server/worker
- Gate: módulos de disparo só com status `connected`

### 🟡 Nice-To-Have (Postergado)
- Multi-número / multi-worker
- Histórico detalhado de eventos de conexão com retenção longa
- Push/alertas externos (Telegram/e-mail) quando cair
- QR download/export
- Migração para WhatsApp Cloud API

## 2. Fatiamento de Entregas (Slices)

### 📦 Fatia 01: Worker — socket Baileys, auth persistida, status/código/QR
- **Objetivo:** Evoluir o worker atual (`worker/src/baileys`) com o ciclo de vida do frota-impacto: gate de sessão por `account`, pedido de pareamento por telefone, `requestPairingCode`, publicação de código (TTL) + QR (TTL), reconexão com backoff e **reconnect imediato** em `restartRequired` (515), limpeza em `loggedOut`, auth state em memória entre restarts de pareamento. Persistência de credenciais (Postgres/Supabase cifrado ou caminho equivalente no stack atual). Endpoints/handlers internos do worker para status, pair, reconnect, logout. Testes unitários do ciclo de conexão (mocks).
- **Dependências:** Nenhuma (worker isolado; schema sessão se necessário)
- **Status:** `PENDENTE`

### 📦 Fatia 02: Orquestração Next ↔ worker + tela dashboard de pareamento
- **Objetivo:** Camada no app Next (server actions ou rotas API autenticadas) consumindo worker/mailbox: solicitar pareamento (phone), ler status + código + QR, polling na UI. Página dashboard (Bot/conexão): formulário telefone, exibição código 8 dígitos + instruções, QR image, badges de status, número conectado quando `open`. Proteção por sessão Supabase. Testes de API/UI smoke do fluxo de pedido.
- **Dependências:** Fatia 01
- **Status:** `PENDENTE`

### 📦 Fatia 03: Desconectar, reconectar manual, hardening e contrato com disparos
- **Objetivo:** Botão Desconectar (clear auth + status) e botão Reconectar no painel; reconexão automática validada; estados de erro/worker offline claros; garantir que disparo/API de envio recusa com mensagem explícita se não `connected`; env vars documentadas (`WHATSAPP_SESSION_KEY` ou equivalente, `WORKER_*`); smoke E2E ou teste de integração do happy path (mock worker ok). Polimento UX e edge cases (código/QR expirados, logout no aparelho).
- **Dependências:** Fatia 02
- **Status:** `PENDENTE`

## 3. Invariantes & Riscos Identificados
- **Invariante 1:** 1 sessão Baileys por deploy no MVP; sem scale horizontal do worker.
- **Invariante 2:** Pareamento e validação **somente** via dashboard (sem depender de QR no terminal).
- **Invariante 3:** Credenciais de sessão e secrets nunca no client; cifra em repouso se no DB.
- **Invariante 4:** Gate de sessão estabelecida usa `account` (não `me`/`registered` sozinhos) — lição do frota-impacto.
- **Invariante 5:** Disparo exige status `connected`.
- **Risco 1:** Ban/instabilidade WhatsApp. → Rate limits já da plataforma; reconexão + status claro.
- **Risco 2:** Race pareamento (`restartRequired` + releitura de auth). → Manter auth state em memória no restart de pair-success.
- **Risco 3:** Worker offline / `WORKER_BASE_URL` local. → UI de erro; deploy Render quando for a hora (fora desta feature se só local).
- **Risco 4:** Drift multi-file atual vs Postgres cifrado. → Preferir Postgres/Supabase alinhado ao frota; multi-file só dev local se necessário.

## 4. Critério de “MVP fechado”
Admin (e sócio) consegue no painel: informar número → ver código + QR → conectar no aparelho → ver conectado + número → desconectar e reconectar → após restart do worker, sessão volta sem novo pareamento (se não houve logout).
