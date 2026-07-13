import { Resend } from 'resend'

export const EMAIL_FROM = 'AGOS Portal DS <notificacoes@mail.agosservicos.com.br>'

// Lazy: instancia em runtime para não quebrar o build sem RESEND_API_KEY.
export function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}
