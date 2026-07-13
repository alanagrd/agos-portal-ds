import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getResend, EMAIL_FROM } from '@/lib/resend'
import { templateLembretePendente } from '@/lib/email-templates'

const SP_LOCALE = 'pt-BR'
const SP_TZ = 'America/Sao_Paulo'

function diaSP(date: Date): string {
  return date.toLocaleDateString(SP_LOCALE, { timeZone: SP_TZ })
}

function diasEntre(inicio: Date, fim: Date): number {
  return Math.floor((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()
  const hoje = new Date()
  const hojeStr = diaSP(hoje)

  const { data: dsList, error } = await supabase
    .from('descricoes_servico')
    .select('*, obra:obras(*)')
    .eq('status', 'Aguardando aprovação da obra')

  if (error) {
    console.error('[cron/lembrete-aprovacao] Erro ao buscar DSs:', error)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  let enviados = 0
  let pulados = 0
  let falhas = 0

  const resultados = await Promise.allSettled(
    (dsList ?? []).map(async (ds: any) => {
      const { data: entradas } = await supabase
        .from('historico_acoes')
        .select('acao, criado_em')
        .eq('ds_id', ds.id)
        .or('acao.ilike.%Link enviado para%,acao.ilike.Lembrete de aprovação pendente enviado%')
        .order('criado_em', { ascending: true })

      if (!entradas || entradas.length === 0) {
        pulados++
        return
      }

      const maisRecente = entradas[entradas.length - 1]
      if (diaSP(new Date(maisRecente.criado_em)) === hojeStr) {
        pulados++
        return
      }

      const primeiraEntrada = entradas[0]
      const diasPendente = diasEntre(new Date(primeiraEntrada.criado_em), hoje)

      const link = `${process.env.NEXT_PUBLIC_APP_URL}/aprovar/${ds.token_aprovacao}`
      const { subject, html } = templateLembretePendente({
        obraNome: ds.obra?.nome ?? ds.obra_id,
        mesReferencia: ds.mes_referencia,
        diasPendente,
        link,
      })

      const emailsCopia: string[] = ds.obra?.emails_copia ?? []

      const { error: emailError } = await getResend().emails.send({
        from: EMAIL_FROM,
        to: ds.obra?.responsavel_email,
        cc: emailsCopia.length ? emailsCopia : undefined,
        subject,
        html,
      })

      if (emailError) {
        console.error(`[cron/lembrete-aprovacao] Resend error para DS ${ds.id}:`, emailError)
        falhas++
        return
      }

      await supabase.from('historico_acoes').insert({
        ds_id: ds.id,
        acao: `Lembrete de aprovação pendente enviado (dia ${diasPendente} sem retorno).`,
        autor: 'Sistema',
        tipo: 'sistema',
      })

      enviados++
    })
  )

  resultados.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[cron/lembrete-aprovacao] Falha inesperada na DS ${i}:`, r.reason)
      falhas++
    }
  })

  return NextResponse.json({ total: dsList?.length ?? 0, enviados, pulados, falhas })
}
