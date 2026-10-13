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
supabase functions deploy google-calendar-oauth
supabase functions deploy google-calendar-sync
```

- **Secrets das Edge Functions** (nunca em `.env` do frontend):

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set TELEGRAM_BOT_TOKEN=...
supabase secrets set TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)
supabase secrets set TELEGRAM_ALLOWED_CHAT_IDS=<chat id>
supabase secrets set KHAOS_CRON_SECRET=$(openssl rand -hex 32)
supabase secrets set OVERSIGHT_LLM_MODEL=claude-haiku-4-5   # opcional, é o default
supabase secrets set GOOGLE_CLIENT_ID=...
supabase secrets set GOOGLE_CLIENT_SECRET=...
supabase secrets set GOOGLE_OAUTH_REDIRECT_URI=https://<project-ref>.supabase.co/functions/v1/google-calendar-oauth
supabase secrets set GOOGLE_OAUTH_SETUP_SECRET=$(openssl rand -hex 32)
```

Setup completo do bot do Telegram (webhook, allowlist, cron do digest e dos
lembretes) está em
`supabase/functions/telegram-bot/README.md`. Setup do cron do oversight
agent está comentado no topo de
`supabase/functions/oversight-agent/index.ts`.

### Google Calendar

Setup completo (projeto no Google Cloud, OAuth client, escopo, secrets, cron)
está em `supabase/functions/google-calendar-sync/README.md`. Pontos que não
são opcionais:

- **Escopo mínimo:** `https://www.googleapis.com/auth/calendar.events` —
  leitura/escrita de eventos, sem gerência de calendários.
- **Publique a tela de consentimento OAuth** ("In Production", aceitando o
  aviso de app não verificado — é um app de usuário único). Enquanto ela
  ficar em "Testing", o Google expira o refresh token em **7 dias** e a
  sincronização para silenciosamente toda semana; depois de publicar, refaça
  o consentimento uma vez.
- A sincronização só toca `events.event_type = 'fixed'` — `scheduled` e
  `routine` nunca saem do Khaos, e nada vindo do Google se materializa como
  `scheduled`/`routine`. Ver `docs/backlog.md`, "Integração bidirecional com o
  Google Calendar (somente eventos fixed)", para a decisão e o raciocínio.

## Testando o chat

Com o app rodando (`npm run dev`), abra a página do Assistant e converse
normalmente — não há endpoint HTTP próprio para testar via `curl`; toda
chamada ao modelo sai do navegador (ou da Edge Function do Telegram) direto
para `anthropic-proxy`.
