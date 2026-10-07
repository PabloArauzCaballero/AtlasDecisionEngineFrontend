import { ApiError } from '../../../api/ApiError';
import type { LoginProblem } from './login-errors';

/**
 * Fallos de la recuperación de contraseña, en lenguaje de persona.
 *
 * Ninguno distingue «la cuenta no existe»: el motor responde igual exista o no, y el paso dos
 * contesta con el mismo mensaje a un código malo, vencido o pedido para un correo desconocido.
 * Lo que sí se distingue es lo que es igual para cualquier dirección —demasiados intentos, sin
 * conexión, el correo saliente caído—, porque eso es lo que le dice a la persona qué hacer.
 */
export function describeRecoveryError(error: unknown, step: 'request' | 'confirm'): LoginProblem {
  if (!(error instanceof ApiError)) {
    return {
      title: 'No pudimos completar la recuperación',
      body: 'Ocurrió un problema inesperado al procesar la solicitud.',
      action: 'Vuelve a intentarlo. Si el problema continúa, avisa al equipo de soporte.',
      tone: 'error',
      retryable: true,
    };
  }

  switch (error.kind) {
    case 'unauthorized':
      return {
        title: 'El código no es válido o ya venció',
        body: 'El código no coincide con el último que enviamos a ese correo, o pasó su tiempo de validez.',
        action:
          'Revisa que el correo sea el mismo con el que pediste el código y vuelve a escribirlo, o pide uno nuevo.',
        tone: 'error',
        retryable: true,
      };
    case 'rate-limit':
      return {
        title: 'Demasiadas solicitudes seguidas',
        body:
          step === 'request'
            ? 'Para proteger la cuenta, sólo se puede pedir un código cada tanto.'
            : 'Se pausaron los intentos desde este equipo para proteger la cuenta.',
        action:
          'Espera un par de minutos y revisa tu bandeja de entrada antes de volver a intentar.',
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
        body: 'La solicitud se canceló antes de recibir respuesta.',
        action:
          step === 'request'
            ? 'Revisa tu correo antes de pedir otro código: puede que el primero ya esté en camino.'
            : 'Inténtalo de nuevo en un momento.',
        tone: 'warning',
        retryable: true,
      };
    case 'validation':
      return {
        title: 'Revisa los datos del formulario',
        body: 'Alguno de los campos no tiene el formato esperado.',
        action: 'Corrige los campos marcados y vuelve a enviar.',
        tone: 'error',
        retryable: true,
      };
    default:
      return {
        title:
          step === 'request'
            ? 'No podemos enviar el código en este momento'
            : 'No pudimos cambiar tu contraseña',
        body: 'El servicio de identidad o el envío de correos no está disponible.',
        action: 'Vuelve a intentarlo en unos minutos. Si persiste, avisa al equipo de plataforma.',
        tone: 'warning',
        retryable: true,
      };
  }
}
