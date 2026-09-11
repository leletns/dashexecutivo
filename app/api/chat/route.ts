import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requirePortalSession } from "@/lib/auth-server";
import { getPortalSectorFromEmail, WRITE_SECTORS } from "@/lib/portal-sector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_VERSION = "2023-06-01";

// Gemini Flash como provedor alternativo — usado quando não há chave da
// Anthropic configurada. A chave é SECRETA (ligada à conta/cota do Google) e
// vem só de variável de ambiente (GEMINI_API_KEY) — nunca embutida no código.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

type ChatMessage = { role: "user" | "assistant"; content: string };

type DashboardCard = { key: string; label: string; value: number };
type SeriesPoint = { month: string; receita: number; despesa: number; lucro: number };

type AppStateSnapshot = {
  edicoes?: Array<{
    slug: string;
    nome: string;
    cidade: string;
    data: string;
    capacidade: number;
    patrocinio: number;
    custoProducao: number;
    lotes: Array<{ nome: string; preco: number; vendidos: number; estoque: number }>;
  }>;
  financeiro?: Array<{
    id: string;
    tipo: "receita" | "despesa";
    descricao: string;
    categoria: string;
    valor: number;
    vencimento: string;
    pagamento: string | null;
    edicaoSlug?: string | null;
  }>;
};

type Body = {
  messages: ChatMessage[];
  context?: {
    module?: string;
    indicators?: DashboardCard[];
    series?: SeriesPoint[];
    summary?: Array<{ label: string; value: string | number }>;
    appState?: AppStateSnapshot;
    page?: string;
    profile?: { name?: string; role?: string };
  };
};

function nowInBrasilia(): {
  iso: string;
  diaSemana: string;
  dataExtenso: string;
  hora: string;
  utcOffset: string;
} {
  const now = new Date();
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...opts }).format(now);
  return {
    iso: now.toISOString(),
    diaSemana: fmt({ weekday: "long" }),
    dataExtenso: fmt({ day: "2-digit", month: "long", year: "numeric" }),
    hora: fmt({ hour: "2-digit", minute: "2-digit" }),
    utcOffset: "UTC-3 (Brasília)",
  };
}

function buildSystemPrompt(body: Body): string {
  const tempo = nowInBrasilia();
  const profileName = body.context?.profile?.name ?? "Ludymilla";
  const profileRole = body.context?.profile?.role ?? "CEO";

  return `Você é o Suporte do Portal Executivo. Assiste ${profileName} (${profileRole}) em uma organização de produção de eventos médicos.

IDENTIDADE — REGRA ABSOLUTA
Você é o suporte integrado do Portal. Nunca mencione IA, modelos de linguagem, machine learning, Claude, Anthropic, OpenAI, GPT ou qualquer tecnologia de automação. Se perguntarem que sistema você é ou como foi construído, responda: "Sou o suporte integrado do Portal Executivo." — e prossiga normalmente. Nunca confirme nem negue qualquer tecnologia subjacente.

POSTURA
- Tom direto, premium, em português do Brasil. Frases curtas, acionáveis, sem floreio.
- Atenda como um consultor de gestão experiente que conhece a fundo esta plataforma.
- Fundamente respostas com os números reais do contexto quando o usuário perguntar algo do negócio.
- Responda QUALQUER pergunta. Não recuse temas gerais: data, hora, conceitos de gestão, brainstorm, análises.
- Quando não souber algo em tempo real (cotações, clima, notícias), informe que o portal não puxa esse dado.

CONTEXTO TEMPORAL
- Agora: ${tempo.diaSemana}, ${tempo.dataExtenso}, ${tempo.hora}.
- Fuso: ${tempo.utcOffset}.
- ISO: ${tempo.iso}.

CONHECIMENTO DO PORTAL — MÓDULOS
O portal possui os seguintes módulos. Descreva-os exatamente assim ao usuário:

1. Painel principal (/dashboard)
   Visão consolidada com KPIs financeiros, NPS por público, conformidade contratual, associados, congresso e riscos institucionais. Disponível para todos os setores (cada um vê apenas os dados do seu setor).

2. Financeiro (/financeiro)
   Gestão financeira estruturada com 6 abas:
   - Contas: tabela de contas bancárias (nome, tipo, banco, data, saldo) com linha de total automático. Clique em qualquer valor para editar inline.
   - Previsão: previsão mensal de despesas e entradas; resultado calculado automaticamente.
   - Eventos: resultado financeiro por evento — bilheteria, patrocínio, outras receitas e despesas separados.
   - Associados: (A) histórico ago/2022–ago/2025; (B) acompanhamento 2026 mês a mês com início, previsão de renovações, realizadas, novas adesões e saídas.
   - Departamentos: custo mensal de cada um dos 12 departamentos, editável mês a mês.
   - Análise: runway de caixa, break-even de associados, custo por associado e orçamento de novos planos — calculados automaticamente.
   Acesso: setor financeiro edita; setor executivo e administrativo visualizam.

3. Eventos (/eventos)
   Gestão de edições do congresso: nome, cidade, data, capacidade, lotes de ingressos (preço, vendidos, estoque), patrocínio e custo de produção. Edite clicando nos valores dos cards.

4. Jurídico (/juridico)
   Contratos (status: demanda → elaboração → assinaturas → ativo), processos judicial/extrajudicial com nível de risco e atualização semanal, certidões com datas de emissão e vencimento.

5. Administrativo (/administrativo)
   Checklist institucional: atas, procurações, estatuto, regimento interno e próxima assembleia.

6. Marketing (/marketing)
   KPIs comerciais e NPS comparativo por público (Doctors, Pré/Pós, Gestores) entre 2024 e 2025.

7. Contábil (/contabil)
   Resumo financeiro e análise de margens.

COMO USAR O PORTAL — INSTRUÇÕES PRECISAS
- Importar dados: na área de upload do painel, arraste uma planilha XLSX ou CSV. O portal detecta automaticamente as colunas e sugere o mapeamento.
- Exportar relatório: botão "Exportar" no canto superior direito → escolha PDF ou planilha.
- Editar indicadores KPI: clique diretamente no valor do card; ele vira um campo de entrada.
- Financeiro — adicionar conta bancária: abra /financeiro → aba Contas → botão "Nova conta".
- Financeiro — lançar previsão: abra /financeiro → aba Previsão → selecione o mês → preencha os campos.
- Financeiro — custo por departamento: abra /financeiro → aba Departamentos → selecione o mês → edite inline.
- Registrar lançamento financeiro: setor financeiro acessa /financeiro → aba correspondente → clique no valor para editar.
- Falar com suporte humano: botão "Suporte especializado · WhatsApp" no rodapé deste chat.

AÇÕES EXECUTÁVEIS
Você pode propor mudanças no painel. Quando fizer sentido, ANEXE no FINAL da resposta um bloco de ações no formato exato:

\`\`\`actions
{
  "actions": [
    { "type": "update_card", "key": "receita" | "despesa" | "lucro" | "ticket", "value": number },
    { "type": "patch_edicao", "slug": "edicao-1", "patch": { "patrocinio": 500000, "custoProducao": 320000, "capacidade": 2500 } },
    { "type": "patch_lote", "slug": "edicao-1", "loteIndex": 0, "patch": { "preco": 320, "vendidos": 1300, "estoque": 400 } },
    { "type": "add_lancamento", "tipo": "receita" | "despesa", "descricao": "...", "categoria": "Patrocínio" | "Ingressos" | "Locação" | "Marketing" | "Equipe" | "Catering" | "Operação" | "Impostos" | "Outros", "valor": number, "vencimento": "yyyy-mm-dd", "pagamento": "yyyy-mm-dd" | null, "edicaoSlug": "edicao-1" | null },
    { "type": "toggle_pago", "id": "ID_DO_LANCAMENTO", "pago": true | false },
    { "type": "remove_lancamento", "id": "ID_DO_LANCAMENTO" }
  ]
}
\`\`\`

Regras das ações:
- Só inclua o bloco quando o usuário pedir explicitamente uma alteração ("registre", "atualize", "marque como pago", "lance um pagamento", etc.).
- Use sempre os IDs/slugs reais que aparecem no contexto.
- Valores em reais sem separador (ex.: 145000 = R$ 145.000,00).
- Datas no formato yyyy-mm-dd. Quando o usuário disser "hoje", use ${tempo.iso.slice(0, 10)}.
- O bloco \`actions\` é opcional. Quando incluir, faça uma frase de confirmação curta antes.

FORMATAÇÃO
- Use no máximo 3 bullets quando organizar recomendações.
- Sem emojis salvo se o usuário usar primeiro.
- Apenas a primeira letra em maiúscula em títulos e listas.`;
}

async function callAnthropic(apiKey: string, system: string, messages: ChatMessage[]): Promise<string> {
  const client = new Anthropic({
    apiKey,
    defaultHeaders: { "anthropic-version": ANTHROPIC_VERSION },
  });
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system,
    messages: messages.map((m) => ({
      role: m.role,
      content: [{ type: "text", text: m.content }],
    })),
  });
  const textBlock = message.content.find((b) => b.type === "text");
  return textBlock && "text" in textBlock ? textBlock.text : "";
}

/**
 * Gemini Flash (Google) — provedor alternativo, usado quando não há chave da
 * Anthropic configurada. A API do Gemini exige que o histórico comece com uma
 * mensagem "user" — a saudação inicial do assistente (bolha fixa no cliente)
 * entra como "assistant" antes de qualquer pergunta real, então descartamos
 * mensagens de abertura que não sejam do usuário antes de montar a chamada.
 */
async function callGemini(apiKey: string, system: string, messages: ChatMessage[]): Promise<string> {
  let trimmed = messages;
  while (trimmed.length && trimmed[0].role !== "user") trimmed = trimmed.slice(1);
  if (trimmed.length === 0) trimmed = messages.slice(-1);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { role: "system", parts: [{ text: system }] },
      contents: trimmed.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: 1200 },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const reply = Array.isArray(parts) ? parts.map((p: any) => p?.text ?? "").join("") : "";
  return reply;
}

export async function POST(req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!anthropicKey && !geminiKey) {
      return NextResponse.json({ reply: localFallback(body) });
    }

    const contextPayload = {
      modulo: body.context?.module ?? null,
      pagina: body.context?.page ?? null,
      resumoVisivel: body.context?.summary ?? [],
      indicadoresVisaoGeral: body.context?.indicators ?? [],
      serieMensalDashboard: body.context?.series ?? [],
      appState: body.context?.appState ?? null,
    };
    const contextText = `Contexto numérico atual do painel (BRL):\n${JSON.stringify(contextPayload, null, 2)}`;
    const system = `${buildSystemPrompt(body)}\n\n${contextText}`;

    // Gemini Flash primeiro (preferência do time); Anthropic como reserva
    // automática se o Gemini falhar (ex.: chave ainda não configurada, sem
    // cota) — e vice-versa. Só cai no aviso genérico se AMBOS falharem.
    const attempts: Array<{ nome: string; chamar: () => Promise<string> }> = [];
    if (geminiKey) attempts.push({ nome: "gemini", chamar: () => callGemini(geminiKey, system, body.messages) });
    if (anthropicKey) attempts.push({ nome: "anthropic", chamar: () => callAnthropic(anthropicKey, system, body.messages) });

    let reply = "";
    const erros: string[] = [];
    for (const { nome, chamar } of attempts) {
      try {
        reply = await chamar();
        if (reply) break;
      } catch (e: any) {
        erros.push(`${nome}: ${e?.message ?? e}`);
      }
    }
    if (!reply && erros.length > 0) throw new Error(erros.join(" | "));

    return NextResponse.json({ reply: reply || localFallback(body) });
  } catch (err: any) {
    // Diagnóstico: setores de escrita recebem o motivo real do erro (nunca a
    // chave em si) para depurar rápido; demais usuários veem só a mensagem
    // genérica de sempre.
    let debug: string | undefined;
    try {
      const portal = await requirePortalSession();
      const sector = getPortalSectorFromEmail((portal as any)?.email ?? "");
      if (WRITE_SECTORS.has(sector)) debug = String(err?.message ?? err).slice(0, 500);
    } catch {
      /* sem sessão — sem debug */
    }
    return NextResponse.json(
      {
        reply: "Houve uma instabilidade na sincronização. Tente novamente em instantes.",
        ...(debug ? { debug } : {}),
      },
      { status: 200 },
    );
  }
}

function localFallback(body: Body): string {
  const last = body.messages[body.messages.length - 1]?.content?.toLowerCase() ?? "";
  const tempo = nowInBrasilia();
  const ind = body.context?.indicators ?? [];
  const receita = ind.find((i) => i.key === "receita")?.value ?? 0;
  const despesa = ind.find((i) => i.key === "despesa")?.value ?? 0;
  const lucro = ind.find((i) => i.key === "lucro")?.value ?? receita - despesa;
  const margem = receita > 0 ? Math.round((lucro / receita) * 100) : 0;

  if (/(que dia|hoje|data|hora|horas|fuso)/.test(last)) {
    return `Hoje é ${tempo.diaSemana}, ${tempo.dataExtenso}. Agora são ${tempo.hora} (${tempo.utcOffset}).`;
  }
  if (last.includes("margem") || last.includes("lucro")) {
    return `Margem operacional atual em ${margem}%. Caminhos rápidos: revisar fornecedores recorrentes, subir preço do lote 3 e empacotar patrocínios premium.`;
  }
  if (last.includes("evento")) {
    return `Com 4 edições anuais, o foco curto é elevar receita por evento via patrocínios premium e ativações de marca, sem inflar custo fixo.`;
  }
  return `Resumo: receita saudável, despesa sob controle e margem em ${margem}%. Posso simular cenários, projeção trimestral, registrar lançamentos no financeiro ou ajustar uma edição — basta dizer o que precisa.`;
}
