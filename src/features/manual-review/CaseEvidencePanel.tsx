import { Panel } from '../../components/Panel';
import { DossierFacts, type DossierFact } from './DossierFacts';
import { BOT_SCORE_ALTO, num, numero, segundos, siNo, texto } from './onboarding-dossier';

type Formato = (value: unknown) => string | null;

interface ClaveConocida {
  label: string;
  formato?: Formato;
  /** Cuándo el valor es una señal de fraude o de mayor riesgo. */
  tono?: (value: unknown) => 'riesgo' | 'aviso' | null;
}

const siNoFmt: Formato = (value) => siNo(value) ?? texto(value);

/**
 * Las claves que el motor escribe en `evidenceJson`, con su nombre para una persona.
 *
 * Las nueve de siempre más las siete de comportamiento que el artefacto de identidad añade cuando
 * escala por cómo se hizo el alta. Antes la pantalla pintaba sólo las nueve, así que un caso abierto
 * POR comportamiento mecánico llegaba sin enseñar el comportamiento.
 */
export const CLAVES_DE_EVIDENCIA: Readonly<Record<string, ClaveConocida>> = {
  motivo: { label: 'Motivo' },
  senal: { label: 'Señal que lo abrió' },
  parecido: { label: 'Parecido con el documento' },
  tipoDocumento: { label: 'Tipo de documento' },
  pruebaDeVida: { label: 'Prueba de vida' },
  decisionDelWorker: { label: 'Veredicto del worker' },
  veredictoDeFraude: { label: 'Autenticidad del documento' },
  riesgoDeFraude: { label: 'Riesgo de fraude documental' },
  registroEstatal: { label: 'Registro estatal (SEGIP)' },
  riesgoDeAgenda: { label: 'Riesgo de la agenda (0-100)' },
  segundosTotal: { label: 'Duración total del alta', formato: segundos },
  segundosIdentidad: { label: 'Duración del paso de identidad', formato: segundos },
  pegadoEnCarnet: {
    label: 'Carnet pegado (no escrito)',
    formato: siNoFmt,
    tono: (value) => (value === true || value === 'true' ? 'riesgo' : null),
  },
  correccionesOcr: { label: 'Correcciones a la lectura del carnet', formato: (v) => numero(v) },
  capturaInterrumpida: {
    label: 'Salió de la app durante la captura',
    formato: siNoFmt,
    tono: (value) => (value === true || value === 'true' ? 'aviso' : null),
  },
  abandonosPrevios: { label: 'Altas abandonadas antes', formato: (v) => numero(v) },
  botScore: {
    label: 'Indicio de automatización (0-1)',
    formato: (v) => numero(v, 2),
    tono: (value) => ((num(value) ?? 0) >= BOT_SCORE_ALTO ? 'riesgo' : null),
  },
};

/** Lo que va en su propio panel («Expediente del alta»), no aquí. */
const CLAVES_APARTE = new Set(['alta', 'altaActualizadaEn']);

/** Un valor desconocido, legible: booleanos en palabras, objetos en JSON compacto. */
function generico(value: unknown): string | null {
  return siNo(value) ?? texto(value);
}

export function evidenceFacts(evidence: Record<string, unknown>): {
  conocidas: DossierFact[];
  otras: DossierFact[];
} {
  const conocidas: DossierFact[] = [];
  const otras: DossierFact[] = [];
  for (const [key, value] of Object.entries(evidence)) {
    if (CLAVES_APARTE.has(key)) continue;
    const conocida = CLAVES_DE_EVIDENCIA[key];
    if (conocida) {
      conocidas.push({
        label: conocida.label,
        value: (conocida.formato ?? generico)(value),
        tono: conocida.tono?.(value) ?? null,
      });
    } else {
      otras.push({ label: key, value: generico(value), mono: typeof value === 'object' });
    }
  }
  return { conocidas, otras };
}

/**
 * La evidencia con la que llegó el caso: TODAS sus claves.
 *
 * Las conocidas con su nombre en español; las que la pantalla aún no conoce, con su clave tal cual
 * en una lista aparte. Una clave nueva del artefacto no puede quedar invisible sólo porque nadie la
 * añadió a una lista fija: el revisor decide con lo que ve.
 */
export function CaseEvidencePanel({ evidence }: Readonly<{ evidence: Record<string, unknown> }>) {
  const { conocidas, otras } = evidenceFacts(evidence);
  if (!conocidas.length && !otras.length) {
    return (
      <Panel title="Evidencia del caso" meta="No disponible">
        <p className="muted-note">El caso no trae evidencia del motor.</p>
      </Panel>
    );
  }
  return (
    <Panel title="Evidencia del caso" meta="lo que midió el motor">
      {conocidas.length ? <DossierFacts items={conocidas} /> : null}
      {otras.length ? (
        <section className="dossier-block" aria-label="Otros datos de la evidencia">
          <h3 className="dossier-block__title">Otros datos de la evidencia</h3>
          <DossierFacts items={otras} />
        </section>
      ) : null}
    </Panel>
  );
}
