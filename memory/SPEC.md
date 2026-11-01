# RPG Barbearia — SPEC

Agendamento online para barbearia (sem pagamentos). Stack: FastAPI + Mongo (backend/), Vite React TS (frontend/).
Fuso: `APP_TZ=America/Sao_Paulo` — "hoje" sempre vem do servidor (`GET /api/public/info`).

## Ambientes
- **Cliente** `/` — wizard 5 etapas: barbeiro → serviço → data/horário (slots livres de 30 min) → nome + WhatsApp → resumo/confirmar.
- **Barbeiro** `/barbeiro` — login; abas Hoje / Próximos / Calendário (dia/semana/mês) / Histórico / Meus horários (barbeiro altera início/término de cada dia de trabalho e marca dias de folga pessoais via PUT /api/barber/schedule; pausa e dias habilitados continuam com o admin); concluir/cancelar. Vê SÓ os próprios agendamentos.
- **Admin** `/admin` — Visão geral (KPIs + por barbeiro no mês), Agendamentos (filtros barbeiro/data/status, criar manual, alterar, cancelar, concluir), Barbeiros (CRUD, ativar/desativar, horário semanal + intervalo, dias de folga, login), Serviços (CRUD, ativar), Bloqueios de horário, Lembretes (log + "Processar agora").
- Login único `/login` → redireciona por papel.

## Regras
- Todo agendamento dura 30 min (decisão do usuário; serviços NÃO têm duração configurável).
- Slots = horário de trabalho do dia − intervalo − agendamentos não cancelados − bloqueios − horários passados. Até 60 dias à frente.
- Conflito impedido por validação + índice único `slot_key` (`barber|date|time`; cancelado vira `x|id`) → 409.
- Status: scheduled | completed | cancelled.

## Lembretes WhatsApp (Meta Cloud API)
- Ao criar: 2 docs em `reminders` (6h e 1h antes, `send_at` UTC). Cancelar/concluir → pendentes viram cancelled; alterar → cancela e recria.
- Cron `.emergent/crons.yml` a cada 15 min → `POST /api/cron/reminders` (Bearer WEBHOOK_CRON_SECRET) → `process_due_reminders()`.
- **SIMULADO** enquanto `WHATSAPP_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID` não existirem no backend/.env. Live envia template `WHATSAPP_TEMPLATE_NAME` (pt_BR) com params: nome, data, hora, barbeiro, serviço, barbearia.

## Auth / papéis
- Cookie httpOnly `rpg_session` (JWT HS256, 7d). `/api/auth/login|logout|me`.
- `admin` → `/api/admin/*`; `barber` → `/api/barber/*` (filtrado por barber_id; id alheio → 404). Público: `/api/public/*`.
- Admin cria barbeiro com e-mail + senha (sem auto-cadastro).

## Dados (Mongo)
users, barbers{schedule[7]{weekday 0=seg, enabled, start, end, break_start, break_end}, days_off[]}, services, appointments, blocks, reminders, clients, cron_runs.

## Seed (`python seed.py`)
Admin + 2 barbeiros (Roberto, Kauã; seg–sáb 09–19, pausa 12–13, domingo folga) + 5 serviços. Credenciais em memory/test_credentials.md.
