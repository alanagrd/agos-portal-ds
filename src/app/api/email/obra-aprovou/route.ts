import { NextRequest, NextResponse } from 'next/server'
import { getResend, EMAIL_FROM } from '@/lib/resend'
import { templateObraAprovou } from '@/lib/email-templates'

export async function POST(req: NextRequest) {
  try {
    const { dsId, obraNome, mesReferencia, adminEmail } = await req.json()

    const link = `${process.env.NEXT_PUBLIC_APP_URL}/ds/${dsId}`
    const { subject, html } = templateObraAprovou({ obraNome, mesReferencia, dsId, link })

    const { error } = await getResend().emails.send({
      from: EMAIL_FROM,
      to: adminEmail,
      subject,
      html,
    })

    if (error) {
      console.error('[email/obra-aprovou] Resend error:', error)
    }
  } catch (err) {
    console.error('[email/obra-aprovou] Unexpected error:', err)
  }

  return NextResponse.json({ ok: true })
}
