# Khaos — Roadmap

## Concluído

- [x] Banco de dados PostgreSQL no Supabase, com RLS e triggers de moments/sequência
- [x] Frontend web (React + Vite) direto no Supabase, sem backend próprio — a antiga API FastAPI foi descontinuada
- [x] Agente de chat com Claude, tool use nativo via ferramentas genéricas (query/insert/update/delete/rpc)
- [x] Registro automático de moments via triggers do banco (created, due, estimate, priority, status, scheduled, started, stopped, target)
- [x] Sequences — tasks e sections dependentes, com desbloqueio automático (planning/waiting → todo)
- [x] Time tracking com `task_logs` (substituiu `time_entries`), incluindo logs em segundo plano (`background`) concorrentes com o log foreground
- [x] Routines — templates recorrentes que geram `events` do tipo `routine`
- [x] Work tags e moment tags — taxonomia extraída pela IA
- [x] Bot do Telegram com a mesma persona/tools do app (webhook reativo + digest matinal + lembretes agendados)
- [x] Histórico de chat compartilhado (`chat_history`) entre o app web e o Telegram
- [x] Oversight agent — análise em segundo plano de lotes de moments, lido pelo chat via `recall_oversight_notes`
- [x] Notificação automática de deploy (Vercel + GitHub Actions → Telegram)
- [x] PWA / gate de senha simples para acesso mobile
- [x] Dashboard com pills agrupadas (scheduled/marked/targeted/due), drag-and-drop e auto-refresh

## Em aberto / próximos passos plausíveis

Sem um roadmap versionado explícito no repo — a lista abaixo é inferida do
histórico de commits recente e deve ser tratada como um ponto de partida
para discussão, não um compromisso:

- Aprendizado histórico — tempo médio por `work_tag` a partir de
  `task_logs`, o que o usuário mais adia (via moments `due`), sugestão de
  estimativas
- Planejamento assistido — a IA sugerir ordem do dia respeitando
  `tasks_sequence`, `due`, `estimate` e eventos já marcados
- Comparação planejado × realizado (target/schedule vs. `task_logs`)
- Visualização de sequences como grafo de dependências
- Inbox de ideias soltas, promovidas a projeto/tarefa pela IA
- App mobile nativo (hoje só PWA)

## Notas históricas

O roadmap original (versão FastAPI + Gemini/DeepSeek) previa hospedar um
backend próprio em Railway/Fly.io e um "Sistema de Decisões" — ambos
descontinuados junto com a decisão de ir Supabase-direto. Referências a
"planos" (`plan` events) e o `event_type` `event`/`plan` da versão antiga
foram substituídas pelo enum atual `scheduled`/`fixed`/`routine`.
