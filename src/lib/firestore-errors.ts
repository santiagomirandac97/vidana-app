import { FirebaseError } from 'firebase/app';

/**
 * Converts a Firebase/Firestore error into a user-friendly Spanish message.
 */
export function formatFirestoreError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'permission-denied':
        return 'Sin permisos para realizar esta acción.';
      case 'unavailable':
        return 'Servicio no disponible. Verifica tu conexión.';
      case 'not-found':
        return 'El documento no existe.';
      case 'already-exists':
        return 'Ya existe un registro con esos datos.';
      case 'resource-exhausted':
        return 'Límite de solicitudes alcanzado. Intenta en un momento.';
      case 'unauthenticated':
        return 'Sesión expirada. Vuelve a iniciar sesión.';
      case 'cancelled':
        return 'La operación fue cancelada.';
      default:
        return `Error: ${error.message}`;
    }
  }
  if (error instanceof Error) return error.message;
  return 'Error desconocido.';
}
