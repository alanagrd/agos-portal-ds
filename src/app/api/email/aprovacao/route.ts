import { NextRequest, NextResponse } from 'next/server'
import { resend, EMAIL_FROM } from '@/lib/resend'
import { templateAprovacao } from '@/lib/email-templates'

export async function POST(req: NextRequest) {
  try {
    const { dsId, obraNome, responsavelNome, tipoDS, mesReferencia, token, responsavelEmail, emailsCopia } = await req.json()

    const link = `${process.env.NEXT_PUBLIC_APP_URL}/aprovar/${token}`
    const { subject, html } = templateAprovacao({ obraNome, responsavelNome, tipoDS, mesReferencia, link })

    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: responsavelEmail,
      cc: emailsCopia?.length ? emailsCopia : undefined,
      subject,
      html,
    })

    if (error) {
      console.error('[email/aprovacao] Resend error:', error)
    }
  } catch (err) {
    console.error('[email/aprovacao] Unexpected error:', err)
  }

  return NextResponse.json({ ok: true })
}
