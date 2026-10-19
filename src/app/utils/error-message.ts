export type FailureCode = 'missing-token' | 'invalid-response' | 'storage' | 'preferences';

const MESSAGES: Record<FailureCode, string> = {
  'missing-token': 'El backend respondió sin token.',
  'invalid-response': 'El servicio devolvió una respuesta inválida.',
  storage: 'No se pudo acceder a la sesión. Inicie sesión de nuevo.',
  preferences: 'No se pudieron cargar las preferencias guardadas.'
};

export class ApplicationError extends Error {
  constructor(readonly code: FailureCode) {
    super(MESSAGES[code]);
  }
}

export function errorMessage(error: unknown, context: 'login' | 'tasks' | 'logout'): string {
  if (error instanceof ApplicationError) {
    return MESSAGES[error.code];
  }
  const messages = {
    login: 'No se pudo autenticar. Verifique sus credenciales e intente de nuevo.',
    tasks: 'No se pudo cargar el dashboard. Intente de nuevo.',
    logout: 'No se pudo cerrar la sesión. Intente de nuevo.'
  };
  return messages[context];
}
