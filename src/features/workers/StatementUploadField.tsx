'use client';

import { useRef, useState } from 'react';

interface StatementUploadFieldProps {
  file: File | null;
  error: string | null;
  maxBytes: number;
  disabled?: boolean;
  onChange: (file: File | null, error: string | null) => void;
}

/**
 * Selección del PDF, con validación previa y arrastrar-y-soltar.
 *
 * La validación de aquí es para **responder rápido**, no para proteger: el
 * backend vuelve a comprobarlo todo, y además mira la firma real del contenido,
 * cosa que el navegador no puede hacer sin leer el archivo entero. Lo que se
 * gana es no subir 9 MiB para que los rechacen.
 *
 * El área acepta arrastrar, pero **también hay un botón**: arrastrar no funciona
 * con teclado ni con lector de pantalla, así que ofrecerlo como única vía dejaría
 * la función fuera del alcance de parte de los usuarios.
 */
export function StatementUploadField({
  file,
  error,
  maxBytes,
  disabled = false,
  onChange,
}: StatementUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function accept(picked: File | undefined) {
    if (!picked) {
      onChange(null, null);
      return;
    }
    onChange(picked, validate(picked, maxBytes));
  }

  return (
    <div className="field">
      <span className="field-label" id="worker-file-label">
        Archivo del extracto
      </span>

      <div
        className={`worker-drop${dragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`}
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer.files?.[0]);
        }}
      >
        <p className="worker-drop-hint">Arrastra el PDF aquí, o</p>
        <button
          type="button"
          className="btn ghost"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Elegir archivo
        </button>
        <input
          ref={inputRef}
          type="file"
          // `accept` sólo filtra el diálogo del sistema por comodidad. No es una
          // garantía: quien quiera puede elegir «todos los archivos».
          accept="application/pdf,.pdf"
          className="worker-file-input"
          aria-labelledby="worker-file-label"
          aria-describedby="worker-file-help"
          disabled={disabled}
          onChange={(event) => accept(event.target.files?.[0])}
        />
        <small id="worker-file-help" className="field-help">
          Un PDF, hasta {Math.round(maxBytes / 1_048_576)} MiB.
        </small>
      </div>

      {file ? (
        <div className="worker-file-chosen">
          <span className="worker-file-name">{file.name}</span>
          <span className="worker-file-size">{formatBytes(file.size)}</span>
          <button
            type="button"
            className="btn ghost"
            disabled={disabled}
            onClick={() => {
              // También se limpia el input: sin esto, volver a elegir el MISMO
              // archivo no dispara `change` y el usuario cree que no pasó nada.
              if (inputRef.current) inputRef.current.value = '';
              onChange(null, null);
            }}
          >
            Quitar
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="field-help is-error" role="alert">
          {error}
        </p>
      ) : null}

      <p className="worker-privacy-note">
        El documento se usa para la conversión y <strong>no se conserva</strong>: se borra en cuanto
        hay resultado. El número de cuenta se publica siempre enmascarado.
      </p>
    </div>
  );
}

/** Comprobaciones que el navegador sí puede hacer antes de subir. */
function validate(file: File, maxBytes: number): string | null {
  if (file.size === 0) return 'El archivo está vacío.';
  if (file.size > maxBytes) {
    return `El archivo pesa ${formatBytes(file.size)} y el máximo es ${formatBytes(maxBytes)}.`;
  }
  // Se mira el tipo declarado y la extensión, sabiendo que los dos se pueden
  // falsear. Es un aviso temprano para el caso honesto —alguien que eligió el
  // archivo equivocado—, no un control de seguridad.
  const looksPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!looksPdf) return 'Sólo se admiten archivos PDF.';
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KiB`;
  return `${(bytes / 1_048_576).toFixed(1)} MiB`;
}
