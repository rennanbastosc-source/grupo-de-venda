<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Infra preferência (obrigatório)

- **Vercel** e **Neon**: sempre via **CLI** (`vercel`, `neonctl`/`neon`) para deploy, env, logs, DB e troubleshooting.
- Nunca orientar só painel web se o CLI resolver.
- Auth interativa: expor URL/código ao usuário e aguardar.
