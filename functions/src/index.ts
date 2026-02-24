import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
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
