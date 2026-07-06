import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

// TODO: trocar para 'AGOS Portal DS <notificacoes@mail.agosservicos.com.br>'
// assim que esse subdomínio estiver verificado no Resend.
export const EMAIL_FROM = 'AGOS Portal DS <onboarding@resend.dev>'
