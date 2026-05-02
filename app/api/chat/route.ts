import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_VERSION = "2023-06-01";

type ChatMessage = { role: "user" | "assistant"; content: string };

type Body = {
  messages: ChatMessage[];
  context?: {
    indicators?: Array<{ key: string; label: string; value: number }>;
    series?: Array<{
      month: string;
      receita: number;
      despesa: number;
      lucro: number;
    }>;
  };
};

const SYSTEM_PROMPT = `Você é o conselheiro executivo da Ludymilla, CEO de uma empresa de produção de eventos.
Tom: direto, premium, em português do Brasil, frases curtas e acionáveis.
Não fale sobre IA, prompts ou modelos. Use vocabulário de negócios (margem, fluxo de caixa, ponto de equilíbrio, ticket médio, eficiência operacional).
Sempre que possível, fundamente as respostas nos números do contexto fornecido.
Quando sugerir ações, organize em até 3 bullets curtos.
Use a regra do português para títulos e listas: apenas a primeira letra em maiúscula.`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ reply: localFallback(body) });
    }

    const client = new Anthropic({
      apiKey,
      defaultHeaders: { "anthropic-version": ANTHROPIC_VERSION },
    });

    const contextText = body.context
      ? `Contexto numérico atual do painel (BRL):\n${JSON.stringify(body.context, null, 2)}`
      : "";

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: `${SYSTEM_PROMPT}\n\n${contextText}`,
      messages: body.messages.map((m) => ({
        role: m.role,
        content: [{ type: "text", text: m.content }],
      })),
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const reply = textBlock && "text" in textBlock ? textBlock.text : "";

    return NextResponse.json({ reply });
  } catch (err: any) {
    return NextResponse.json(
      { reply: "Houve uma instabilidade na sincronização. Tente novamente em instantes." },
      { status: 200 },
    );
  }
}

function localFallback(body: Body): string {
  const last = body.messages[body.messages.length - 1]?.content?.toLowerCase() ?? "";
  const ind = body.context?.indicators ?? [];
  const receita = ind.find((i) => i.key === "receita")?.value ?? 0;
  const despesa = ind.find((i) => i.key === "despesa")?.value ?? 0;
  const lucro = ind.find((i) => i.key === "lucro")?.value ?? receita - despesa;
  const margem = receita > 0 ? Math.round((lucro / receita) * 100) : 0;

  if (last.includes("margem") || last.includes("lucro")) {
    return `Sua margem operacional atual está em ${margem}%. Boas alavancas: revisar fornecedores recorrentes, aumentar preço do lote 3 e vender pacotes de patrocínio combinado.`;
  }
  if (last.includes("evento")) {
    return `Considerando 4 edições anuais e o ticket médio atual, o foco curto é elevar receita por evento via patrocínios premium e ativações de marca, sem inflar custos fixos.`;
  }
  return `Em uma frase: receita saudável, despesa sob controle e margem em ${margem}%. Posso simular cenários por evento, projeção trimestral ou ponto de equilíbrio — basta pedir.`;
}
