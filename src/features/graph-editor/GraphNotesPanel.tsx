import { useMutation, useQuery } from '@tanstack/react-query';
import { StickyNote } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/http-client';
import { useNotifications } from '../../notifications/useNotifications';
import { asRecord, type UnknownRecord } from '../../utils/records';

/**
 * Notas explicativas de la versión del grafo. Se cargan y guardan por su cuenta
 * (getVersion + PATCH .../notes) para no acoplar el estado del editor. Sirven
 * para documentar la lógica: por qué existe cada rama, supuestos, decisiones.
 */
export function GraphNotesPanel({ versionId }: { versionId: string }) {
  const { notify } = useNotifications();
  const [notes, setNotes] = useState('');
  const [dirty, setDirty] = useState(false);

  const query = useQuery({
    queryKey: ['version-notes', versionId],
    queryFn: () =>
      apiRequest<UnknownRecord>(`/v1/artifact-versions/${encodeURIComponent(versionId)}`),
    enabled: Boolean(versionId),
  });

  useEffect(() => {
    if (!query.data || dirty) return;
    const raw = asRecord(query.data).authoringNotes;
    setNotes(typeof raw === 'string' ? raw : '');
  }, [query.data, dirty]);

  const save = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/artifact-versions/${encodeURIComponent(versionId)}/notes`, {
        method: 'PATCH',
        body: { notes },
      }),
    onSuccess: () => {
      setDirty(false);
      notify({
        tone: 'success',
        title: 'Notas guardadas',
        description: 'Las notas del grafo se actualizaron.',
      });
    },
    /*
     * El fallo NO se anuncia aquí. El `MutationCache` de QueryProvider ya lo
     * hace por toda mutación que no declare `meta.handled`, así que este aviso
     * propio salía además del global: dos tarjetas para un único fallo, y la de
     * aquí era la peor de las dos —sin el motivo del backend ni la referencia
     * de la petición—.
     */
  });

  if (!versionId) return null;

  return (
    <section className="graph-notes">
      <header className="graph-notes-head">
        <StickyNote size={16} aria-hidden /> Notas del grafo
      </header>
      <textarea
        className="graph-notes-input"
        value={notes}
        rows={5}
        placeholder="Documenta esta versión: por qué existe cada rama, supuestos y decisiones de negocio detrás del flujo…"
        onChange={(event) => {
          setNotes(event.target.value);
          setDirty(true);
        }}
      />
      <div className="graph-notes-foot">
        <span className="graph-notes-hint">{dirty ? 'Cambios sin guardar' : 'Guardado'}</span>
        <button
          className="button button-primary"
          type="button"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Guardando…' : 'Guardar notas'}
        </button>
      </div>
    </section>
  );
}
