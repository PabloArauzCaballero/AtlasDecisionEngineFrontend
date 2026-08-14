'use client';

import { Camera } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CameraCaptureDialog } from './CameraCaptureDialog';

interface IdentityImageFieldProps {
  id: string;
  label: string;
  hint: string;
  file: File | null;
  error: string | null;
  maxBytes: number;
  optional?: boolean;
  disabled?: boolean;
  /**
   * Ofrece tomar la imagen con la cámara del equipo, además de subirla.
   *
   * Se pide por campo y no se asume: tiene sentido para la selfie —la persona
   * está delante del equipo— y no para el documento, que hay que fotografiar
   * con algo que se pueda mover alrededor de la tarjeta.
   */
  camera?: boolean;
  onChange: (file: File | null, error: string | null) => void;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Un selector de imagen con vista previa.
 *
 * **La vista previa no es adorno.** Quien sube la foto de su documento y una
 * selfie no puede comprobar de otro modo que eligió los archivos correctos, y
 * confundirlos —selfie donde va el documento— produce un rechazo que parece del
 * motor cuando en realidad fue del formulario. Se dibuja con `URL.createObjectURL`
 * y se revoca al cambiar: sin revocar, cada foto elegida deja su copia en
 * memoria hasta recargar la página.
 *
 * La validación de aquí es para **responder rápido**, no para proteger: el motor
 * decide por los bytes mágicos del contenido, que el navegador no puede leer sin
 * abrir el archivo entero.
 */
export function IdentityImageField({
  id,
  label,
  hint,
  file,
  error,
  maxBytes,
  optional = false,
  disabled = false,
  camera = false,
  onChange,
}: IdentityImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  /*
   * La cámara sólo existe en un contexto seguro y con permiso de la cabecera
   * `Permissions-Policy`. Se comprueba en un efecto y no al renderizar porque
   * `navigator` no existe en el servidor, y leerlo durante el render haría que
   * lo pintado en el servidor y lo pintado en el cliente no coincidieran.
   */
  const [hayCamara, setHayCamara] = useState(false);
  useEffect(() => {
    setHayCamara(typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia));
  }, []);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="field identity-image-field">
      <span className="field-label" id={`${id}-label`}>
        {label}
        {optional ? <span className="identity-optional"> · opcional</span> : null}
      </span>

      <div className={`identity-image-picker${disabled ? ' is-disabled' : ''}`}>
        {preview ? (
          // `alt` describe QUÉ es, no qué se ve: nadie puede describir el
          // contenido de una foto que el usuario acaba de elegir.
          <img className="identity-image-preview" src={preview} alt={`Vista previa: ${label}`} />
        ) : (
          <div className="identity-image-empty" aria-hidden="true" />
        )}

        <div className="identity-image-actions">
          <button
            type="button"
            className="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {file ? 'Cambiar' : 'Elegir imagen'}
          </button>
          {camera && hayCamara ? (
            <button
              type="button"
              className="button"
              disabled={disabled}
              onClick={() => setCamaraAbierta(true)}
            >
              <Camera size={15} aria-hidden="true" />
              Tomar con la cámara
            </button>
          ) : null}
          {file ? (
            <button
              type="button"
              className="button"
              disabled={disabled}
              onClick={() => {
                // También se limpia el input: sin esto, volver a elegir el MISMO
                // archivo no dispara `change` y parece que no pasó nada.
                if (inputRef.current) inputRef.current.value = '';
                onChange(null, null);
              }}
            >
              Quitar
            </button>
          ) : null}
        </div>

        <input
          ref={inputRef}
          type="file"
          // `accept` sólo filtra el diálogo del sistema, por comodidad. No es
          // una garantía: quien quiera puede elegir «todos los archivos».
          accept={ACCEPTED.join(',')}
          className="worker-file-input"
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-help`}
          disabled={disabled}
          onChange={(event) => {
            const picked = event.target.files?.[0];
            onChange(picked ?? null, picked ? validate(picked, maxBytes) : null);
          }}
        />
      </div>

      {file ? (
        <p className="identity-image-name">
          <span className="worker-file-name">{file.name}</span>
          <span className="worker-file-size">{formatBytes(file.size)}</span>
        </p>
      ) : null}

      <small id={`${id}-help`} className="field-help">
        {hint}
      </small>

      {error ? (
        <p className="field-help is-error" role="alert">
          {error}
        </p>
      ) : null}

      {camaraAbierta ? (
        <CameraCaptureDialog
          onCapture={(tomada) => {
            // Pasa por la MISMA validación que un archivo elegido a mano: el
            // techo de tamaño y el formato no dependen de por dónde entró.
            onChange(tomada, validate(tomada, maxBytes));
          }}
          onClose={() => setCamaraAbierta(false)}
        />
      ) : null}
    </div>
  );
}

/** Comprobaciones que el navegador sí puede hacer antes de subir. */
function validate(file: File, maxBytes: number): string | null {
  if (file.size === 0) return 'El archivo está vacío.';
  if (file.size > maxBytes) {
    return `La imagen pesa ${formatBytes(file.size)} y el máximo es ${formatBytes(maxBytes)}.`;
  }
  const looksImage = ACCEPTED.includes(file.type) || /\.(jpe?g|png|webp|jfif)$/i.test(file.name);
  if (!looksImage) return 'Sólo se admiten imágenes JPEG, PNG o WebP.';
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KiB`;
  return `${(bytes / 1_048_576).toFixed(1)} MiB`;
}
