function wrapper(content: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background-color:#E87722;padding:24px 32px;">
            <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">AGOS Serviços</p>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:12px;">Portal de Descrições de Serviço</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${content}
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
              AGOS Serviços · Portal DS · Este é um e-mail automático, não responda.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function button(label: string, href: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
  <tr><td>
    <a href="${href}" style="display:inline-block;background-color:#E87722;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;">
      ${label}
    </a>
  </td></tr>
</table>`
}

export function templateAprovacao({
  obraNome,
  responsavelNome,
  tipoDS,
  mesReferencia,
  link,
}: {
  obraNome: string
  responsavelNome: string
  tipoDS: string
  mesReferencia: string
  link: string
}) {
  const html = wrapper(`
    <p style="margin:0 0 16px;font-size:15px;color:#374151;">Olá, <strong>${responsavelNome}</strong>.</p>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;">
      A Descrição de Serviços (<strong>${tipoDS}</strong>) referente à obra
      <strong>${obraNome}</strong> — competência <strong>${mesReferencia}</strong>
      foi analisada internamente e está aguardando a sua aprovação.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;">
      Clique no botão abaixo para visualizar o PDF e aprovar ou solicitar alterações.
    </p>
    ${button('Visualizar e aprovar DS', link)}
    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
      Se você não estava esperando este e-mail, pode ignorá-lo com segurança.
    </p>
  `, `DS ${mesReferencia} — ${obraNome}`)

  return {
    subject: `DS de ${mesReferencia} - ${obraNome} aguardando sua aprovação`,
    html,
  }
}

export function templateObraAprovou({
  obraNome,
  mesReferencia,
  dsId,
  link,
}: {
  obraNome: string
  mesReferencia: string
  dsId: string
  link: string
}) {
  const html = wrapper(`
    <p style="margin:0 0 16px;font-size:15px;color:#374151;">
      A obra <strong>${obraNome}</strong> aprovou a DS de <strong>${mesReferencia}</strong> sem ressalvas.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;">
      Acesse o portal para confirmar o encerramento da DS.
    </p>
    ${button('Abrir DS no portal', link)}
  `, `DS aprovada — ${obraNome} · ${mesReferencia}`)

  return {
    subject: `DS aprovada pela obra — ${obraNome} · ${mesReferencia}`,
    html,
  }
}

export function templateObraSolicitouAlteracao({
  obraNome,
  mesReferencia,
  comentario,
  link,
}: {
  obraNome: string
  mesReferencia: string
  comentario: string
  link: string
}) {
  const html = wrapper(`
    <p style="margin:0 0 16px;font-size:15px;color:#374151;">
      A obra <strong>${obraNome}</strong> solicitou alteração na DS de <strong>${mesReferencia}</strong>.
    </p>
    <div style="margin:0 0 24px;background-color:#fff7ed;border-left:3px solid #E87722;padding:12px 16px;border-radius:0 6px 6px 0;">
      <p style="margin:0;font-size:14px;color:#374151;">${comentario}</p>
    </div>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;">
      Acesse o portal para corrigir o PDF e reenviar para aprovação.
    </p>
    ${button('Abrir DS no portal', link)}
  `, `Alteração solicitada — ${obraNome} · ${mesReferencia}`)

  return {
    subject: `Alteração solicitada pela obra — ${obraNome} · ${mesReferencia}`,
    html,
  }
}

export function templateLembretePendente({
  obraNome,
  mesReferencia,
  diasPendente,
  link,
}: {
  obraNome: string
  mesReferencia: string
  diasPendente: number
  link: string
}) {
  const html = wrapper(`
    <p style="margin:0 0 16px;font-size:15px;color:#374151;">
      Esta é uma lembrança de que a Descrição de Serviços (<strong>${mesReferencia}</strong>)
      referente à obra <strong>${obraNome}</strong> está aguardando a sua aprovação
      há <strong>${diasPendente} dia${diasPendente !== 1 ? 's' : ''}</strong>.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;">
      Por favor, acesse o link abaixo para visualizar o PDF e aprovar ou solicitar alterações.
    </p>
    ${button('Visualizar e aprovar DS', link)}
    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
      Se você já tomou uma ação recentemente, desconsidere este aviso.
    </p>
  `, `Lembrete DS — ${obraNome} · ${mesReferencia}`)

  return {
    subject: `Lembrete: DS aguardando sua aprovação há ${diasPendente} dia${diasPendente !== 1 ? 's' : ''} — ${obraNome}`,
    html,
  }
}

export function templateAlteracaoAtendida({
  obraNome,
  adminNome,
  numeroVersaoPDF,
  link,
}: {
  obraNome: string
  adminNome: string
  numeroVersaoPDF: number
  link: string
}) {
  const html = wrapper(`
    <p style="margin:0 0 16px;font-size:15px;color:#374151;">Olá, <strong>${adminNome}</strong>.</p>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;">
      O PDF corrigido (versão <strong>v${numeroVersaoPDF}</strong>) foi enviado para a DS de
      <strong>${obraNome}</strong>. A DS retornou automaticamente para análise interna.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;">
      Acesse o portal para revisar e dar continuidade.
    </p>
    ${button('Abrir DS no portal', link)}
  `, `PDF corrigido — ${obraNome}`)

  return {
    subject: `PDF corrigido enviado - DS ${obraNome} pronta para nova análise`,
    html,
  }
}
