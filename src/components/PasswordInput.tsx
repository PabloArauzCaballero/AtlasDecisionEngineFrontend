'use client';

import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { useState, type InputHTMLAttributes } from 'react';

/**
 * Un campo de contraseña con el ojito para verla.
 *
 * El login ya lo tenía; recuperar el acceso y cambiar la contraseña no, y son justo los dos
 * sitios donde se escribe una contraseña NUEVA a ciegas. Usa el mismo armazón que el login
 * (`input-with-icon`), así que no trae estilos propios.
 *
 * El botón se llama «Ver la clave» y no «Mostrar contraseña»: su nombre no debe contener la
 * etiqueta del campo, o quien lo busca por ella encuentra dos cosas. Queda fuera del orden de
 * tabulación para que Tab siga yendo de un campo al siguiente.
 */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);
  const label = visible ? 'Ocultar la clave' : 'Ver la clave';
  return (
    <div className="input-with-icon">
      <KeyRound aria-hidden="true" />
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((current) => !current)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        disabled={props.disabled}
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </div>
  );
}
