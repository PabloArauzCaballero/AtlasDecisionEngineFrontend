import { Alert } from '../../components/Alert';
import { Panel } from '../../components/Panel';
import { asRecord } from '../../utils/records';
import {
  DossierAgenda,
  DossierDispositivo,
  DossierEvidencias,
  DossierPermisos,
  DossierUbicacion,
} from './OnboardingDossierDevice';
import {
  DossierCarnet,
  DossierCliente,
  DossierCronometro,
  DossierDeclarado,
} from './OnboardingDossierIdentity';
import { fecha, senalesDelAlta } from './onboarding-dossier';

/**
 * «Expediente del alta»: todo lo que el teléfono registró durante el alta del cliente.
 *
 * Lo adjunta AtlasBackend al caso (`evidenceJson.alta`) porque la revisión humana es obligatoria y
 * sin esto el revisor decidía mirando sólo el parecido de la selfie: sin el cronómetro, el
 * teléfono, la ubicación, la agenda ni lo declarado frente al carnet. Cada bloque dice
 * «No disponible» cuando no vino, en vez de fingir un cero.
 */
export function OnboardingDossierPanel({
  evidence,
}: Readonly<{ evidence: Record<string, unknown> }>) {
  const raw = evidence.alta;
  const alta = asRecord(raw);
  const hayExpediente = raw !== null && raw !== undefined && Object.keys(alta).length > 0;
  const actualizado = fecha(evidence.altaActualizadaEn ?? alta.generadoEn);

  if (!hayExpediente) {
    return (
      <Panel title="Expediente del alta" meta="No disponible">
        <p className="muted-note">
          Este caso no trae el expediente del alta del cliente. Si el caso es de identidad, lo envía
          el sistema central al terminar el alta; hasta entonces sólo se ve la evidencia del motor.
        </p>
      </Panel>
    );
  }

  const senales = senalesDelAlta(alta);
  const riesgos = senales.filter((senal) => senal.tono === 'riesgo');
  const avisos = senales.filter((senal) => senal.tono === 'aviso');

  return (
    <Panel
      title="Expediente del alta"
      meta={actualizado ? `actualizado ${actualizado}` : 'lo que registró el teléfono'}
    >
      {riesgos.length ? (
        <Alert tone="error">
          <strong>Señales de fraude</strong>
          <ul className="dossier-signals">
            {riesgos.map((senal) => (
              <li key={senal.texto}>{senal.texto}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {avisos.length ? (
        <Alert tone="warning">
          <strong>A revisar</strong>
          <ul className="dossier-signals">
            {avisos.map((senal) => (
              <li key={senal.texto}>{senal.texto}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {!senales.length ? (
        <p className="muted-note">
          El expediente no marca señales de fraude. Revísalo igual: la ausencia de una señal puede
          deberse a un dato que no llegó.
        </p>
      ) : null}
      <div className="dossier-blocks">
        <DossierCliente alta={alta} />
        <DossierDeclarado alta={alta} />
        <DossierCarnet alta={alta} />
        <DossierCronometro alta={alta} />
        <DossierDispositivo alta={alta} />
        <DossierPermisos alta={alta} />
        <DossierUbicacion alta={alta} />
        <DossierAgenda alta={alta} />
        <DossierEvidencias alta={alta} />
      </div>
    </Panel>
  );
}
