# Khaos — Setup

## Pré-requisitos

- Node.js 18+ e npm
- Conta no Supabase (região São Paulo)
- [Supabase CLI](https://supabase.com/docs/guides/cli) para migrações e Edge Functions
- Uma chave de API da Anthropic

## Instalação

```bash
git clone <repo>
cd khaos
npm install
cp .env.example .env
```

Preencha `.env` (ver `.env.example` para os comentários de cada variável):

```
VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key legada, formato JWT>
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key nova>
VITE_LLM_MODEL=claude-sonnet-5
VITE_APP_PASSWORD_HASH=
VITE_USE_HTTPS=
```

- `VITE_SUPABASE_PUBLISHABLE_KEY` precisa ser **igual** à
  `SUPABASE_ANON_KEY` que a Edge Function `anthropic-proxy` recebe
  automaticamente do Supabase — é o que autentica o app a chamar o proxy do
  Claude. Ver o comentário em `src/lib/chat/client.ts` se isso começar a
  dar 401 sem motivo aparente.
- `VITE_APP_PASSWORD_HASH` habilita um gate de senha simples
  (`src/components/layout/PasswordGate.tsx`); deixe vazio em desenvolvimento.
  Para gerar o hash: `echo -n "sua-senha" | sha256sum`.
- `VITE_USE_HTTPS` — o dev server roda em HTTPS por padrão (certificado
  local via mkcert); defina `false` para HTTP puro.

Nenhuma chave de IA vai no `.env` do frontend — `ANTHROPIC_API_KEY` fica
apenas do lado do servidor, como secret da Edge Function (ver abaixo).

## Banco de dados

O projeto Supabase já existente é a fonte de verdade; para recriar do zero:

1. Crie um projeto no Supabase (região South America - São Paulo)
2. Rode as migrações: `npm run db:push` (equivalente a
   `supabase db push --linked`)
3. Ou aplique `schema.sql` diretamente pelo SQL Editor

Para atualizar `schema.sql` a partir do banco vivo (depois de rodar
migrações novas):

```bash
npm run db:dump   # supabase db dump --linked --schema public -f schema.sql
                   # + gen:edge-schema (regenera o schema embutido do bot do Telegram)
```

**Nunca cole uma connection string com senha, ou qualquer outra credencial,
em um arquivo de documentação.** Se precisar de acesso direto ao Postgres,
gere/rotacione a senha pelo painel do Supabase e guarde-a num gerenciador de
segredos, não em texto no repositório ou na vault de notas.

## Rodando o app

```bash
npm run dev        # vite dev server
npm run build      # build de produção
npm run preview    # preview do build
npm run typecheck
npm run lint
npm run format
```

## Deploy

- **Frontend** — Vercel. Push em `main` já dispara o deploy automático (ver
  `vercel.json` — SPA rewrite para `index.html`). Sem etapa de deploy manual
  documentada além disso.
- **Edge Functions** — deploy manual via Supabase CLI:

```bash
supabase functions deploy anthropic-proxy
supabase functions deploy telegram-bot
supabase functions deploy telegram-notify
supabase functions deploy oversight-agent
```

- **Secrets das Edge Functions** (nunca em `.env` do frontend):

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set TELEGRAM_BOT_TOKEN=...
supabase secrets set TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)
supabase secrets set TELEGRAM_ALLOWED_CHAT_IDS=<chat id>
supabase secrets set KHAOS_CRON_SECRET=$(openssl rand -hex 32)
supabase secrets set OVERSIGHT_LLM_MODEL=claude-haiku-4-5   # opcional, é o default
```

Setup completo do bot do Telegram (webhook, allowlist, cron do digest e dos
lembretes) está em
`supabase/functions/telegram-bot/README.md`. Setup do cron do oversight
agent está comentado no topo de
`supabase/functions/oversight-agent/index.ts`.

- **Notificação de release** — `.github/workflows/bump-version.yml` sobe a
  versão do `package.json` a cada merge em `main` e, depois que o deploy na
  Vercel fica pronto, chama `telegram-notify` com o job `deploy`. Requer os
  secrets do GitHub Actions `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`,
  `KHAOS_CRON_SECRET`, `SUPABASE_FUNCTIONS_URL` (e `VERCEL_TEAM_ID` se o
  projeto estiver sob um time).

## Testando o chat

Com o app rodando (`npm run dev`), abra a página do Assistant e converse
normalmente — não há endpoint HTTP próprio para testar via `curl`; toda
chamada ao modelo sai do navegador (ou da Edge Function do Telegram) direto
para `anthropic-proxy`.
