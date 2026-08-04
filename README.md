# Legacy CRM

CRM web (mobile-friendly, instalável como PWA) para uma equipe de corretores de seguro de vida. Dois papéis —
**líder de unidade** (vê e edita tudo da equipe) e **consultor** (vê e edita só seus próprios dados) — compartilham
uma única base de dados real (Supabase/Postgres), com permissões impostas por Row Level Security e sincronização em
tempo real entre as visões.

Stack: React + TypeScript + Vite + Tailwind CSS + Supabase (Postgres, Auth, Row Level Security, Realtime, Edge
Functions) + PWA.

## Como funciona o modelo de permissões

- Todo dado (agendamentos, anamnese, tarefas, remuneração) fica em tabelas únicas e compartilhadas.
- O **líder de unidade** enxerga e edita os dados de todos os consultores.
- Cada **consultor** só enxerga e edita os próprios dados.
- Isso é garantido no banco por políticas de RLS (`supabase/migrations/0001_init.sql`) — não é apenas um filtro
  de tela, é uma regra de acesso real. Um consultor autenticado literalmente não recebe do banco linhas de outro
  consultor.
- Ações refletem imediatamente entre as visões via Supabase Realtime (mudanças em `appointments`, `tasks`,
  `reminders` e `profiles` disparam um refetch automático em todas as sessões conectadas).

## Configurando o backend (Supabase)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Rode a migration em `supabase/migrations/0001_init.sql` (SQL Editor do painel do Supabase, ou `supabase db push`
   se estiver usando a CLI).
3. Copie `.env.example` para `.env` e preencha com a URL e a `anon key` do seu projeto (Project Settings → API):
   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-anon-key
   ```
4. Deploy da Edge Function de convite (usada pelo líder para criar contas de consultor):
   ```
   supabase functions deploy invite-consultor
   ```
   Ela usa `SUPABASE_SERVICE_ROLE_KEY` automaticamente (variável já disponível para toda Edge Function no Supabase).
5. **Criando o primeiro usuário (líder de unidade)**: o primeiro usuário a se autenticar em um projeto Supabase
   novo vira automaticamente `lider` (ver trigger `handle_new_auth_user` na migration). Crie esse primeiro usuário
   manualmente pelo painel do Supabase (Authentication → Users → Add user, com e-mail e senha) ou habilite signup
   por e-mail/senha e cadastre-o pela tela de login do app.
6. A partir daí, o líder usa a tela **Equipe** dentro do app para convidar cada consultor (nome + e-mail). O
   Supabase envia um e-mail de convite com um link mágico; o consultor clica, cai em `/convite` e define a própria
   senha.

Sem o `.env` preenchido, o app roda normalmente (útil para revisar telas/layout) mas mostra um aviso de "backend
não conectado" na tela de login e nenhuma consulta ao banco funciona.

## Notificações push (alertas de agendamento no celular)

Cada consultor pode ativar, na tela Lembretes, um alerta que dispara no celular/navegador X minutos antes de cada
agendamento (ele escolhe quanto). Isso usa Web Push, então precisa de uma chave VAPID própria e de uma Edge
Function rodando de tempos em tempos:

1. Gere um par de chaves VAPID (só precisa fazer isso uma vez):
   ```
   npx web-push generate-vapid-keys
   ```
2. Adicione a chave pública ao `.env` (e nas variáveis de ambiente do Vercel):
   ```
   VITE_VAPID_PUBLIC_KEY=a-chave-publica-gerada
   ```
3. Configure os segredos da Edge Function (Project Settings → Edge Functions → Secrets, ou `supabase secrets set`):
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (ex: `mailto:voce@exemplo.com`) e `CRON_SECRET` (uma
   string aleatória qualquer, só pra travar quem pode chamar a função).
4. Deploy da função:
   ```
   supabase functions deploy send-appointment-reminders
   ```
5. Agende a execução: Database → Cron Jobs no painel do Supabase → novo job do tipo "HTTP Request", método POST,
   apontando para a URL da função, cabeçalho `x-cron-secret` com o mesmo valor do passo 3, rodando a cada minuto
   (`* * * * *`).

## Rodando localmente

```bash
npm install
npm run dev
```

## Build de produção

```bash
npm run build
npm run preview
```

## Estrutura

- `src/lib/` — regras de negócio puras (cálculo de KPIs/semáforo, PR Cadastro, árvore de perguntas da
  anamnese/DPS, formatação de moeda/data) — portadas do protótipo de referência `Legacy CRM.dc.html`.
- `src/context/` — `AuthContext` (sessão/perfil), `CrmContext` (dados + CRUD + realtime), `UiContext` (qual
  consultor está sendo visualizado, aba ativa, modal de tarefa).
- `src/components/agenda/` — visões Mês/Semana/Dia/Ano da agenda.
- `src/components/modals/` — novo agendamento (com anamnese completa), card do cliente, seletor de consultores,
  alerta de conflito, atribuição de tarefa ("Cutucão").
- `src/pages/` — Dashboard, Equipe, Minha remuneração, Lembretes, Login, aceitar convite.
- `supabase/migrations/` — schema + políticas de RLS.
- `supabase/functions/invite-consultor/` — Edge Function que o líder usa para convidar consultores.
- `supabase/functions/send-appointment-reminders/` — Edge Function (rodada por um Cron Job) que dispara as
  notificações push de agendamento.
- `src/sw.ts` — service worker customizado (recebe as notificações push e abre o app ao clicar nelas).

## Referência de design

O arquivo enviado `Legacy CRM.dc.html` (protótipo estático) e o `README` original do design foram usados como
especificação de comportamento e visual — recriados aqui em componentes React reais conectados a um backend de
verdade, não copiados literalmente.
