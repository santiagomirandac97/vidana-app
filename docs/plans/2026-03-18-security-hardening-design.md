# Security Hardening Design — 2026-03-18

## Phase 1: Immediate Fixes
1. Escape HTML in Cloud Function email templates (sendContactForm)
2. Restrict invite Firestore rules to authenticated users
3. Add survey response rate limiting via IP-based throttle
4. Add security headers (CSP, X-Frame-Options, Referrer-Policy)
5. Run npm audit fix

## Phase 2: Hardening
6. Restrict Firebase API key (HTTP referrer)
7. Validate RFID device IPs (private ranges only)
8. Remove dev-mode Simular Tap from production bundle
9. Add security headers for all routes

## Phase 3: Future
10. Server-side admin route protection
11. Firebase App Check
12. Audit logging
