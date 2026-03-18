import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp } from 'firebase-admin/app';
import { Resend } from 'resend';
import { defineSecret } from 'firebase-functions/params';

initializeApp();

const resendApiKey = defineSecret('RESEND_API_KEY');

interface SendInvoiceEmailData {
  companyId: string;
  companyName: string;
  billingEmail: string;
  month: string;           // 'yyyy-MM'
  totalMeals: number;
  totalAmount: number;
  pdfBase64: string;       // base64-encoded PDF
}

export const sendInvoiceEmail = onCall(
  { secrets: [resendApiKey] },
  async (request) => {
    // Require authenticated user
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes estar autenticado.');
    }

    const db = getFirestore();
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (userDoc.data()?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Solo los administradores pueden enviar facturas.');
    }

    const data = request.data as SendInvoiceEmailData;
    const { companyId, companyName, billingEmail, month, totalMeals, totalAmount, pdfBase64 } = data;

    if (!billingEmail || !pdfBase64) {
      throw new HttpsError('invalid-argument', 'Faltan datos requeridos.');
    }

    const resend = new Resend(resendApiKey.value());
    const [year, monthNum] = month.split('-');
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    const monthLabel = `${monthNames[parseInt(monthNum) - 1]} ${year}`;

    const { error } = await resend.emails.send({
      from: 'Vidana <facturacion@vidana.com.mx>',
      to: [billingEmail],
      subject: `Estado de Cuenta — ${companyName} — ${monthLabel}`,
      html: `
        <h2>Estado de Cuenta — ${monthLabel}</h2>
        <p>Estimado equipo de <strong>${companyName}</strong>,</p>
        <p>Adjuntamos el estado de cuenta del mes de <strong>${monthLabel}</strong>.</p>
        <table cellpadding="6" style="border-collapse:collapse;">
          <tr><td><strong>Empresa:</strong></td><td>${companyName}</td></tr>
          <tr><td><strong>Período:</strong></td><td>${monthLabel}</td></tr>
          <tr><td><strong>Total comidas:</strong></td><td>${totalMeals}</td></tr>
          <tr><td><strong>Monto total:</strong></td><td>$${totalAmount.toFixed(2)} MXN</td></tr>
        </table>
        <p>Para cualquier aclaración, contáctenos en <a href="mailto:admin@vidana.com.mx">admin@vidana.com.mx</a>.</p>
        <p>Atentamente,<br/>Vidana</p>
      `,
      attachments: [
        {
          filename: `estado-cuenta-${companyName.toLowerCase().replace(/\s+/g, '-')}-${month}.pdf`,
          content: pdfBase64,
          content_type: 'application/pdf',
        },
      ],
    });

    if (error) {
      console.error('Resend error:', error);
      throw new HttpsError('internal', 'Error al enviar el correo. Intenta de nuevo.');
    }

    // Update billingStatus in Firestore
    await db.collection('companies').doc(companyId).update({
      [`billingStatus.${month}`]: 'enviado',
    });

    return { success: true };
  }
);

// --- Password Reset ---

const APP_URL = 'https://vidana.com.mx';

function buildPasswordResetEmailHtml(resetUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="420" cellpadding="0" cellspacing="0" style="max-width:420px;width:100%;">
        <!-- Header gradient bar -->
        <tr><td style="background:linear-gradient(135deg,#2563eb 0%,#3730a3 100%);height:8px;border-radius:12px 12px 0 0;"></td></tr>
        <!-- Card -->
        <tr><td style="background-color:#ffffff;padding:40px 32px 32px;border-radius:0 0 12px 12px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Logo -->
          <div style="text-align:center;margin-bottom:32px;">
            <img src="https://vidana.com.mx/logos/logo.png" alt="Vidana" width="160" height="53" style="display:inline-block;width:160px;height:auto;" />
          </div>
          <!-- Heading -->
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#111827;text-align:center;">Restablecer contraseña</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;text-align:center;">Recibimos una solicitud para restablecer tu contraseña.</p>
          <!-- CTA Button -->
          <div style="text-align:center;margin-bottom:24px;">
            <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 40px;border-radius:8px;">
              Restablecer Contraseña
            </a>
          </div>
          <!-- Fallback link -->
          <p style="margin:0 0 24px;font-size:12px;color:#9ca3af;text-align:center;word-break:break-all;">
            Si el botón no funciona, copia y pega este enlace en tu navegador:<br/>
            <a href="${resetUrl}" style="color:#2563eb;">${resetUrl}</a>
          </p>
          <!-- Divider -->
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <!-- Security note -->
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
            Si no solicitaste este cambio, puedes ignorar este correo.<br/>Tu contraseña no será modificada.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Gestión de comedores empresariales · Vidana</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// --- Contact Form ---

function buildContactEmailHtml(data: { name: string; email: string; phone: string; company: string; message: string }): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="420" cellpadding="0" cellspacing="0" style="max-width:420px;width:100%;">
        <!-- Header gradient bar -->
        <tr><td style="background:linear-gradient(135deg,#2563eb 0%,#3730a3 100%);height:8px;border-radius:12px 12px 0 0;"></td></tr>
        <!-- Card -->
        <tr><td style="background-color:#ffffff;padding:40px 32px 32px;border-radius:0 0 12px 12px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Logo -->
          <div style="text-align:center;margin-bottom:32px;">
            <img src="https://vidana.com.mx/logos/logo.png" alt="Vidana" width="160" height="53" style="display:inline-block;width:160px;height:auto;" />
          </div>
          <!-- Heading -->
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#111827;text-align:center;">Nuevo Contacto</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;text-align:center;">Se recibió una solicitud desde el formulario de contacto.</p>
          <!-- Contact info table -->
          <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:14px;color:#374151;">
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="font-weight:600;color:#111827;width:100px;">Nombre</td>
              <td>${data.name}</td>
            </tr>
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="font-weight:600;color:#111827;">Email</td>
              <td><a href="mailto:${data.email}" style="color:#2563eb;text-decoration:none;">${data.email}</a></td>
            </tr>
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="font-weight:600;color:#111827;">Teléfono</td>
              <td>${data.phone || '—'}</td>
            </tr>
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="font-weight:600;color:#111827;">Empresa</td>
              <td>${data.company || '—'}</td>
            </tr>
            <tr>
              <td style="font-weight:600;color:#111827;vertical-align:top;padding-top:12px;">Mensaje</td>
              <td style="padding-top:12px;white-space:pre-wrap;">${data.message}</td>
            </tr>
          </table>
          <!-- Divider -->
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <!-- Reply CTA -->
          <div style="text-align:center;">
            <a href="mailto:${data.email}" style="display:inline-block;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;">
              Responder a ${data.name}
            </a>
          </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Formulario de contacto · vidana.com.mx</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export const sendContactForm = onCall(
  { secrets: [resendApiKey] },
  async (request) => {
    const { name, email, phone, company, message } = request.data as {
      name?: string;
      email?: string;
      phone?: string;
      company?: string;
      message?: string;
    };

    if (!name || !email || !message) {
      throw new HttpsError('invalid-argument', 'Nombre, email y mensaje son requeridos.');
    }

    const resend = new Resend(resendApiKey.value());
    const { error } = await resend.emails.send({
      from: 'Vidana <no-reply@vidana.com.mx>',
      to: ['andres@vidana.com.mx', 'santiago@vidana.com.mx'],
      reply_to: email.trim(),
      subject: `Nuevo contacto: ${name} — ${company || 'Sin empresa'}`,
      html: buildContactEmailHtml({
        name: name.trim(),
        email: email.trim(),
        phone: phone?.trim() || '',
        company: company?.trim() || '',
        message: message.trim(),
      }),
    });

    if (error) {
      console.error('[sendContactForm] Resend error:', JSON.stringify(error));
      throw new HttpsError('internal', 'Error al enviar el mensaje. Intenta de nuevo.');
    }

    return { success: true };
  }
);

// --- Password Reset ---

export const sendPasswordReset = onCall(
  { secrets: [resendApiKey] },
  async (request) => {
    console.log('[sendPasswordReset] Function invoked');
    const { email } = request.data as { email?: string };

    if (!email || typeof email !== 'string') {
      throw new HttpsError('invalid-argument', 'Se requiere un email válido.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log('[sendPasswordReset] Email:', normalizedEmail);

    // Rate limit: 1 request per 60 seconds per email
    const db = getFirestore();
    const rateLimitRef = db.collection('passwordResetRequests').doc(normalizedEmail);
    const rateLimitDoc = await rateLimitRef.get();

    if (rateLimitDoc.exists) {
      const lastRequest = rateLimitDoc.data()?.timestamp?.toDate();
      if (lastRequest && Date.now() - lastRequest.getTime() < 60_000) {
        console.log('[sendPasswordReset] Rate limited');
        throw new HttpsError(
          'resource-exhausted',
          'Ya se envió un correo recientemente. Espera un minuto antes de intentar de nuevo.'
        );
      }
    }

    // Generate the reset link via Firebase Admin
    console.log('[sendPasswordReset] Generating reset link...');
    const auth = getAuth();
    let firebaseResetLink: string;
    try {
      firebaseResetLink = await auth.generatePasswordResetLink(normalizedEmail, {
        url: `${APP_URL}/login`,
      });
      console.log('[sendPasswordReset] Reset link generated successfully');
    } catch (err: any) {
      // Don't reveal whether the email exists or not
      console.error('[sendPasswordReset] generatePasswordResetLink error:', err.code, err.message);
      // Still return success to prevent email enumeration
      return { success: true };
    }

    // Extract oobCode from Firebase's link and build our own URL
    const url = new URL(firebaseResetLink);
    const oobCode = url.searchParams.get('oobCode');

    if (!oobCode) {
      console.error('[sendPasswordReset] No oobCode found in link:', firebaseResetLink);
      throw new HttpsError('internal', 'Error al generar el enlace de restablecimiento.');
    }

    const resetUrl = `${APP_URL}/reset-password?oobCode=${oobCode}`;
    console.log('[sendPasswordReset] Sending email via Resend...');

    // Send branded email via Resend
    const resend = new Resend(resendApiKey.value());
    const { error } = await resend.emails.send({
      from: 'Vidana <no-reply@vidana.com.mx>',
      to: [normalizedEmail],
      subject: 'Restablecer tu contraseña — Vidana',
      html: buildPasswordResetEmailHtml(resetUrl),
    });

    if (error) {
      console.error('[sendPasswordReset] Resend error:', JSON.stringify(error));
      throw new HttpsError('internal', 'Error al enviar el correo. Intenta de nuevo.');
    }

    console.log('[sendPasswordReset] Email sent successfully');

    // Update rate limit
    await rateLimitRef.set({ timestamp: FieldValue.serverTimestamp() });

    return { success: true };
  }
);
