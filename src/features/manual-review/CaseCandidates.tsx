import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiRequest } from '../../api/http-client';
import { CaseManualDossier } from './CaseManualDossier';
import { ArchivosDelExpediente } from './ArchivosDelExpediente';
import { imagenesDeExpediente, type ImagenDeExpediente } from './expediente-images';

/**
 * Los expedientes que subieron su carnet cuando se abrió este caso.
 *
 * Un caso anterior a que el `requestId` llevara al cliente sólo se ataba a él por el intento de
 * verificación, y si ya no existe nadie sabe de quién es. La verificación se ejecuta segundos
 * después de subirse el carnet, así que se buscan los expedientes con imágenes del alta subidas en
 * la ventana previa. Es una coincidencia de HORA, no una identificación: se presenta como candidata
 * y quien revisa es quien confirma que la persona del carnet es la del caso.
 */
interface Candidato {
  expedienteId: string;
  customerCode: string | null;
  imagenes: { nodoId: string; nombre: string; creadoEn: string }[];
}

interface Grupo extends Candidato {
  fotos: ImagenDeExpediente[];
}

interface Resultado {
  candidatos: number;
  grupo: Grupo | null;
}

const ANTES_MS = 30 * 60_000;
const DESPUES_MS = 2 * 60_000;

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
}

export function CaseCandidates({ executedAt }: Readonly<{ executedAt: string }>) {
  const momento = Date.parse(executedAt);
  const valido = Number.isFinite(momento);
  const query = useQuery({
    queryKey: ['case-candidates', executedAt],
    enabled: valido,
    retry: false,
    queryFn: async ({ signal }): Promise<Resultado> => {
      const desde = new Date(momento - ANTES_MS).toISOString();
      const hasta = new Date(momento + DESPUES_MS).toISOString();
      const candidatos = await apiRequest<Candidato[]>(
        `/atlas-backend/expedientes/por-momento?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}&subjectType=customer`,
        { signal },
      );
      const lista = Array.isArray(candidatos) ? candidatos : [];
      /*
       * SÓLO con exactamente un candidato se descargan imágenes. Con varios, la hora no distingue a
       * quién pertenece el caso, y enseñar el carnet de otra persona como si fuera el del caso es
       * peor que no enseñar nada: se cuenta cuántos hay y se pide el expediente a mano.
       */
      if (lista.length !== 1) return { candidatos: lista.length, grupo: null };
      const unico = lista[0] as Candidato;
      return {
        candidatos: 1,
        grupo: { ...unico, fotos: await imagenesDeExpediente(unico.expedienteId, signal) },
      };
    },
  });

  useEffect(() => {
    const urls = query.data?.grupo?.fotos.map((foto) => foto.objectUrl) ?? [];
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [query.data]);

  return (
    <div className="stack-actions">
      {query.isLoading ? <p className="muted">Buscando quién subió su carnet a esa hora…</p> : null}
      {query.data?.grupo ? (
        <>
          <p className="muted">
            <strong>Coincidencia por hora, no verificada:</strong> este es el único cliente que
            subió su carnet poco antes de que se abriera este caso. Confirma que la persona es la
            del caso antes de decidir.
          </p>
          <p className="muted">
            Expediente {query.data.grupo.expedienteId}
            {query.data.grupo.customerCode ? ` · ${query.data.grupo.customerCode}` : ''} — subió su
            carnet a las {hora(query.data.grupo.imagenes[0]?.creadoEn ?? executedAt)}
          </p>
          <ArchivosDelExpediente
            etiquetaDelGrupo={`Expediente ${query.data.grupo.expedienteId}`}
            archivos={query.data.grupo.fotos}
          />
        </>
      ) : null}
      {query.data && query.data.candidatos > 1 ? (
        <p className="muted">
          {query.data.candidatos} clientes subieron su carnet en la media hora previa a este caso y
          la hora no distingue cuál es. No se muestra ninguno para no mezclar personas: indica el
          expediente.
        </p>
      ) : null}
      {query.data && query.data.candidatos === 0 ? (
        <p className="muted">Nadie subió un carnet en la media hora previa a este caso.</p>
      ) : null}
      {query.error ? <p className="muted">No se pudo buscar por hora.</p> : null}
      <CaseManualDossier />
    </div>
  );
}
