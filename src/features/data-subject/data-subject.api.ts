'use client';

import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';

/**
 * Derechos del titular de datos (LGPD art. 18 y 20; CCPA/CPRA §1798.100 y ss.).
 *
 * Son mutaciones las DOS, incluido el historial, y no consultas con clave. No es una torpeza:
 * la referencia del titular no puede viajar en una URL —acabaría en el registro de acceso, en
 * el proxy y en la traza— así que el motor la recibe en el cuerpo de un `POST`. Y guardarla en
 * una `queryKey` de React Query la dejaría en la caché del navegador de quien atiende el canal,
 * que es exactamente donde no debe quedarse.
 */
export const REQUEST_TYPES = [
  {
    code: 'ACCESS',
    label: 'Acceso',
    hint: 'Qué decisiones se tomaron sobre esta persona (art. 18 I y II).',
  },
  {
    code: 'PORTABILITY',
    label: 'Portabilidad',
    hint: 'Las mismas decisiones, para entregárselas (art. 18 V).',
  },
  {
    code: 'ERASURE',
    label: 'Eliminación',
    hint: 'No alcanza la cadena de auditoría, que es inmutable por obligación legal (art. 16 I).',
  },
  {
    code: 'REVIEW',
    label: 'Revisión humana',
    hint: 'Pedir que una persona revise una decisión automatizada (art. 20).',
  },
] as const;

/** El motivo tal como se le puede leer al titular. El mensaje INTERNO nunca sale hacia él. */
export interface DataSubjectReason {
  code: string;
  message: string;
  adverseAction: boolean;
}

export interface DataSubjectDecision {
  executionId: string;
  artifactCode?: string;
  /** Nombre legible del artefacto y su versión: «v3» explica más que un identificador. */
  artifactName?: string;
  versionNumber?: number;
  decisionStatus?: string;
  status?: string;
  outcome?: string | null;
  businessOutcome?: string | null;
  executedAt?: string;
  /**
   * Los motivos comunicables de la decisión.
   *
   * Es lo que convierte el derecho de acceso en algo útil: sin ellos, al titular se le entrega la
   * lista de veces que se decidió sobre él y ninguna explicación de por qué.
   */
  reasons?: DataSubjectReason[];
}

export interface DataSubjectResult {
  id: string;
  requestType: string;
  status: string;
  createdAt: string;
  matchedDecisions: number;
  decisions?: DataSubjectDecision[];
  resolution?: unknown;
}

export interface DataSubjectHistoryItem {
  id: string;
  requestType: string;
  status: string;
  receivedBy: string;
  reference?: string | null;
  createdAt: string;
}

export function useSubmitDataSubjectRequest() {
  return useMutation({
    mutationFn: (input: { subjectReference: string; requestType: string; reference?: string }) =>
      apiRequest<DataSubjectResult>('/v1/data-subject-requests', { method: 'POST', body: input }),
  });
}

export function useDataSubjectHistory() {
  return useMutation({
    mutationFn: (subjectReference: string) =>
      apiRequest<{ total: number; items: DataSubjectHistoryItem[] }>(
        '/v1/data-subject-requests/history',
        { method: 'POST', body: { subjectReference } },
      ),
  });
}
