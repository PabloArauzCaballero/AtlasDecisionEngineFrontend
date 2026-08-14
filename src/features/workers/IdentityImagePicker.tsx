import { IdentityImageField } from './IdentityImageField';

/**
 * Las tres imágenes de una verificación, con su aviso de tratamiento.
 *
 * Vive aparte de la consola porque los tres campos son UNA decisión de producto y no tres
 * controles sueltos: qué se pide, en qué orden, cuál es opcional y qué se promete a quien sube
 * la foto de su cédula y su propia cara. Repartido entre la página y los campos, ese conjunto
 * se cambia por partes y la promesa se descuelga del formulario que la sostiene.
 *
 * El aviso de que las imágenes **no se conservan** viaja pegado a los campos justamente por eso:
 * es una afirmación sobre lo que pasa al pulsar «Verificar», y sólo significa algo si se lee
 * antes de elegir el archivo.
 */
export interface IdentityImageSelection {
  readonly file: File | null;
  readonly error: string | null;
}

export interface IdentityImagePickerProps {
  readonly document: IdentityImageSelection;
  readonly documentBack: IdentityImageSelection;
  readonly selfie: IdentityImageSelection;
  readonly maxBytes: number;
  readonly disabled: boolean;
  readonly onDocumentChange: (file: File | null, error: string | null) => void;
  readonly onDocumentBackChange: (file: File | null, error: string | null) => void;
  readonly onSelfieChange: (file: File | null, error: string | null) => void;
}

export function IdentityImagePicker({
  document,
  documentBack,
  selfie,
  maxBytes,
  disabled,
  onDocumentChange,
  onDocumentBackChange,
  onSelfieChange,
}: IdentityImagePickerProps) {
  return (
    <>
      <div className="identity-images">
        <IdentityImageField
          id="identity-document"
          label="Documento (anverso)"
          hint="La cara del documento con la foto. JPEG, PNG o WebP."
          file={document.file}
          error={document.error}
          maxBytes={maxBytes}
          disabled={disabled}
          onChange={onDocumentChange}
        />
        <IdentityImageField
          id="identity-document-back"
          label="Documento (reverso)"
          hint="Sólo si el documento tiene dos caras: se contrasta que sean la misma."
          file={documentBack.file}
          error={documentBack.error}
          maxBytes={maxBytes}
          optional
          disabled={disabled}
          onChange={onDocumentBackChange}
        />
        <IdentityImageField
          id="identity-selfie"
          label="Selfie"
          hint="Un solo rostro, de frente y sin nada que lo tape. Puedes subirla o tomarla con la cámara."
          file={selfie.file}
          error={selfie.error}
          maxBytes={maxBytes}
          camera
          disabled={disabled}
          onChange={onSelfieChange}
        />
      </div>
      <p className="worker-privacy-note">
        Las imágenes se usan para verificar y <strong>no se conservan</strong>: el motor las borra
        en cuanto hay veredicto. El número del documento se publica siempre enmascarado.
      </p>
    </>
  );
}
