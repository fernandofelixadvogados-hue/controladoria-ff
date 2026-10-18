import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getTicketMessages } from '@/lib/digisac'

export const dynamic = 'force-dynamic'

// Hardcoded collaborator name ↔ Digisac userId for labeling messages
const COLLABORATOR_IDS: Record<string, string> = {
  'Ana Carolina':  '14296f09-a09d-47a0-b185-c282e2ae1264',
  'Pedro Lucas':   '7d8e720c-01c9-4a90-a390-b38ec81a0f2d',
  'Yasmim Rocha':  'dfc3d50d-95ce-49ed-bf82-34ea1e5c30fe',
  'Karla Freitas': 'da2871cb-8690-4aa7-b9b3-2fd01b653ffe',
  'Fernando Felix':'d475a8f3-f33a-4c1c-bce2-cb97e00c21e5',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  })
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY não configurada no .env.local' },
      { status: 503 }
    )
  }

  const body = await req.json()
  const { ticketId, contactName, collaboratorName } = body as {
    ticketId: string
    contactName: string
    collaboratorName: string
  }

  if (!ticketId || !collaboratorName) {
    return NextResponse.json({ error: 'ticketId e collaboratorName são obrigatórios' }, { status: 400 })
  }

  // Fetch ticket messages
  let messages
  try {
    messages = await getTicketMessages(ticketId)
  } catch (e) {
    return NextResponse.json(
      { error: `Erro ao buscar mensagens: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    )
  }

  if (messages.length === 0) {
    return NextResponse.json({ evaluation: 'Nenhuma mensagem de chat encontrada neste atendimento.' })
  }

  const collaboratorDigisacId = COLLABORATOR_IDS[collaboratorName] ?? ''

  // Build transcript
  const transcript = messages
    .filter((m) => m.text && m.text.trim())
    .map((m) => {
      const who = m.isFromMe || m.userId === collaboratorDigisacId
        ? collaboratorName
        : (contactName ?? 'Cliente')
      return `[${formatTime(m.createdAt)}] ${who}: ${m.text}`
    })
    .join('\n')

  if (!transcript.trim()) {
    return NextResponse.json({ evaluation: 'Atendimento sem mensagens de texto (apenas mídia/sistema).' })
  }

  // Call Claude for evaluation
  const anthropic = new Anthropic({ apiKey })

  const prompt = `Você é um avaliador especializado em qualidade de atendimento jurídico.

Avalie o atendimento abaixo prestado por **${collaboratorName}** a **${contactName ?? 'Cliente'}** no WhatsApp (via Digisac). Este é um atendimento a um **cliente** (já contratou o escritório, não é lead).

**Critérios de avaliação:**
1. **Cordialidade e tom** — educado, empático, profissional?
2. **Clareza** — explicação compreensível para leigo, sem juridiquês desnecessário?
3. **Agilidade** — gaps longos entre mensagem do cliente e resposta?
4. **Resolução** — dúvida/pedido foi resolvido ou encaminhado adequadamente?
5. **Proatividade** — antecipou dúvidas, deu prazos, pediu documentos que faltavam?

**Transcrição do atendimento:**
${transcript}

**Instruções:**
- Avaliação qualitativa em texto (sem notas numéricas)
- Formato markdown compacto: Resumo · Pontos positivos · Pontos de atenção · Avaliação geral
- Seja direto e específico, citando trechos reais quando relevante
- Se o atendimento foi bom, diga isso claramente. Se foi ruim, aponte o problema sem eufemismos.
- Máximo 250 palavras`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const evaluation = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    return NextResponse.json({ evaluation })
  } catch (e) {
    return NextResponse.json(
      { error: `Erro na avaliação IA: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    )
  }
}
