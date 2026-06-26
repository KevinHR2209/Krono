// services/ghost-messenger/src/services/emailService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

function buildEmailHtml(candidate, slot, confirmLink) {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:#0f766e;padding:24px 32px;">
            <p style="margin:0;font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:1px;">
              ✂️ KRONO — Cupo Disponible
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;color:#1e293b;">
              Hola <strong>${candidate.display_name}</strong>,
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;">
              Se liberó un cupo y fuiste seleccionado/a según tu prioridad en lista de espera. Confirma antes de que expire el enlace.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:6px;padding:20px;margin-bottom:24px;">
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#64748b;">📅 <strong>Fecha</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#1e293b;text-align:right;">${slot.date}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#64748b;">⏰ <strong>Hora</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#1e293b;text-align:right;">${slot.start_time} – ${slot.end_time}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#64748b;">👨‍⚕️ <strong>Doctor</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#1e293b;text-align:right;">${slot.doctor_name}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#64748b;">🩺 <strong>Especialidad</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#1e293b;text-align:right;">${slot.specialty}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:14px;color:#64748b;">📍 <strong>Lugar</strong></td>
                <td style="padding:6px 0;font-size:14px;color:#1e293b;text-align:right;">${slot.location}</td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${confirmLink}"
                   style="display:inline-block;background:#0f766e;color:#ffffff;font-size:16px;font-weight:bold;padding:14px 36px;border-radius:6px;text-decoration:none;">
                  ✅ Confirmar mi cupo
                </a>
              </td></tr>
            </table>

            <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;text-align:center;">
              ⚠️ Este enlace expira en 2 minutos. Si no confirmas, el cupo pasará al siguiente candidato.
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#f1f5f9;padding:16px 32px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">
              Krono — Sistema de reasignación inteligente de cupos
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

async function sendEmailMessage(to, candidate, slot, confirmLink) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    console.warn('⚠️  GMAIL_USER o GMAIL_PASS no configurados, se omite canal email.');
    return { success: false, messageId: null };
  }

  try {
    const info = await transporter.sendMail({
      from: `"Krono" <${process.env.GMAIL_USER}>`,
      to,
      subject: `⚡ Cupo disponible — ${slot.date} ${slot.start_time}`,
      html: buildEmailHtml(candidate, slot, confirmLink)
    });

    console.log(`📧 EMAIL -> ${to} (id: ${info.messageId})`);
    return { success: true, messageId: info.messageId };

  } catch (err) {
    console.error('❌ Email Error:', err.message);
    return { success: false, messageId: null, error: err.message };
  }
}

module.exports = { sendEmailMessage };