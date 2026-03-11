# Custom Password Reset via Cloud Function + Resend

**Date:** 2026-03-11
**Status:** Approved

## Problem

Password reset emails use Firebase's `sendPasswordResetEmail` which sends Firebase's default email template. The reset link points to Firebase's action handler URL instead of `vidana.com.mx/reset-password`, so the link is broken. Additionally, the email uses Firebase's generic template with no Vidana branding.

## Design

### Cloud Function: `sendPasswordReset`

New callable Cloud Function in `functions/src/index.ts`:

1. Receives `{ email }` from client
2. Rate-limit: check Firestore `passwordResetRequests/{email}` — reject if last request <60s ago
3. Call `admin.auth().generatePasswordResetLink(email, { url: 'https://vidana.com.mx/login' })`
4. Extract `oobCode` from the generated link URL
5. Build reset URL: `https://vidana.com.mx/reset-password?oobCode={oobCode}`
6. Send branded HTML email via Resend from `no-reply@vidana.com.mx`
7. Update Firestore rate-limit timestamp
8. No auth required (unauthenticated users need to reset)

### Branded Email Template

Inline HTML matching the login page aesthetic:
- Blue gradient header bar
- Vidana logo (text-based, no hosted image needed)
- Card-style body: greeting + explanation + blue CTA button "Restablecer Contraseña"
- Footer: "Gestión de comedores empresariales · Vidana"
- Security note: "Si no solicitaste este cambio, ignora este correo."

### Client-Side Changes

**`login/page.tsx` — PasswordResetDialog:**
- Replace `sendPasswordResetEmail(auth, email, actionCodeSettings)` with `httpsCallable(functions, 'sendPasswordReset')({ email })`
- Remove unused `sendPasswordResetEmail` and `ActionCodeSettings` imports

**`reset-password/page.tsx`:**
- Apply the same gradient background + centered white card layout used on login/signup pages
- Keep all existing oobCode verification and password reset logic

## Files Changed

- `functions/src/index.ts` — add `sendPasswordReset` Cloud Function
- `src/app/login/page.tsx` — update PasswordResetDialog to use Cloud Function
- `src/app/reset-password/page.tsx` — gradient background layout

## Deployment

After code changes: `firebase deploy --only functions` to deploy the new Cloud Function.
