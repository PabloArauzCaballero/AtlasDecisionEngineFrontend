'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';

/*
 * Rutas ENTERAS, nunca compuestas. El inventario de superficie lee una ruta interpolada como un
 * comodín de un segmento, y aquí eso daría por consumidas las once operaciones del grupo con una
 * sola llamada — incluidas las que nadie mira.
 */

export interface ExposureLimit {
  id: string;
  limitCode: string;
  /** Cadena vacía = toda la cartera. */
  segment: string;
  maxValue: number;
  currencyCode: string;
  enforced: boolean;
  currentValue: number;
  utilization: number;
  exceeded: boolean;
  blocking: boolean;
}

export interface Consent {
  id: string;
  purpose: string;
  basis: string;
  grantedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  valid: boolean;
  reason: 'VALID' | 'MISSING' | 'REVOKED' | 'EXPIRED' | 'NOT_YET_GRANTED';
  daysRemaining: number | null;
}

export interface Reidentification {
  id: string;
  subjectId: string;
  purpose: string;
  status: string;
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
}

export interface CalibrationReport {
  artifactVersionId: string;
  windowDays: number;
  analyzed: number;
  buckets: Array<{
    decile: number;
    predictedRate: number;
    observedRate: number;
    sampleSize: number;
  }>;
  hosmerLemeshow: number | null;
  meanBias: number | null;
}

export function useExposureLimits() {
  return useQuery({
    queryKey: ['exposure-limits'],
    queryFn: ({ signal }) =>
      apiRequest<{ items: ExposureLimit[] }>('/v1/risk-governance/limits', { signal }),
  });
}

export function useUpsertLimit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      limitCode: string;
      segment?: string;
      maxValue: number;
      currencyCode: string;
      enforced: boolean;
    }) => apiRequest<{ id: string }>('/v1/risk-governance/limits', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exposure-limits'] }),
  });
}

export function useRecordPortfolioState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { asOf: string; metricCode: string; segment?: string; value: number }) =>
      apiRequest<{ id: string }>('/v1/risk-governance/portfolio-state', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exposure-limits'] }),
  });
}

/**
 * Los permisos de un titular.
 *
 * Mutación y no consulta, aunque sólo lea: la referencia del titular viaja en el cuerpo —en la URL
 * acabaría en el registro de acceso y en la traza— y guardarla en una `queryKey` la dejaría en la
 * caché del navegador de quien atiende el canal, que es exactamente donde no debe quedarse.
 */
export function useConsentLookup() {
  return useMutation({
    mutationFn: (subjectReference: string) =>
      apiRequest<{ items: Consent[] }>('/v1/risk-governance/consents/lookup', {
        method: 'POST',
        body: { subjectReference, purpose: '-' },
      }),
  });
}

export function useRecordConsent() {
  return useMutation({
    mutationFn: (input: {
      subjectReference: string;
      purpose: string;
      basis: string;
      grantedAt: string;
      expiresAt?: string;
      evidenceRef?: string;
    }) =>
      apiRequest<{ id: string }>('/v1/risk-governance/consents', { method: 'POST', body: input }),
  });
}

export function useRevokeConsent() {
  return useMutation({
    mutationFn: (input: { subjectReference: string; purpose: string }) =>
      apiRequest<{ id: string }>('/v1/risk-governance/consents/revoke', {
        method: 'POST',
        body: input,
      }),
  });
}

export function useReidentifications() {
  return useQuery({
    queryKey: ['reidentifications'],
    queryFn: ({ signal }) =>
      apiRequest<{ items: Reidentification[] }>('/v1/risk-governance/reidentifications', {
        signal,
      }),
  });
}

export function useRequestReidentification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { subjectReference: string; purpose: string }) =>
      apiRequest<{ id: string }>('/v1/risk-governance/reidentifications', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reidentifications'] }),
  });
}

export function useDecideReidentification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { requestId: string; approve: boolean }) =>
      apiRequest<{ id: string; status: string }>('/v1/risk-governance/reidentifications/decide', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reidentifications'] }),
  });
}

export function useStoredCalibration(artifactVersionId: string, windowDays: number) {
  return useQuery({
    queryKey: ['calibration', artifactVersionId, windowDays],
    enabled: artifactVersionId.trim() !== '',
    queryFn: ({ signal }) =>
      apiRequest<CalibrationReport>(
        `/v1/risk-governance/calibration?artifactVersionId=${encodeURIComponent(artifactVersionId)}&windowDays=${windowDays}`,
        { signal },
      ),
  });
}

export function useComputeCalibration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      artifactVersionId: string;
      windowDays: number;
      predictionField: string;
    }) =>
      apiRequest<CalibrationReport>('/v1/risk-governance/calibration', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calibration'] }),
  });
}

export function useRecordDossier() {
  return useMutation({
    mutationFn: (input: {
      artifactVersionId: string;
      validatedBy: string;
      validatedAt: string;
      revalidationDueAt: string;
      limitationsNotes?: string;
    }) =>
      apiRequest<{ artifactVersionId: string }>('/v1/risk-governance/model-dossier', {
        method: 'POST',
        body: input,
      }),
  });
}

/**
 * Cómo se lee un veredicto de consentimiento.
 *
 * `MISSING` sale en ámbar y no en rojo a propósito: significa que no hay constancia, que no es lo
 * mismo que una negativa. Rojo se reserva para lo que sí es una prohibición activa —revocado— o un
 * permiso que ya venció.
 */
export function consentTone(reason: Consent['reason']): 'success' | 'warning' | 'danger' {
  if (reason === 'VALID') return 'success';
  return reason === 'MISSING' || reason === 'NOT_YET_GRANTED' ? 'warning' : 'danger';
}
