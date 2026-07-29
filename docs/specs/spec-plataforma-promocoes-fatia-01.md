# Spec Técnica: Fatia 01 - Scaffold, Auth Supabase e Shell do Dashboard

> **Feature:** `plataforma-promocoes` | **Status:** `CONCLUÍDO` | **Data:** 2026-07-29

<!-- Arquivo: docs/specs/spec-plataforma-promocoes-fatia-01.md -->

## 1. Escopo & Objetivos da Fatia
- **Descrição da entrega:** Bootstrap greenfield do monorepo/app: Next.js (App Router) + TypeScript + React + Tailwind CSS v4; Supabase Auth (single-tenant admin) + client DB; middleware protege `/dashboard/*`; shell UI (Sidebar + Header) no espírito `chatbotrdo` (`DashboardShell`, nav: Overview, Grupos, Ofertas, Links, Disparos); páginas placeholder; schema SQL inicial (`profiles`); env example; deploy-ready Vercel.
- **Limites da fatia:** Sem Baileys, scrap, afiliados ou fila. Só auth + shell + placeholders. Poucos arquivos de domínio de negócio.

## 2. Descoberta & Mapeamento de Símbolos
- **Arquivos a alterar/criar:**
  - `[NEW]` `package.json`, `pnpm-lock.yaml` (ou npm), `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.*`
  - `[NEW]` `src/app/layout.tsx`, `src/app/page.tsx` (redirect login/dashboard)
  - `[NEW]` `src/app/login/page.tsx`
  - `[NEW]` `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/dashboard/page.tsx`
  - `[NEW]` `src/app/(dashboard)/dashboard/grupos/page.tsx`, `ofertas/page.tsx`, `links/page.tsx`, `disparos/page.tsx`
  - `[NEW]` `src/components/DashboardShell.tsx`, `Sidebar.tsx`, `Header.tsx`
  - `[NEW]` `src/components/ui/*` (mínimo: Button, Input, Card — shadcn-like ou nativo TW)
  - `[NEW]` `src/lib/supabase/client.ts`, `server.ts`, `middleware.ts`
  - `[NEW]` `src/middleware.ts` (guard sessão)
  - `[NEW]` `supabase/migrations/001_profiles.sql` (ou `supabase/schema.sql`)
  - `[NEW]` `.env.example`, `.gitignore`, `README.md` mínimo
- **Símbolos e funções afetadas:**
  - `createClient` (browser/server Supabase)
  - `updateSession` / middleware matcher
  - `DashboardShell`, `Sidebar`, `Header`
  - `profiles` table / RLS single-admin

## 3. Contratos de Dados & API (Backend)
- **Modelos / Schemas de Banco:**
  ```sql
  -- profiles: 1:1 com auth.users (single-tenant admin)
  create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    display_name text,
    role text not null default 'admin' check (role = 'admin'),
    created_at timestamptz not null default now()
  );
  -- RLS: authenticated user reads/updates only own row
  ```
- **Endpoints / Server Actions / Funções de Serviço:**
  - Login via Supabase Auth (`signInWithPassword` ou magic link — preferir e-mail+senha no MVP).
  - `signOut()` server action ou route handler.
  - Sem APIs de domínio nesta fatia.
  - Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only, se seed).

## 4. Interface do Usuário & UX (Frontend)
- **Componentes UI:**
  - Login: form e-mail/senha, erro claro, CTA.
  - Shell: sidebar fixa (nav Overview/Grupos/Ofertas/Links/Disparos), header com e-mail + logout.
  - Placeholders: card “Em breve” por rota.
  - Referência visual: `chatbotrdo` `DashboardShell` / `Sidebar` / `Header` (layout, não copiar domínio RDO).
- **Estados Visuais:** Loading auth; erro credencial inválida; empty placeholders.
- **Acessibilidade:** labels nos inputs; foco visível; contraste TW defaults.

## 5. Critérios de Aceite & Plano de Testes (MANDATÓRIO)
- [ ] **Teste Unitário/Integração:** `tests/auth-guard.test.ts` (ou vitest) — rotas dashboard exigem sessão; redirect unauth.
- [ ] **Integração Backend + UI:** login real (ou mock Supabase) → shell renderiza nav; logout limpa sessão.
- [ ] **Validação Estrita:** `tsc --noEmit`, `lint`, `test` verdes; build Next ok.
- [ ] **Aceite:** admin logado vê 5 rotas placeholder; visitante não acessa `/dashboard/*`.

## 6. Checkpoint de Execução
- **Status:** `CONCLUÍDO`
- **Concluído:** scaffold Next+TW4, Supabase SSR auth, shell Sidebar/Header, placeholders 5 rotas, migration profiles, resolveAuthRedirect + 4 testes, typecheck/lint/test/build verdes
- **Pendente:** —
- **Próximo comando:** `/sdd-implement`
