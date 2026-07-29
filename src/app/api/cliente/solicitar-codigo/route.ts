import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomInt } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getResend, EMAIL_FROM } from '@/lib/resend'
import { templateCodigoVerificacao } from '@/lib/email-templates'

export const runtime = 'nodejs'

function hashCodigo(codigo: string, email: string): string {
  return createHash('sha256').update(`${codigo}:${email}`).digest('hex')
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const email = (body?.email ?? '').toLowerCase().trim()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ erro: 'email_invalido' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verifica vínculo com obras (filtro em JS — array contains do PostgREST é case-sensitive)
  const { data: obras } = await admin
    .from('obras')
    .select('id, responsavel_email, emails_copia')

  const temVinculo = (obras ?? []).some(o => {
    const resp = (o.responsavel_email ?? '').toLowerCase().trim()
    if (resp === email) return true
    return (o.emails_copia ?? []).some((e: string) => e.toLowerCase().trim() === email)
  })

  if (!temVinculo) {
    return NextResponse.json({ erro: 'email_nao_cadastrado' }, { status: 403 })
  }

  // Verifica se já existe usuário com esse e-mail
  const { data: { users } } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const jaExiste = users.some(u => (u.email ?? '').toLowerCase().trim() === email)
  if (jaExiste) {
    return NextResponse.json({ erro: 'ja_cadastrado' }, { status: 409 })
  }

  // Rate limit: 3+ códigos na última hora
  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: codigosRecentes } = await admin
    .from('codigos_verificacao')
    .select('id')
    .eq('email', email)
    .gte('criado_em', umaHoraAtras)

  if ((codigosRecentes ?? []).length >= 3) {
    return NextResponse.json({ erro: 'muitas_tentativas' }, { status: 429 })
  }

  // Invalida códigos anteriores não usados
  await admin
    .from('codigos_verificacao')
    .update({ usado: true })
    .eq('email', email)
    .eq('usado', false)

  // Gera código e grava apenas o hash — nunca o código em texto
  const codigo = String(randomInt(100000, 1000000))
  const codigoHash = hashCodigo(codigo, email)
  const expiraEm = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  const { data: inserido } = await admin
    .from('codigos_verificacao')
    .insert({ email, codigo_hash: codigoHash, expira_em: expiraEm })
    .select('id')
    .single()

  const { subject, html } = templateCodigoVerificacao({ codigo })
  const { error: emailError } = await getResend().emails.send({
    from: EMAIL_FROM,
    to: email,
    subject,
    html,
  })

  if (emailError) {
    console.error('[solicitar-codigo] Resend error:', emailError)
    if (inserido?.id) {
      await admin.from('codigos_verificacao').update({ usado: true }).eq('id', inserido.id)
    }
    return NextResponse.json({ erro: 'falha_envio' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
