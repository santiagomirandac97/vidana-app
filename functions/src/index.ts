import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp } from 'firebase-admin/app';
import { Resend } from 'resend';
import { defineSecret } from 'firebase-functions/params';

initializeApp();

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
        <p>Estimado equipo de <strong>${escapeHtml(companyName)}</strong>,</p>
        <p>Adjuntamos el estado de cuenta del mes de <strong>${monthLabel}</strong>.</p>
        <table cellpadding="6" style="border-collapse:collapse;">
          <tr><td><strong>Empresa:</strong></td><td>${escapeHtml(companyName)}</td></tr>
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
              <td>${escapeHtml(data.name)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="font-weight:600;color:#111827;">Email</td>
              <td><a href="mailto:${encodeURIComponent(data.email)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(data.email)}</a></td>
            </tr>
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="font-weight:600;color:#111827;">Teléfono</td>
              <td>${escapeHtml(data.phone || '—')}</td>
            </tr>
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="font-weight:600;color:#111827;">Empresa</td>
              <td>${escapeHtml(data.company || '—')}</td>
            </tr>
            <tr>
              <td style="font-weight:600;color:#111827;vertical-align:top;padding-top:12px;">Mensaje</td>
              <td style="padding-top:12px;white-space:pre-wrap;">${escapeHtml(data.message)}</td>
            </tr>
          </table>
          <!-- Divider -->
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <!-- Reply CTA -->
          <div style="text-align:center;">
            <a href="mailto:${encodeURIComponent(data.email)}" style="display:inline-block;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;">
              Responder a ${escapeHtml(data.name)}
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

    // Basic email format validation + prevent header injection
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim()) || /[\r\n]/.test(email)) {
      throw new HttpsError('invalid-argument', 'Email inválido.');
    }

    // Limit input lengths to prevent abuse
    if (name.length > 200 || email.length > 200 || (phone && phone.length > 50) ||
        (company && company.length > 200) || message.length > 5000) {
      throw new HttpsError('invalid-argument', 'Datos exceden el límite permitido.');
    }

    const resend = new Resend(resendApiKey.value());
    const { error } = await resend.emails.send({
      from: 'Vidana <no-reply@vidana.com.mx>',
      to: ['andres@vidana.com.mx', 'santiago@vidana.com.mx'],
      reply_to: email.trim(),
      subject: `Nuevo contacto: ${name.replace(/[\r\n]/g, '')} — ${(company || 'Sin empresa').replace(/[\r\n]/g, '')}`,
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

// --- Order Confirmation Email (Firestore onCreate) ---

function buildOrderConfirmationHtml(data: {
  orderNumber: string;
  companyName: string;
  orderType: string;
  scheduledFor: string | null;
  items: Array<{ name: string; quantity: number; price: number }>;
  paymentMethod: string;
  total: number;
  customerNote?: string;
}): string {
  const orderTypeBadge = data.orderType === 'takeout'
    ? '<span style="display:inline-block;background-color:#fef3c7;color:#92400e;font-size:13px;font-weight:600;padding:6px 14px;border-radius:20px;">Para llevar</span>'
    : '<span style="display:inline-block;background-color:#dbeafe;color:#1e40af;font-size:13px;font-weight:600;padding:6px 14px;border-radius:20px;">Comer aquí</span>';

  const timeDisplay = data.scheduledFor
    ? `<p style="margin:0 0 4px;font-size:14px;color:#6b7280;">Programado para:</p><p style="margin:0;font-size:16px;font-weight:600;color:#111827;">${escapeHtml(data.scheduledFor)}</p>`
    : '<p style="margin:0;font-size:14px;color:#6b7280;">Lo antes posible</p>';

  const itemsRows = data.items.map((item) =>
    `<tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:10px 0;font-size:14px;color:#374151;">${escapeHtml(item.name)}</td>
      <td style="padding:10px 8px;font-size:14px;color:#374151;text-align:center;">${item.quantity}</td>
      <td style="padding:10px 0;font-size:14px;color:#374151;text-align:right;">$${(item.price * item.quantity).toFixed(2)}</td>
    </tr>`
  ).join('');

  const noteSection = data.customerNote
    ? `<div style="margin-top:16px;padding:12px;background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Nota</p>
        <p style="margin:0;font-size:14px;color:#374151;">${escapeHtml(data.customerNote)}</p>
      </div>`
    : '';

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
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#111827;text-align:center;">Tu orden ha sido recibida</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;text-align:center;">${escapeHtml(data.companyName)}</p>
          <!-- Order number -->
          <div style="text-align:center;margin-bottom:20px;">
            <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Número de orden</p>
            <p style="margin:0;font-size:32px;font-weight:700;color:#111827;">#${escapeHtml(data.orderNumber)}</p>
          </div>
          <!-- Order type badge -->
          <div style="text-align:center;margin-bottom:20px;">
            ${orderTypeBadge}
          </div>
          <!-- Scheduled time -->
          <div style="text-align:center;margin-bottom:24px;">
            ${timeDisplay}
          </div>
          <!-- Divider -->
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px;" />
          <!-- Items table -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr style="border-bottom:2px solid #e5e7eb;">
              <td style="padding:8px 0;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Artículo</td>
              <td style="padding:8px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;text-align:center;">Cant.</td>
              <td style="padding:8px 0;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;text-align:right;">Precio</td>
            </tr>
            ${itemsRows}
          </table>
          ${noteSection}
          <!-- Payment method -->
          <div style="margin-top:16px;padding:12px 0;border-top:1px solid #e5e7eb;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:14px;color:#6b7280;">Método de pago</td>
                <td style="font-size:14px;color:#374151;text-align:right;">${escapeHtml(data.paymentMethod)}</td>
              </tr>
            </table>
          </div>
          <!-- Total -->
          <div style="padding:12px 0;border-top:2px solid #111827;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:16px;font-weight:700;color:#111827;">Total</td>
                <td style="font-size:16px;font-weight:700;color:#111827;text-align:right;">$${data.total.toFixed(2)} MXN</td>
              </tr>
            </table>
          </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Vidana — Buen provecho</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export const sendOrderConfirmation = onDocumentCreated(
  {
    document: 'companies/{companyId}/consumptions/{consumptionId}',
    secrets: [resendApiKey],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    if (data.source !== 'portal' || !data.customerEmail) return;

    const companyId = event.params.companyId;

    // Fetch company name
    const companyDoc = await getFirestore().doc(`companies/${companyId}`).get();
    const companyName = companyDoc.data()?.name || 'Vidana';

    const orderNumber = data.orderNumber?.toString() || event.params.consumptionId;
    const orderType = data.orderType || 'dineIn';
    const scheduledFor = data.scheduledFor
      ? new Date(data.scheduledFor.toDate ? data.scheduledFor.toDate() : data.scheduledFor).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
      : null;

    const items: Array<{ name: string; quantity: number; price: number }> = (data.items || []).map((item: any) => ({
      name: item.name || '',
      quantity: item.quantity || 1,
      price: item.price || 0,
    }));

    const paymentMethod = data.paymentMethod || 'No especificado';
    const total = typeof data.total === 'number' ? data.total : items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const customerNote = data.customerNote || '';

    const html = buildOrderConfirmationHtml({
      orderNumber,
      companyName,
      orderType,
      scheduledFor,
      items,
      paymentMethod,
      total,
      customerNote: customerNote || undefined,
    });

    const resend = new Resend(resendApiKey.value());
    const { error } = await resend.emails.send({
      from: 'Vidana <no-reply@vidana.com.mx>',
      to: [data.customerEmail],
      subject: `Tu orden #${orderNumber} en ${companyName}`,
      html,
    });

    if (error) {
      console.error('[sendOrderConfirmation] Resend error:', JSON.stringify(error));
    }
  }
);

// --- Order Ready Email (Firestore onUpdate) ---

function buildOrderReadyHtml(orderNumber: string): string {
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
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#111827;text-align:center;">Tu orden está lista para recoger</h1>
          <!-- Order number -->
          <div style="text-align:center;margin:24px 0;">
            <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Número de orden</p>
            <p style="margin:0;font-size:32px;font-weight:700;color:#111827;">#${escapeHtml(orderNumber)}</p>
          </div>
          <!-- CTA -->
          <div style="text-align:center;margin:24px 0;padding:20px;background-color:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;">
            <p style="margin:0;font-size:16px;font-weight:600;color:#166534;">Acércate al mostrador</p>
          </div>
          <!-- Divider -->
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Gracias por tu preferencia.</p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">Vidana — Buen provecho</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export const sendOrderReady = onDocumentUpdated(
  {
    document: 'companies/{companyId}/consumptions/{consumptionId}',
    secrets: [resendApiKey],
  },
  async (event) => {
    const change = event.data;
    if (!change) return;

    const before = change.before.data();
    const after = change.after.data();

    if (after.source !== 'portal' || !after.customerEmail) return;
    if (before.status === after.status || before.status !== 'pending' || after.status !== 'completed') return;

    const orderNumber = after.orderNumber?.toString() || event.params.consumptionId;

    const resend = new Resend(resendApiKey.value());
    const { error } = await resend.emails.send({
      from: 'Vidana <no-reply@vidana.com.mx>',
      to: [after.customerEmail],
      subject: `¡Tu orden #${orderNumber} está lista!`,
      html: buildOrderReadyHtml(orderNumber),
    });

    if (error) {
      console.error('[sendOrderReady] Resend error:', JSON.stringify(error));
    }
  }
);
