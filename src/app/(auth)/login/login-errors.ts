import { ApiError } from '../../../api/ApiError';

export interface LoginProblem {
  /** Titular en lenguaje de persona, nunca un código HTTP. */
  title: string;
  /** Qué ocurrió y por qué. */
  body: string;
  /** Qué puede hacer el usuario ahora. */
  action: string;
  tone: 'error' | 'warning';
  /** `true` cuando reintentar el mismo formulario tiene sentido. */
  retryable: boolean;
}

/**
 * Traduce un fallo de autenticación a un mensaje accionable.
 *
 * Un "Error 401" no dice nada: el usuario necesita saber si se equivocó de
 * contraseña, si su cuenta está bloqueada, si el servidor no está disponible o
 * si simplemente no tiene permisos. Cada caso lleva su propia salida, y ninguno
 * revela si el correo existe o no —eso ayudaría a enumerar cuentas.
 */
export function describeLoginError(error: unknown): LoginProblem {
  if (!(error instanceof ApiError)) {
    return {
      title: 'No pudimos completar el inicio de sesión',
      body: 'Ocurrió un problema inesperado al procesar tu acceso.',
      action: 'Vuelve a intentarlo. Si el problema continúa, avisa al equipo de soporte.',
      tone: 'error',
      retryable: true,
    };
  }

  const code = (error.code ?? '').toUpperCase();
  if (code.includes('LOCKED') || code.includes('DISABLED') || code.includes('SUSPENDED')) {
    return {
      title: 'Tu cuenta está bloqueada',
      body: 'La cuenta quedó bloqueada, normalmente tras varios intentos fallidos seguidos o por decisión de un administrador.',
      action:
        'Espera unos minutos y vuelve a intentarlo, o escribe a soporte indicando tu correo corporativo para que la reactiven.',
      tone: 'error',
      retryable: false,
    };
  }

  switch (error.kind) {
    case 'unauthorized':
      return {
        title: 'No pudimos iniciar tu sesión',
        body: 'El correo o la contraseña no coinciden con una cuenta activa.',
        action:
          'Revisa los datos e inténtalo nuevamente. Si olvidaste tu contraseña, puedes iniciar el proceso de recuperación.',
        tone: 'error',
        retryable: true,
      };
    case 'forbidden':
      return {
        title: 'Tu cuenta no tiene acceso al portal',
        body: 'Las credenciales son correctas, pero tu usuario no tiene ningún rol habilitado en Atlas Decision Engine.',
        action: 'Pide a un administrador que te asigne un rol y vuelve a intentarlo.',
        tone: 'warning',
        retryable: false,
      };
    case 'rate-limit':
      return {
        title: 'Demasiados intentos seguidos',
        body: 'Se bloqueó temporalmente el acceso desde este equipo para proteger la cuenta.',
        action: 'Espera un par de minutos antes de volver a intentarlo.',
        tone: 'warning',
        retryable: false,
      };
    case 'network':
      return {
        title: 'No hay conexión con el servidor',
        body: 'Tu navegador no pudo alcanzar el motor de decisiones. Puede ser tu red o la VPN corporativa.',
        action: 'Comprueba tu conexión y vuelve a intentarlo.',
        tone: 'warning',
        retryable: true,
      };
    case 'timeout':
      return {
        title: 'El servidor tardó demasiado en responder',
        body: 'La petición se canceló antes de recibir respuesta. El servicio puede estar saturado o en mantenimiento.',
        action: 'Inténtalo de nuevo en un momento.',
        tone: 'warning',
        retryable: true,
      };
    case 'validation':
      return {
        title: 'Revisa los datos del formulario',
        body: error.message || 'Alguno de los campos no tiene el formato esperado.',
        action: 'Corrige los campos marcados y vuelve a enviar.',
        tone: 'error',
        retryable: true,
      };
    case 'unexpected':
    case 'contract':
      return {
        title: 'El servicio de identidad no está disponible',
        body: 'El proveedor de identidad respondió con un error o está en mantenimiento.',
        action: 'Vuelve a intentarlo en unos minutos. Si persiste, avisa al equipo de plataforma.',
        tone: 'warning',
        retryable: true,
      };
    default:
      return {
        title: 'No pudimos completar el inicio de sesión',
        body: error.message || 'Ocurrió un problema al validar tus credenciales.',
        action: 'Vuelve a intentarlo. Si el problema continúa, avisa al equipo de soporte.',
        tone: 'error',
        retryable: true,
      };
  }
}

/**
 * Traduce un fallo del SEGUNDO paso. La diferencia con `describeLoginError` no es cosmética: allí
 * un 401 significa "credenciales equivocadas" y aquí significa "PIN inválido o vencido", y decirle
 * a alguien que revise su contraseña cuando lo que falló fue el código lo manda a corregir algo que
 * tenía bien.
 *
 * El motor responde lo mismo para "PIN incorrecto", "PIN caducado" y "desafío inexistente" a
 * propósito: son tres estados que quien prueba a ciegas no debe poder distinguir. Por eso el texto
 * los cubre a los tres en vez de afirmar cuál fue.
 */
export function describePinError(error: unknown): LoginProblem {
  if (error instanceof ApiError && error.kind === 'unauthorized') {
    return {
      title: 'El código no es válido',
      body: 'Puede estar mal escrito, ya usado o caducado. Los códigos sirven una sola vez y por pocos minutos.',
      action: 'Revisa el último correo recibido, o vuelve atrás para pedir uno nuevo.',
      tone: 'error',
      retryable: true,
    };
  }
  if (error instanceof ApiError && error.kind === 'validation') {
    return {
      title: 'El código no tiene el formato esperado',
      body: 'Son exactamente seis dígitos, sin espacios ni guiones.',
      action: 'Escríbelo de nuevo tal y como aparece en el correo.',
      tone: 'error',
      retryable: true,
    };
  }
  return describeLoginError(error);
}

/** Motivo por el que la sesión anterior terminó, según el parámetro de la URL. */
export function sessionNotice(reason: string | null): string | null {
  if (reason === 'expired') {
    return 'Tu sesión anterior expiró por inactividad. Vuelve a autenticarte para continuar donde lo dejaste.';
  }
  if (reason === 'logout') return 'Cerraste la sesión correctamente.';
  if (reason === 'forbidden') {
    return 'No tienes permisos sobre la vista que intentabas abrir. Inicia sesión con una cuenta autorizada.';
  }
  return null;
}
