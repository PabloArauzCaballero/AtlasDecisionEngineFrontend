import { apiDownload } from '../../api/file-download';
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
  website: string | null;
  /**
   * Si la entidad tiene logotipo cargado. Los BYTES no viajan en el listado: 68
   * imágenes en base64 dentro del JSON serían varios megabytes para pintar una
   * tabla, y así el navegador cachea cada una por su propia ruta.
   */
  hasLogo: boolean;
  /**
   * De dónde salió el logotipo.
   *
   * `GENERATED` significa que el motor compuso un monograma con la sigla ASFI
   * porque la entidad no publica ninguno utilizable — la mayoría de las
   * cooperativas—. **No es la marca de la entidad** y la pantalla lo dice: sin
   * esa distinción alguien acabaría usando el cuadrado de tres letras en un
   * documento que sale de la casa.
   */
  logoSource: 'DOWNLOADED' | 'GENERATED' | 'UPLOADED' | null;
  logoSourceUrl: string | null;
  logoUpdatedAt: string | null;
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

export interface InstitutionLogoSync {
  available: number;
  downloaded: number;
  generated: number;
  applied: string[];
  /**
   * De las escritas, las que tenían monograma y pasaron a llevar el logotipo
   * oficial. Va aparte de `applied` porque es el único número que responde «¿ha
   * cambiado algo en la tabla que estoy mirando?» cuando ya todas tenían imagen.
   */
  upgraded: string[];
  dryRun: boolean;
}

export const LOGO_SOURCE_LABELS: Record<
  NonNullable<FinancialInstitution['logoSource']>,
  { label: string; detail: string }
> = {
  DOWNLOADED: {
    label: 'Oficial',
    detail: 'Descargado del sitio de la entidad.',
  },
  GENERATED: {
    label: 'Monograma',
    detail: 'La entidad no publica logotipo utilizable; el motor compuso uno con su sigla ASFI.',
  },
  UPLOADED: {
    label: 'Cargado',
    detail: 'Lo subió una persona desde esta pantalla.',
  },
};

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
  return apiRequest<InstitutionSummary>(`${RUTA}/summary`, { signal });
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
/**
 * El logotipo, traído como blob por la puerta autenticada.
 *
 * Un `<img src="/v1/…">` no sirve: la etiqueta sólo tiene una dirección y no
 * puede mandar `Authorization`, que esta aplicación guarda en memoria y no en
 * una cookie. El motor responde 401 y lo que se pinta es el icono de imagen
 * rota. Es el mismo camino que ya usan las imágenes de la revisión manual.
 */
export async function fetchInstitutionLogo(code: string, signal?: AbortSignal): Promise<string> {
  const file = await apiDownload(`${RUTA}/${encodeURIComponent(code)}/logo`, `${code}.svg`, {
    signal,
  });
  return URL.createObjectURL(file.blob);
}

export function uploadInstitutionLogo(
  code: string,
  input: { base64: string; contentType: string; sourceUrl?: string },
): Promise<FinancialInstitution> {
  return apiRequest<FinancialInstitution>(`${RUTA}/${encodeURIComponent(code)}/logo`, {
    method: 'PUT',
    body: input,
  });
}

export function removeInstitutionLogo(code: string): Promise<FinancialInstitution> {
  return apiRequest<FinancialInstitution>(`${RUTA}/${encodeURIComponent(code)}/logo`, {
    method: 'DELETE',
  });
}

/**
 * Carga los logotipos que trae el motor en las entidades que no tengan ninguno.
 * Nunca pisa uno cargado a mano.
 */
export function syncInstitutionLogos(dryRun: boolean): Promise<InstitutionLogoSync> {
  return apiRequest<InstitutionLogoSync>(`${RUTA}/logos/sync`, {
    method: 'POST',
    body: { dryRun },
  });
}

export function seedInstitutions(dryRun: boolean): Promise<InstitutionSeedSummary> {
  return apiRequest<InstitutionSeedSummary>(`${RUTA}/seed`, { method: 'POST', body: { dryRun } });
}
