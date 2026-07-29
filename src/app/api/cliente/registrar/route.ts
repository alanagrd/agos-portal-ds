import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function hashCodigo(codigo: string, email: string): string {
  return createHash('sha256').update(`${codigo}:${email}`).digest('hex')
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const email = (body?.email ?? '').toLowerCase().trim()
  const codigo = String(body?.codigo ?? '').trim()
  const nome = String(body?.nome ?? '').trim()
  const senha = String(body?.senha ?? '')

  if (!email || !codigo || !nome || !senha) {
    return NextResponse.json({ erro: 'campos_obrigatorios' }, { status: 400 })
  }
  if (nome.length === 0) {
    return NextResponse.json({ erro: 'nome_obrigatorio' }, { status: 400 })
  }
  if (senha.length < 8) {
    return NextResponse.json({ erro: 'senha_fraca' }, { status: 400 })
  }

  const admin = createAdminClient()
  const agora = new Date().toISOString()

  // Busca código válido mais recente
  const { data: codigos } = await admin
    .from('codigos_verificacao')
    .select('id, codigo_hash, tentativas')
    .eq('email', email)
    .eq('usado', false)
    .gt('expira_em', agora)
    .order('criado_em', { ascending: false })
    .limit(1)

  const registro = codigos?.[0]
  if (!registro) {
    return NextResponse.json({ erro: 'codigo_invalido' }, { status: 400 })
  }
  if (registro.tentativas >= 5) {
    return NextResponse.json({ erro: 'muitas_tentativas' }, { status: 429 })
  }

  // Verifica hash
  if (registro.codigo_hash !== hashCodigo(codigo, email)) {
    await admin
      .from('codigos_verificacao')
      .update({ tentativas: registro.tentativas + 1 })
      .eq('id', registro.id)
    return NextResponse.json({ erro: 'codigo_invalido' }, { status: 400 })
  }

  // Revalida vínculo (o cadastro de obras pode ter mudado desde o pedido do código)
  const { data: obras } = await admin
    .from('obras')
    .select('id, responsavel_email, emails_copia')

  const obrasVinculadas = (obras ?? []).filter(o => {
    const resp = (o.responsavel_email ?? '').toLowerCase().trim()
    if (resp === email) return true
    return (o.emails_copia ?? []).some((e: string) => e.toLowerCase().trim() === email)
  })

  if (obrasVinculadas.length === 0) {
    return NextResponse.json({ erro: 'email_nao_cadastrado' }, { status: 403 })
  }

  // Marca código como usado
  await admin.from('codigos_verificacao').update({ usado: true }).eq('id', registro.id)

  // Cria usuário no Auth
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    app_metadata: { perfil: 'cliente' },
    user_metadata: { nome },
  })

  if (createError) {
    if (createError.message?.includes('already registered')) {
      return NextResponse.json({ erro: 'ja_cadastrado' }, { status: 409 })
    }
    console.error('[registrar] createUser error:', createError)
    return NextResponse.json({ erro: 'erro_interno' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, obras: obrasVinculadas.length })
}
