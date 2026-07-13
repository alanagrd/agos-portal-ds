import { NextRequest, NextResponse } from 'next/server'
import { getResend, EMAIL_FROM } from '@/lib/resend'
import { templateAlteracaoAtendida } from '@/lib/email-templates'

export async function POST(req: NextRequest) {
  try {
    const { dsId, obraNome, adminEmail, adminNome, numeroVersaoPDF } = await req.json()

    const link = `${process.env.NEXT_PUBLIC_APP_URL}/ds/${dsId}`
    const { subject, html } = templateAlteracaoAtendida({ obraNome, adminNome, numeroVersaoPDF, link })

    const { error } = await getResend().emails.send({
      from: EMAIL_FROM,
      to: adminEmail,
      subject,
      html,
    })

    if (error) {
      console.error('[email/alteracao-atendida] Resend error:', error)
    }
  } catch (err) {
    console.error('[email/alteracao-atendida] Unexpected error:', err)
  }

  return NextResponse.json({ ok: true })
}
