'use client';

import { KeyRound, ShieldAlert } from 'lucide-react';
import { useAuth } from './useAuth';

/**
 * Lo que el motor dice sobre la credencial de quien está dentro.
 *
 * `mustChangePassword` y `mfaEnabled` llegaban en la carga útil de la sesión
 * desde el principio, se validaban contra el esquema… y ahí se acababa: nadie
 * los leía. El proveedor de identidad podía marcar una contraseña como caducada
 * o exigida de rotar y el portal seguía adelante sin decir una palabra, que es
 * la forma más silenciosa de incumplir una política de credenciales — el motor
 * cree haber avisado y la persona nunca se enteró.
 *
 * Esto no BLOQUEA el portal a propósito. Quien decide si una sesión con la
 * contraseña por rotar puede operar es el motor, en cada llamada; adivinarlo
 * aquí dejaría fuera a gente que el backend sí admite. Lo que faltaba era el
 * aviso, y el aviso es esto.
 *
 * El texto de `mustChangePassword` remitía «al proveedor de identidad», donde
 * durante mucho tiempo no hubo NADA que hacer: no existía un endpoint de cambio
 * de contraseña para una cuenta con sesión abierta, así que el aviso era una
 * instrucción sin destino. Ahora apunta al diálogo de la barra superior, que sí
 * lo hace — con el mismo segundo factor por correo que el acceso.
 *
 * `mfaEnabled` describe el estado EFECTIVO del segundo factor, no una casilla
 * de la ficha del usuario. Durante un tiempo el proveedor publicaba aquí una
 * columna que ningún camino de código escribía para cuentas internas, así que
 * era `false` para todo el mundo: el aviso salía siempre, incluso a quien
 * acababa de entrar tecleando un PIN, y remitía a «activarlo en el proveedor de
 * identidad», donde no había nada que activar. El texto de abajo ya no promete
 * eso: describe lo que se sabe —esta sesión se abrió con un solo factor— sin
 * inventar de quién es el interruptor.
 */
export function SessionSecurityNotice() {
  const { user } = useAuth();
  if (!user) return null;

  const mustChange = user.mustChangePassword === true;
  // Sólo se menciona la ausencia de segundo factor cuando el motor la declara
  // explícitamente: `undefined` significa "este motor no informa", no "no la tiene".
  const missingMfa = user.mfaEnabled === false;
  if (!mustChange && !missingMfa) return null;

  return (
    <div className="session-security-notice" role="status">
      {mustChange ? (
        <p className="session-security-item is-urgent">
          <KeyRound size={16} aria-hidden="true" />
          <span>
            <strong>Tu contraseña está marcada para cambio.</strong> Cámbiala desde el botón de la
            llave, arriba a la derecha: mientras no lo hagas, el motor puede rechazar operaciones
            sensibles.
          </span>
        </p>
      ) : null}
      {missingMfa ? (
        <p className="session-security-item">
          <ShieldAlert size={16} aria-hidden="true" />
          <span>
            <strong>Esta sesión se abrió sólo con contraseña.</strong> El portal gobierna decisiones
            de crédito: pide al equipo de plataforma que exija un segundo factor para tu cuenta.
          </span>
        </p>
      ) : null}
    </div>
  );
}
