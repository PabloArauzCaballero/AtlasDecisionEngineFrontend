import type { DiapositivaDeDocumento } from './CarruselDeDocumentos';
import type { OperacionDeImagen, Seleccion } from './imagen-edicion';

const HERRAMIENTAS: { etiqueta: string; operacion: OperacionDeImagen }[] = [
  { etiqueta: '↺ Girar izquierda', operacion: { tipo: 'girar', sentido: 'antihorario' } },
  { etiqueta: '↻ Girar derecha', operacion: { tipo: 'girar', sentido: 'horario' } },
  { etiqueta: '⇆ Voltear horizontal', operacion: { tipo: 'voltear', eje: 'horizontal' } },
  { etiqueta: '⇅ Voltear vertical', operacion: { tipo: 'voltear', eje: 'vertical' } },
];

/** Barra de lectura bajo la imagen: girar, voltear, recortar y restablecer. */
export function BarraDeEdicion({
  activo,
  recortando,
  editada,
  seleccion,
  error,
  onEditar,
  onRecortar,
  onTerminarRecorte,
  onRestablecer,
}: Readonly<{
  activo: DiapositivaDeDocumento | undefined;
  recortando: boolean;
  editada: boolean;
  seleccion: Seleccion | null;
  error: boolean;
  onEditar: (operacion: OperacionDeImagen) => Promise<void> | void;
  onRecortar: () => void;
  onTerminarRecorte: () => void;
  onRestablecer: () => void;
}>) {
  if (!activo) return null;
  const valida = seleccion !== null && Math.abs(seleccion.x1 - seleccion.x0) >= 0.02;
  return (
    <div className="case-carousel__tools" role="toolbar" aria-label="Editar imagen">
      {recortando ? (
        <>
          <button
            type="button"
            className="case-carousel__tool"
            disabled={!valida}
            onClick={async () => {
              if (!seleccion) return;
              await onEditar({
                tipo: 'recortar',
                x: Math.min(seleccion.x0, seleccion.x1),
                y: Math.min(seleccion.y0, seleccion.y1),
                ancho: Math.abs(seleccion.x1 - seleccion.x0),
                alto: Math.abs(seleccion.y1 - seleccion.y0),
              });
              onTerminarRecorte();
            }}
          >
            Aplicar recorte
          </button>
          <button type="button" className="case-carousel__tool" onClick={onTerminarRecorte}>
            Cancelar
          </button>
          <span className="case-carousel__hint">Arrastra sobre la imagen para elegir el área.</span>
        </>
      ) : (
        <>
          {HERRAMIENTAS.map((herramienta) => (
            <button
              key={herramienta.etiqueta}
              type="button"
              className="case-carousel__tool"
              onClick={() => onEditar(herramienta.operacion)}
            >
              {herramienta.etiqueta}
            </button>
          ))}
          <button type="button" className="case-carousel__tool" onClick={onRecortar}>
            ✂ Recortar
          </button>
          {editada ? (
            <button type="button" className="case-carousel__tool" onClick={onRestablecer}>
              Restablecer
            </button>
          ) : null}
        </>
      )}
      {error ? (
        <span className="case-carousel__hint" role="alert">
          No se pudo editar esta imagen.
        </span>
      ) : null}
    </div>
  );
}
