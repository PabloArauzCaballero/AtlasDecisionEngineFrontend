'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';
import { EmptyState } from '../../components/EmptyState';
import { Panel } from '../../components/Panel';
import { asPercent } from './decision-quality.api';

interface CutoffPoint {
  cutoff: number;
  approvalRate: number;
  approved: number;
  badRate: number | null;
  expectedLoss: number;
  confidenceHalfWidth: number | null;
}

interface CutoffCurve {
  artifactVersionId: string;
  scoreField: string;
  windowDays: number;
  analyzed: number;
  points: CutoffPoint[];
}

interface BranchComparison {
  deploymentId: string;
  branches: Array<{
    deploymentId: string;
    artifactVersionId: string;
    decisions: number;
    observed: number;
    approvalRate: number | null;
    badRate: number | null;
    confidenceHalfWidth: number | null;
  }>;
}

/**
 * Las dos conversaciones que el negocio quería tener y no podía.
 *
 * El punto de corte convierte «¿aflojamos el filtro?» —una discusión de opiniones donde quien
 * quiere volumen y quien quiere calidad tienen razón por separado— en una curva donde el
 * intercambio se ve. Y la comparación A/B enfrenta las ramas por DESENLACE, no por volumen:
 * repartir 90/10 y concluir que el champion es mejor porque tiene nueve veces más decisiones es
 * exactamente el error que un experimento debe impedir.
 *
 * Los dos son de LECTURA. Mover el corte sigue siendo cambiar el artefacto y pasar por gobierno:
 * un control que cambiara política de crédito desde una pantalla de análisis sería justo lo que
 * este motor existe para evitar.
 */
export function CutoffPanel() {
  const [form, setForm] = useState({
    artifactVersionId: '',
    scoreField: 'score',
    windowDays: '90',
  });
  const [deploymentId, setDeploymentId] = useState('');

  const curve = useQuery({
    queryKey: ['cutoff-analysis', form.artifactVersionId, form.scoreField, form.windowDays],
    enabled: form.artifactVersionId.trim() !== '',
    queryFn: ({ signal }) =>
      apiRequest<CutoffCurve>(
        `/v1/model-monitoring/cutoff-analysis?artifactVersionId=${encodeURIComponent(form.artifactVersionId.trim())}` +
          `&scoreField=${encodeURIComponent(form.scoreField.trim())}&windowDays=${form.windowDays}`,
        { signal },
      ),
  });

  const comparison = useQuery({
    queryKey: ['ab-comparison', deploymentId],
    enabled: deploymentId.trim() !== '',
    queryFn: ({ signal }) =>
      apiRequest<BranchComparison>(
        `/v1/model-monitoring/ab?deploymentId=${encodeURIComponent(deploymentId.trim())}`,
        { signal },
      ),
  });

  return (
    <div className="quality-stack">
      <Panel
        title="Punto de corte"
        meta="qué se aprobaría y cuánto se perdería con cada umbral"
        tutorialId="quality-cutoff"
      >
        <div className="quality-form-grid">
          <label className="field">
            <span>Versión del algoritmo</span>
            <input
              value={form.artifactVersionId}
              placeholder="4001"
              onChange={(event) => setForm({ ...form, artifactVersionId: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Campo del puntaje</span>
            <input
              value={form.scoreField}
              onChange={(event) => setForm({ ...form, scoreField: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Ventana (días)</span>
            <input
              value={form.windowDays}
              inputMode="numeric"
              onChange={(event) => setForm({ ...form, windowDays: event.target.value })}
            />
          </label>
        </div>
        <p className="quality-note">
          El corte se aplica con la convención «más alto = más riesgo»: se aprueba lo que queda por
          debajo. Si tu artefacto puntúa al revés, la curva sale invertida y se ve de inmediato.
        </p>
        {curve.data && <CurveTable curve={curve.data} />}
      </Panel>

      <Panel title="Champion contra challenger" meta="comparados por desenlace, no por volumen">
        <label className="field quality-filter">
          <span>Despliegue</span>
          <input
            value={deploymentId}
            placeholder="912"
            onChange={(event) => setDeploymentId(event.target.value)}
          />
        </label>
        {comparison.data && <BranchTable comparison={comparison.data} />}
      </Panel>
    </div>
  );
}

function CurveTable({ curve }: { curve: CutoffCurve }) {
  if (!curve.points.length) {
    return (
      <EmptyState
        illustration="empty"
        title="No hay curva que dibujar"
        description={`${curve.analyzed} casos con puntaje y desenlace observado; hacen falta al menos diez.`}
        example="La curva se calcula sólo con desenlaces OBSERVADOS: uno inferido la mediría contra la población que ya se aprobó."
      />
    );
  }
  return (
    <table className="data-table calibration-table">
      <thead>
        <tr>
          <th scope="col">Corte</th>
          <th scope="col">Se aprueba</th>
          <th scope="col">De ésos, malos</th>
          <th scope="col">Pérdida</th>
        </tr>
      </thead>
      <tbody>
        {curve.points.map((point) => (
          <tr key={point.cutoff}>
            <th scope="row">{point.cutoff}</th>
            <td>
              {asPercent(point.approvalRate)}{' '}
              <span className="quality-muted">({point.approved})</span>
            </td>
            <td>
              {asPercent(point.badRate)}
              {point.confidenceHalfWidth !== null && (
                <span className="quality-muted"> ± {asPercent(point.confidenceHalfWidth)}</span>
              )}
            </td>
            <td>{point.expectedLoss.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BranchTable({ comparison }: { comparison: BranchComparison }) {
  if (!comparison.branches.length) {
    return (
      <p className="quality-muted">Ese despliegue no tiene ramas con decisiones registradas.</p>
    );
  }
  return (
    <>
      <table className="data-table calibration-table">
        <thead>
          <tr>
            <th scope="col">Rama</th>
            <th scope="col">Versión</th>
            <th scope="col">Decisiones</th>
            <th scope="col">Observadas</th>
            <th scope="col">Aprobación</th>
            <th scope="col">Tasa de malos</th>
          </tr>
        </thead>
        <tbody>
          {comparison.branches.map((branch) => (
            <tr key={branch.deploymentId}>
              <th scope="row">{branch.deploymentId}</th>
              <td>{branch.artifactVersionId}</td>
              <td>{branch.decisions}</td>
              <td>{branch.observed}</td>
              <td>{asPercent(branch.approvalRate)}</td>
              <td>
                {asPercent(branch.badRate)}
                {branch.confidenceHalfWidth !== null && (
                  <span className="quality-muted"> ± {asPercent(branch.confidenceHalfWidth)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="quality-note">
        El intervalo no es adorno: dos puntos porcentuales de diferencia sobre cuarenta casos no son
        una diferencia. Si los intervalos de dos ramas se solapan, el experimento todavía no ha
        concluido nada.
      </p>
    </>
  );
}
