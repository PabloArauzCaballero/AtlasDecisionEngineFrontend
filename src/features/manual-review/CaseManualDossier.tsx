import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { CarruselDeDocumentos } from '../../components/CarruselDeDocumentos';
import { Field } from '../../components/Field';
import { imagenesDeExpediente } from './expediente-images';

/**
 * Ver las imágenes de un expediente indicado a mano.
 *
 * Los casos anteriores a que el `requestId` llevara al cliente sólo se ataban a él por el intento de
 * verificación, y si el intento ya no existe el caso no dice de quién es. Quien revisa SÍ lo sabe (el
 * número que muestra el portal en `/internal/files/<n>`): se lo pide aquí, o llega en `?expediente=`.
 * Es sólo lectura y el servidor sigue decidiendo si ese rol puede abrirlo.
 */
function expedienteDeLaUrl(): string {
  if (typeof window === 'undefined') return '';
  const valor = new URLSearchParams(window.location.search).get('expediente') ?? '';
  return /^\d+$/.test(valor) ? valor : '';
}

export function CaseManualDossier() {
  const [escrito, setEscrito] = useState(expedienteDeLaUrl);
  const [pedido, setPedido] = useState(expedienteDeLaUrl);
  const [abierto, setAbierto] = useState(() => Boolean(expedienteDeLaUrl()));
  const query = useQuery({
    queryKey: ['case-manual-dossier', pedido],
    enabled: /^\d+$/.test(pedido),
    queryFn: ({ signal }) => imagenesDeExpediente(pedido, signal),
  });

  useEffect(() => {
    const urls = query.data?.map((imagen) => imagen.objectUrl) ?? [];
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [query.data]);

  if (!abierto) {
    return (
      <div className="stack-actions">
        <button type="button" className="button" onClick={() => setAbierto(true)}>
          Indicar el expediente a mano
        </button>
      </div>
    );
  }

  return (
    <div className="stack-actions">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPedido(escrito.trim());
        }}
      >
        <Field
          label="Número de expediente"
          tooltip="El número que aparece en «Archivos» del portal interno para este cliente."
        >
          <input
            inputMode="numeric"
            value={escrito}
            onChange={(event) => setEscrito(event.target.value)}
            placeholder="54"
          />
        </Field>{' '}
        <button type="submit" className="button" disabled={!/^\d+$/.test(escrito.trim())}>
          Ver imágenes
        </button>
      </form>
      {query.isLoading ? <p className="muted">Cargando las imágenes…</p> : null}
      {query.error ? (
        <p className="muted">No se pudo abrir ese expediente. Revisa el número y tu permiso.</p>
      ) : null}
      {query.data && !query.data.length ? (
        <p className="muted">Ese expediente no tiene imágenes.</p>
      ) : null}
      {query.data?.length ? (
        <CarruselDeDocumentos
          etiquetaDelGrupo="Documentos del expediente"
          documentos={query.data.map((imagen) => ({
            id: imagen.nodoId,
            etiqueta: imagen.nombre,
            objectUrl: imagen.objectUrl,
            pie: imagen.sha256 ? `${imagen.sha256.slice(0, 12)}…` : undefined,
          }))}
        />
      ) : null}
    </div>
  );
}
