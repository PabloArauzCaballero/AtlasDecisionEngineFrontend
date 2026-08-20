import { apiRequest } from '../../api/http-client';

/**
 * El padrón de entidades financieras bolivianas del worker de extractos.
 *
 * No es una pantalla de mantenimiento cualquiera: **cada fila que se escribe
 * aquí cambia qué documentos acepta el motor**. Añadir un marcador hace que los
 * extractos de un banco dejen de rechazarse; marcar una licencia como revocada
 * hace que los suyos pasen a revisión humana; dar de baja una entidad hace que
 * sus extractos caigan en «emisor no reconocido», que es un rechazo. El motor
 * recoge el cambio en cuanto caduca su instantánea del padrón (≤ 1 min).
 */

export type InstitutionKind =
  | 'MULTIPLE_BANK'
  | 'PYME_BANK'
  | 'STATE_BANK'
  | 'DEVELOPMENT_BANK'
  | 'HOUSING_ENTITY'
  | 'COOPERATIVE'
  | 'DEVELOPMENT_IFD';

export type InstitutionLicenseStatus = 'LICENSED' | 'SUSPENDED' | 'REVOKED';

export interface FinancialInstitution {
  code: string;
  name: string;
  kind: InstitutionKind;
  licenseStatus: InstitutionLicenseStatus;
  retailDeposits: boolean;
  /** Expresiones regulares que atribuyen un documento a esta entidad. */
  markers: string[];
  /** Expresiones que ANULAN la atribución aunque un marcador coincida. */
  exclusions: string[];
  note: string | null;
  isActive: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

export interface InstitutionSummary {
  active: number;
  byKind: Record<string, number>;
  withoutLicense: number;
  /** Siglas de la nómina ASFI que faltan en el padrón. Vacío es lo esperado. */
  missingFromSeed: string[];
}

export interface InstitutionSeedSummary {
  total: number;
  created: string[];
  dryRun: boolean;
}

/**
 * Cómo se llama cada tipo en la pantalla, y por qué se traduce.
 *
 * La clave del enum es la que viaja y la que se puede cruzar con un reporte del
 * regulador; el rótulo es el que usa ASFI en su nómina. Enseñar `PYME_BANK` a
 * quien administra el padrón le obligaría a traducir mentalmente una lista que
 * ya conoce por su nombre oficial.
 */
export const INSTITUTION_KIND_LABELS: Record<InstitutionKind, string> = {
  MULTIPLE_BANK: 'Banco múltiple',
  PYME_BANK: 'Banco PYME',
  STATE_BANK: 'Banco del Estado',
  DEVELOPMENT_BANK: 'Banca de segundo piso',
  HOUSING_ENTITY: 'Entidad financiera de vivienda',
  COOPERATIVE: 'Cooperativa de ahorro y crédito',
  DEVELOPMENT_IFD: 'Institución financiera de desarrollo',
};

export const LICENSE_STATUS_LABELS: Record<InstitutionLicenseStatus, string> = {
  LICENSED: 'Licencia vigente',
  SUSPENDED: 'Suspendida',
  REVOKED: 'Revocada',
};

const RUTA = '/v1/workers/bank-statement/institutions';

export function fetchInstitutions(
  includeInactive: boolean,
  signal?: AbortSignal,
): Promise<FinancialInstitution[]> {
  return apiRequest<FinancialInstitution[]>(
    includeInactive ? `${RUTA}?includeInactive=true` : RUTA,
    { signal },
  );
}

export function fetchInstitutionSummary(signal?: AbortSignal): Promise<InstitutionSummary> {
  return apiRequest<InstitutionSummary>('/v1/workers/bank-statement/institutions/summary', {
    signal,
  });
}

/**
 * Crear y editar son la MISMA operación contra el motor, que hace `upsert` por
 * código. Separarlas sólo añadiría una forma de equivocarse: dos botones que
 * hacen lo mismo y un error de «ya existe» que no ayuda a nadie.
 */
export function saveInstitution(
  entidad: Partial<FinancialInstitution>,
): Promise<FinancialInstitution> {
  return apiRequest<FinancialInstitution>(
    `/v1/workers/bank-statement/institutions/${encodeURIComponent(String(entidad.code))}`,
    { method: 'PUT', body: entidad },
  );
}

/**
 * Baja lógica. El motor no borra la fila porque las ejecuciones ya hechas citan
 * el código con el que se atribuyó el documento, y una traza que apunte al vacío
 * no se puede auditar.
 */
export function deactivateInstitution(code: string): Promise<FinancialInstitution> {
  return apiRequest<FinancialInstitution>(
    `/v1/workers/bank-statement/institutions/${encodeURIComponent(code)}`,
    { method: 'DELETE' },
  );
}

export function reactivateInstitution(code: string): Promise<FinancialInstitution> {
  return apiRequest<FinancialInstitution>(
    `/v1/workers/bank-statement/institutions/${encodeURIComponent(code)}/reactivate`,
    { method: 'POST', body: {} },
  );
}

/**
 * Siembra las entidades de la nómina ASFI que falten. Nunca pisa una existente,
 * y con `dryRun` responde qué haría sin escribir.
 */
export function seedInstitutions(dryRun: boolean): Promise<InstitutionSeedSummary> {
  return apiRequest<InstitutionSeedSummary>('/v1/workers/bank-statement/institutions/seed', {
    method: 'POST',
    body: { dryRun },
  });
}
