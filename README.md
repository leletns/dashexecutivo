# Painel executivo · Ludymilla

MVP de SaaS de Dashboard Executivo construído em Next.js 14 (App Router), Tailwind, Shadcn UI, Recharts, framer-motion e processamento de documentos via @anthropic-ai/sdk.

## Setup

```bash
pnpm install   # ou: npm install / yarn install
cp .env.local.example .env.local
# edite .env.local e informe ANTHROPIC_API_KEY
pnpm dev
```

A aplicação estará em `http://localhost:3000` e redireciona para `/dashboard`.

## Estrutura

- `app/(app)/dashboard` — visão geral exclusiva da CEO (cards editáveis, gráfico, upload, conciliação).
- `app/(app)/{administrativo,financeiro,juridico,contabil,marketing,eventos}` — áreas do menu.
- `app/api/process` — recebe PDF/XLSX/CSV, extrai texto e devolve indicadores em JSON.
- `app/api/chat` — conselheiro executivo com contexto dos números do painel.
- `components/layout` — Sidebar, Header, alternância de tema, calculadora.
- `components/dashboard` — cards editáveis, gráfico, upload, anexos, conciliação, suporte (FAB).

## Decisões de design

- Visual premium, glassmorphism sutil, paleta neutra com alto contraste.
- Capitalização em português (apenas a primeira letra em maiúscula).
- Sem terminologia técnica de IA na interface; o usuário lê "Processando documento", "Auto-conciliação" e "Suporte executivo".
# dashexecutivo
