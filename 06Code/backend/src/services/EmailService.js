const nodemailer = require('nodemailer');
const { AppError } = require('../exceptions/AppError');

const ROLE_LABELS = {
  Admin:'Administrador',
  GeneralDirector:'Director general',
  BranchDirector:'Director de sede',
  Teacher:'Profesor',
  Student:'Estudiante',
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function invitationTemplate({ recipientName, email, temporaryPassword, role, loginUrl }) {
  const safeName = escapeHtml(recipientName);
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(temporaryPassword);
  const safeRole = escapeHtml(ROLE_LABELS[role] || role);
  const safeLoginUrl = escapeHtml(loginUrl);
  return `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#f2f2f0;color:#171717;font-family:Arial,Helvetica,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f2f0;padding:32px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #d8d8d3">
          <tr><td style="height:7px;background:#ffe600"></td></tr>
          <tr><td style="padding:28px 32px 18px;background:#171717;color:#ffffff">
            <div style="font-size:12px;letter-spacing:1.5px;color:#ffe600;font-weight:700">AMERICAN LATIN CLASS</div>
            <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2">Tu acceso a la academia está listo</h1>
          </td></tr>
          <tr><td style="padding:30px 32px">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.55">Hola <strong>${safeName}</strong>,</p>
            <p style="margin:0 0 22px;font-size:16px;line-height:1.55;color:#4b4b4b">Se creó tu cuenta como <strong>${safeRole}</strong>. Usa estos datos únicamente para tu primer ingreso.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f3;border-left:5px solid #ffe600">
              <tr><td style="padding:18px 20px">
                <div style="font-size:12px;color:#666666;text-transform:uppercase">Correo</div>
                <div style="margin-top:5px;font-size:17px;font-weight:700">${safeEmail}</div>
                <div style="margin-top:16px;font-size:12px;color:#666666;text-transform:uppercase">Contraseña temporal</div>
                <div style="margin-top:5px;font-size:21px;font-weight:700;letter-spacing:.5px">${safePassword}</div>
              </td></tr>
            </table>
            <p style="margin:22px 0 10px;font-size:15px;font-weight:700">Qué debes hacer</p>
            <ol style="margin:0 0 24px;padding-left:22px;color:#4b4b4b;line-height:1.7">
              <li>Ingresa con el correo y la contraseña temporal.</li>
              <li>Crea una contraseña personal cuando el sistema te lo solicite.</li>
              <li>No compartas tus credenciales con otras personas.</li>
            </ol>
            <table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="background:#ffe600">
              <a href="${safeLoginUrl}" style="display:inline-block;padding:14px 24px;color:#111111;text-decoration:none;font-weight:700">Ingresar a American Latin Class</a>
            </td></tr></table>
            <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#777777">Si no esperabas esta invitación, comunícate con la dirección de la academia.</p>
          </td></tr>
          <tr><td style="padding:18px 32px;background:#ededeb;color:#5f5f5f;font-size:12px">American Latin Class · Formación, disciplina y movimiento</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

class EmailService {
  constructor(config) {
    this.config = config;
    this.outbox = [];
    this.transporter = config.emailTransport === 'smtp'
      ? nodemailer.createTransport({
        host:config.smtpHost,
        port:config.smtpPort,
        secure:config.smtpSecure,
        auth:config.smtpUser ? { user:config.smtpUser, pass:config.smtpPassword } : undefined,
      })
      : null;
  }

  async sendAccessInvitation({ recipientName, email, temporaryPassword, role }) {
    const loginUrl = new URL('/login', this.config.appPublicUrl).toString();
    const message = {
      from:this.config.emailFrom,
      to:email,
      subject:'Tu acceso a American Latin Class',
      text:[
        `Hola ${recipientName},`,
        '',
        `Se creó tu cuenta como ${ROLE_LABELS[role] || role}.`,
        `Correo: ${email}`,
        `Contraseña temporal: ${temporaryPassword}`,
        '',
        `Ingresa en ${loginUrl} y cambia la contraseña durante tu primer acceso.`,
        'No compartas tus credenciales con otras personas.',
      ].join('\n'),
      html:invitationTemplate({ recipientName, email, temporaryPassword, role, loginUrl }),
    };

    try {
      if (this.config.emailTransport === 'capture') {
        const captured = {
          id:`capture-${this.outbox.length + 1}`,
          sentAt:new Date().toISOString(),
          recipientName,
          email,
          role,
          temporaryPassword,
          ...message,
        };
        this.outbox.push(captured);
        return { status:'sent', recipient:email, messageId:captured.id, transport:'capture' };
      }
      const result = await this.transporter.sendMail(message);
      return { status:'sent', recipient:email, messageId:result.messageId, transport:'smtp' };
    } catch (error) {
      throw new AppError('No se pudo enviar la invitación por correo. La cuenta quedó inactiva para evitar un acceso incompleto.', 502, {
        code:'INVITATION_DELIVERY_FAILED',
      });
    }
  }

  latestInvitationFor(email) {
    return [...this.outbox].reverse().find((message) => message.email === email) || null;
  }
}

module.exports = { EmailService, invitationTemplate };
