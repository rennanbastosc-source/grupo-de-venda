# PRD: Conexão Baileys no Dashboard

## 1. Resumo Executivo & Problema
- **Problema:** O dashboard está “virgem” para operação do disparador WhatsApp. O worker Baileys atual sobe sozinho com `useMultiFileAuthState` em disco e expõe QR em memória, sem fluxo completo de pareamento controlado pelo painel (telefone → código/QR → conectar no aparelho → sucesso). Sem isso, disparos e o restante da plataforma não viram operação real.
- **Proposta de Valor:** Trazer o padrão de conexão Baileys validado no `frota-impacto` (pareamento por número + código 8 dígitos, status em mailbox, reconexão, sessão estável) para o `grupo-de-venda`, com **todo o fluxo de validação no dashboard**: operador informa o WhatsApp disparador, recebe código e QR no painel, confirma no aparelho, vê sucesso e gerencia reconexão/desconexão sem SSH/CLI.
- **Público-Alvo / Personas:**
  - **Admin (você):** conecta/desconecta o número disparador, monitora status, reconecta se cair.
  - **Sócio (+1):** mesmo acesso admin single-tenant; sem multi-tenant no MVP.
  - **Membros de grupos:** não usam o painel; só recebem disparos quando a sessão estiver `connected`.

## 2. Requisitos Funcionais (RF)
- [ ] **RF-01:** Tela no dashboard (rota Bot / conexão WA) para gerenciar a sessão Baileys do disparador.
- [ ] **RF-02:** Input do número WhatsApp a integrar (E.164 / BR normalizado) e ação “Gerar código / parear”.
- [ ] **RF-03:** Exibir no dashboard o **código de pareamento de 8 dígitos** com instruções (Dispositivos conectados → Conectar com número).
- [ ] **RF-04:** Exibir **QR** no dashboard (além do código), com TTL/refresh coerente com o Baileys.
- [ ] **RF-05:** Status ao vivo: aguardando pareamento · conectando · conectado · desconectado · sessão encerrada no aparelho · erro.
- [ ] **RF-06:** Quando conectado, mostrar o **número conectado** (mascarado ou parcial ok).
- [ ] **RF-07:** Botão **Desconectar / limpar sessão** no painel (logout + limpeza de credenciais; exige novo pareamento).
- [ ] **RF-08:** **Reconexão automática** se o worker/socket cair (exceto logout explícito); botão **Reconectar** manual no painel.
- [ ] **RF-09:** Worker Baileys long-running (1 instância por deploy); dashboard (Vercel) orquestra via API/mailbox — não roda socket no serverless.
- [ ] **RF-10:** Persistência de credenciais de sessão (Supabase/Postgres cifrado preferencial, alinhado ao padrão frota-impacto; multi-file só como fallback local).
- [ ] **RF-11:** Só admin autenticado (Supabase Auth) acessa ações de conexão; secrets (`WORKER_API_SECRET`, chave de cifra de sessão) nunca no client.
- [ ] **RF-12:** Disparos/outros módulos que dependem de WA **pausam ou falham de forma clara** se status ≠ `connected` (contrato já existente da plataforma).

## 3. Requisitos Não-Funcionais (RNF) & Restrições
- **Stack:** Next.js + TS + React + Tailwind v4 · Vercel (dashboard) · Supabase Auth/DB · worker Baileys long-running (Render/VPS).
- **WhatsApp:** Baileys (não oficial). 1 sessão por deploy no MVP; expansão multi-número só no futuro.
- **Referência de implementação:** `frota-impacto` — socket-manager, auth-state Postgres, mailbox SystemConfig, pairing code + QR, gate `account` (não `me`), restartRequired sem backoff.
- **Segurança:** service role / worker secret só server-side; credenciais de sessão cifradas em repouso; audit mínimo (quem pediu pareamento / desconectou).
- **UX:** desktop Chrome/Firefox; polling curto no painel enquanto não conectado.
- **Infra:** preferir CLI (Vercel/Supabase) para env e deploy; `WORKER_BASE_URL` aponta ao worker prod quando existir.

## 4. Métricas de Sucesso (KPIs)
- Pareamento completo **100% pelo dashboard** (sem CLI/QR no terminal).
- Após conectado, sessão sobrevive a restart do worker (credenciais persistidas) sem novo pareamento.
- Tempo do pedido de pareamento até código/QR visível no painel **&lt; ~15s** com worker saudável.
- Operador consegue desconectar e reconectar pelo painel em um fluxo sem suporte técnico.

## 5. Casos de Uso & Fluxos do Usuário
1. **Happy path — pareamento:**
   - Admin abre Bot no dashboard → digita WhatsApp → “Gerar código” → painel mostra código 8 dígitos + QR + status “aguardando” → no celular: Dispositivos conectados → Conectar com número/QR → status vira “conectado” + número exibido → fim.
2. **Reconexão automática:**
   - Socket cai (rede/restart) sem logout → worker reconecta com credenciais salvas → status volta a “conectado”; se demorar, admin usa “Reconectar”.
3. **Desconectar / trocar número:**
   - Admin clica Desconectar no painel → sessão limpa → status “desconectado/logged_out” → novo número + pareamento.
4. **Logout pelo aparelho:**
   - Usuário remove dispositivo no WhatsApp → worker detecta `loggedOut` → limpa credenciais → painel mostra “sessão encerrada” e pede novo pareamento.
5. **Exceção — worker offline:**
   - Dashboard mostra erro/desconectado e não finge código válido; admin sobe worker e usa Reconectar.

## 6. Fora de Escopo (MVP)
- Multi-número / multi-tenant / white-label.
- WhatsApp Cloud API oficial.
- Envio de campanhas nesta feature (já coberto por plataforma-promocoes; aqui só **conexão** estável).
- QR-only sem código (código **e** QR são must-have).
- Auto-scale horizontal de workers (invariante: 1 instância).
