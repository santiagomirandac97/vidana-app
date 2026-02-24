"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendInvoiceEmail = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
const resend_1 = require("resend");
const params_1 = require("firebase-functions/params");
(0, app_1.initializeApp)();
const resendApiKey = (0, params_1.defineSecret)('RESEND_API_KEY');
exports.sendInvoiceEmail = (0, https_1.onCall)({ secrets: [resendApiKey] }, async (request) => {
    var _a;
    // Require authenticated user
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debes estar autenticado.');
    }
    const db = (0, firestore_1.getFirestore)();
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Solo los administradores pueden enviar facturas.');
    }
    const data = request.data;
    const { companyId, companyName, billingEmail, month, totalMeals, totalAmount, pdfBase64 } = data;
    if (!billingEmail || !pdfBase64) {
        throw new https_1.HttpsError('invalid-argument', 'Faltan datos requeridos.');
    }
    const resend = new resend_1.Resend(resendApiKey.value());
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
            },
        ],
    });
    if (error) {
        console.error('Resend error:', error);
        throw new https_1.HttpsError('internal', 'Error al enviar el correo. Intenta de nuevo.');
    }
    // Update billingStatus in Firestore
    await db.collection('companies').doc(companyId).update({
        [`billingStatus.${month}`]: 'enviado',
    });
    return { success: true };
});
//# sourceMappingURL=index.js.map