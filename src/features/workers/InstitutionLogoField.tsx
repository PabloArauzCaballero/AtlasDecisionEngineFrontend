'use client';

import { useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { InstitutionLogo } from './InstitutionLogo';
import { LOGO_SOURCE_LABELS, type FinancialInstitution } from './institutions.api';

/**
 * El logotipo de una entidad, dentro del formulario del padrón.
 *
 * ## Por qué es un campo aparte y no una escritura más del formulario
 *
 * Porque va a otra ruta. Mezclarlo con el resto obligaría a mandar la imagen entera cada vez que
 * alguien corrige un marcador —una entidad son 256 KiB de más por cada guardado— y, peor, haría que
 * un error de imagen tirase el guardado de la entidad completa. Son dos escrituras porque son dos
 * hechos: qué reconoce esta entidad, y con qué cara se enseña.
 *
 * ## Y por qué el logotipo no interviene en nada
 *
 * Ni atribuye documentos ni cambia ningún veredicto: la atribución la deciden los marcadores. Está
 * dicho en el pie del campo a propósito, porque una imagen dentro de un formulario que SÍ cambia
 * qué documentos acepta el motor invita a suponer lo contrario.
 */

/** Lo que el motor admite. La comprobación de verdad está en el servidor. */
const TIPOS_DE_LOGO = ['image/svg+xml', 'image/png', 'image/jpeg'];
/** 256 KiB. El mismo tope que aplica el motor, dicho antes de subir. */
const MAX_LOGO_BYTES = 256 * 1024;

export interface InstitutionLogoFieldProps {
  entidad: FinancialInstitution;
  ocupado: boolean;
  onCargar?: (input: { base64: string; contentType: string }) => void;
  onQuitar?: () => void;
}

export function InstitutionLogoField({
  entidad,
  ocupado,
  onCargar,
  onQuitar,
}: InstitutionLogoFieldProps) {
  const [error, setError] = useState<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);

  const elegir = (file: File) => {
    setError(null);
    if (!TIPOS_DE_LOGO.includes(file.type)) {
      setError('Sólo SVG, PNG o JPEG.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError('El logotipo no puede pasar de 256 KiB.');
      return;
    }
    const lector = new FileReader();
    lector.onload = () =>
      onCargar?.({ base64: String(lector.result ?? ''), contentType: file.type });
    lector.onerror = () => setError('No se pudo leer el archivo.');
    lector.readAsDataURL(file);
  };

  return (
    <div className="field">
      <span className="field-label">Logotipo</span>
      <div className="entidad-logo-editor">
        <InstitutionLogo
          code={entidad.code}
          name={entidad.name}
          hasLogo={entidad.hasLogo}
          size={64}
        />
        <div className="entidad-logo-acciones">
          <input
            ref={archivo}
            type="file"
            accept={TIPOS_DE_LOGO.join(',')}
            hidden
            onChange={(evento) => {
              const file = evento.target.files?.[0];
              // El valor se limpia SIEMPRE, y antes de leer: sin esto, volver a elegir el mismo
              // archivo tras un error no dispara `change` y el botón parece roto.
              evento.target.value = '';
              if (file) elegir(file);
            }}
          />
          <button
            type="button"
            className="button button-small"
            disabled={ocupado}
            onClick={() => archivo.current?.click()}
          >
            <Upload size={14} aria-hidden="true" />{' '}
            {entidad.hasLogo ? 'Reemplazar' : 'Cargar logotipo'}
          </button>
          {entidad.hasLogo ? (
            <button
              type="button"
              className="button button-small"
              disabled={ocupado}
              onClick={() => onQuitar?.()}
            >
              <Trash2 size={14} aria-hidden="true" /> Quitar
            </button>
          ) : null}
          {entidad.logoSource ? (
            <small className="field-help">
              {LOGO_SOURCE_LABELS[entidad.logoSource].label} ·{' '}
              {LOGO_SOURCE_LABELS[entidad.logoSource].detail}
            </small>
          ) : null}
        </div>
      </div>
      {error ? <span className="field-error">{error}</span> : null}
      <small className="field-help">
        El logotipo es sólo para reconocer la entidad de un vistazo: no interviene en la atribución
        de ningún documento, que la deciden los marcadores.
      </small>
    </div>
  );
}
