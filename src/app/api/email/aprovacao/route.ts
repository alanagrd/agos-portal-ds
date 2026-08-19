import { NextRequest, NextResponse } from 'next/server'
import { getResend, EMAIL_FROM } from '@/lib/resend'
import { templateAprovacao } from '@/lib/email-templates'

export async function POST(req: NextRequest) {
  try {
    const { destinatarios, obraNome, tipoDS, mesReferencia } = await req.json() as {
      destinatarios: { nome: string; email: string; token: string }[]
      obraNome: string
      tipoDS: string
      mesReferencia: string
    }

    if (!destinatarios?.length) {
      return NextResponse.json({ ok: true })
    }

    const results = await Promise.allSettled(
      destinatarios.map(dest => {
        const link = `${process.env.NEXT_PUBLIC_APP_URL}/aprovar/${dest.token}`
        const { subject, html } = templateAprovacao({
          obraNome,
          responsavelNome: dest.nome,
          tipoDS,
          mesReferencia,
          link,
        })
        return getResend().emails.send({ from: EMAIL_FROM, to: dest.email, subject, html })
      })
    )

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[email/aprovacao] Falha ao enviar para ${destinatarios[i].email}:`, r.reason)
      } else if (r.value.error) {
        console.error(`[email/aprovacao] Resend error para ${destinatarios[i].email}:`, r.value.error)
      }
    })
  } catch (err) {
    console.error('[email/aprovacao] Unexpected error:', err)
  }

  return NextResponse.json({ ok: true })
}
