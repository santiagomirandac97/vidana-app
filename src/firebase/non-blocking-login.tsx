
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, linkWithCredential, AuthError } from "firebase/auth";

/**
 * Type guard to check if an error is an AuthError.
 */
function isAuthError(error: any): error is AuthError {
    return error.code !== undefined && error.message !== undefined;
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string): void {
    // CRITICAL: Call createUserWithEmailAndPassword directly. Do NOT use 'await createUserWithEmailAndPassword(...)'.
    createUserWithEmailAndPassword(authInstance, email, password)
        .catch(error => {
            if (isAuthError(error) && error.code === 'auth/email-already-in-use') {
                // If the email is already in use, try to sign in instead.
                initiateEmailSignIn(authInstance, email, password);
            } else {
                console.error("Email sign-up failed", error);
            }
        });
    // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): void {
    // CRITICAL: Call signInWithEmailAndPassword directly. Do NOT use 'await signInWithEmailAndPassword(...)'.
    signInWithEmailAndPassword(authInstance, email, password).catch(error => console.error("Email sign-in failed", error));
    // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}
