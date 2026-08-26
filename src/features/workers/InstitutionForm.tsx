'use client';

import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { InstitutionLogoField } from './InstitutionLogoField';
import {
  INSTITUTION_KIND_LABELS,
  LICENSE_STATUS_LABELS,
  type FinancialInstitution,
  type InstitutionKind,
  type InstitutionLicenseStatus,
} from './institutions.api';

/**
 * Alta y edición de una entidad del padrón.
 *
 * Los marcadores se editan como **una expresión por línea**, no como JSON: quien
 * mantiene este padrón está copiando lo que ve impreso en la carátula de un
 * extracto, y obligarle a poner comillas y comas convierte una tarea de dominio
 * en una de sintaxis. La misma decisión que en el formulario de categorías.
 *
 * Las exclusiones tienen su propio bloque con la misma jerarquía visual que los
 * marcadores, y no escondidas en un desplegable, por lo que enseñó el caso real
 * que las motivó: la póliza de «BISA Seguros» se atribuía al Banco BISA porque
 * nadie había escrito la exclusión que las separa. Enterrarlas haría que nadie
 * las escribiera y el padrón volvería a confundir a un banco con su aseguradora.
 */

const LINEAS = (valor: string): string[] =>
  valor
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea !== '');

export interface InstitutionFormProps {
  /** `undefined` para un alta; la entidad para editarla. */
  inicial?: FinancialInstitution;
  guardando: boolean;
  onGuardar: (entidad: Partial<FinancialInstitution>) => void;
  onCancelar: () => void;
  /**
   * Carga de logotipo. Va aparte del guardado del formulario porque es otra
   * escritura contra otra ruta: mezclarla obligaría a mandar la imagen entera en
   * cada corrección de un marcador, y a que un error de imagen tirara el guardado
   * de la entidad.
   */
  onCargarLogo?: (input: { base64: string; contentType: string }) => void;
  onQuitarLogo?: () => void;
  logoOcupado?: boolean;
}

export function InstitutionForm({
  inicial,
  guardando,
  onGuardar,
  onCancelar,
  onCargarLogo,
  onQuitarLogo,
  logoOcupado = false,
}: InstitutionFormProps) {
  const [code, setCode] = useState(inicial?.code ?? '');
  const [name, setName] = useState(inicial?.name ?? '');
  const [kind, setKind] = useState<InstitutionKind>(inicial?.kind ?? 'MULTIPLE_BANK');
  const [licenseStatus, setLicenseStatus] = useState<InstitutionLicenseStatus>(
    inicial?.licenseStatus ?? 'LICENSED',
  );
  const [retailDeposits, setRetailDeposits] = useState(inicial?.retailDeposits ?? true);
  const [markers, setMarkers] = useState((inicial?.markers ?? []).join('\n'));
  const [exclusions, setExclusions] = useState((inicial?.exclusions ?? []).join('\n'));
  const [note, setNote] = useState(inicial?.note ?? '');
  const [website, setWebsite] = useState(inicial?.website ?? '');
  const esAlta = inicial === undefined;
  // El motor lo exige y lo vuelve a comprobar; aquí se dice antes de enviar para
  // que el aviso llegue junto al campo y no como un error de servidor.
  const faltaMotivo = licenseStatus !== 'LICENSED' && note.trim() === '';

  return (
    <form
      className="entidad-form"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (faltaMotivo) return;
        onGuardar({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          kind,
          licenseStatus,
          retailDeposits,
          markers: LINEAS(markers),
          exclusions: LINEAS(exclusions),
          note: note.trim() === '' ? null : note.trim(),
          website: website.trim() === '' ? null : website.trim(),
        });
      }}
    >
      <div className="entidad-form-grid">
        <label className="field">
          <span className="field-label">Sigla ASFI</span>
          <input
            value={code}
            onChange={(evento) => setCode(evento.target.value.toUpperCase())}
            /* Al editar es la CLAVE de la fila: cambiarla aquí crearía otra
               entidad y dejaría la vieja viva, que no es lo que nadie espera de
               un formulario de edición. */
            readOnly={!esAlta}
            required
            maxLength={16}
            pattern="[A-Z0-9_]+"
          />
          <small className="field-help">
            La que usa ASFI en su nómina: BNB, BME, CJN. Es la que queda en la traza de cada
            documento atribuido, así que se cruza con cualquier reporte del regulador.
          </small>
        </label>

        <label className="field">
          <span className="field-label">Razón social</span>
          <input value={name} onChange={(evento) => setName(evento.target.value)} required />
        </label>

        <label className="field">
          <span className="field-label">Tipo</span>
          <select
            value={kind}
            onChange={(evento) => setKind(evento.target.value as InstitutionKind)}
          >
            {Object.entries(INSTITUTION_KIND_LABELS).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Licencia</span>
          <select
            value={licenseStatus}
            onChange={(evento) => setLicenseStatus(evento.target.value as InstitutionLicenseStatus)}
          >
            {Object.entries(LICENSE_STATUS_LABELS).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
          <small className="field-help">
            Sin licencia vigente, sus extractos dejan de procesarse y pasan a la bandeja de
            revisión. No se rechazan: el documento es auténtico y su historial sigue siendo cierto.
          </small>
        </label>
      </div>

      <label className="field field-check">
        <input
          type="checkbox"
          checked={retailDeposits}
          onChange={(evento) => setRetailDeposits(evento.target.checked)}
        />
        <span className="field-label">Capta depósitos del público</span>
        <small className="field-help">
          Informativo: no rechaza documentos. Desmárcalo en la banca de segundo piso y en las IFD,
          que no abren cuentas de ahorro; sirve para explicar por qué un extracto suyo a nombre de
          una persona merece una mirada.
        </small>
      </label>

      <label className="field">
        <span className="field-label">Marcadores · una expresión por línea</span>
        <textarea
          value={markers}
          onChange={(evento) => setMarkers(evento.target.value)}
          rows={5}
          required
          spellCheck={false}
        />
        <small className="field-help">
          Lo que, impreso en la carátula, atribuye el documento a esta entidad: su razón social, su
          marca comercial, su dominio. Se evalúan sin distinguir mayúsculas y sólo sobre la
          carátula, así que una transferencia que mencione al banco en el cuerpo no cuenta.
        </small>
      </label>

      <label className="field">
        <span className="field-label">Exclusiones · una expresión por línea</span>
        <textarea
          value={exclusions}
          onChange={(evento) => setExclusions(evento.target.value)}
          rows={3}
          spellCheck={false}
        />
        <small className="field-help">
          Lo que ANULA la atribución aunque un marcador coincida. Es lo que separa a un banco de su
          aseguradora o su agencia de bolsa, que llevan la misma marca en la carátula.
        </small>
      </label>

      <label className="field">
        <span className="field-label">
          Motivo {licenseStatus === 'LICENSED' ? '(opcional)' : '· obligatorio'}
        </span>
        <textarea value={note} onChange={(evento) => setNote(evento.target.value)} rows={2} />
        {faltaMotivo ? (
          <span className="field-error">
            Una entidad sin licencia vigente necesita un motivo escrito: es lo único que quien
            revise el caso podrá leer.
          </span>
        ) : null}
      </label>

      <label className="field">
        <span className="field-label">Sitio oficial</span>
        <input
          value={website}
          onChange={(evento) => setWebsite(evento.target.value)}
          placeholder="https://www.banco.com.bo"
          maxLength={200}
        />
        <small className="field-help">
          De donde sale el logotipo, y lo que permite volver a descargarlo cuando la entidad cambia
          de marca.
        </small>
      </label>

      {/*
        El logotipo sólo al EDITAR. En un alta la entidad todavía no existe en el padrón, así que
        no hay contra qué cargar la imagen; ofrecerlo aquí sería un campo que falla al enviarse.
      */}
      {!esAlta && inicial ? (
        <InstitutionLogoField
          entidad={inicial}
          ocupado={logoOcupado}
          onCargar={onCargarLogo}
          onQuitar={onQuitarLogo}
        />
      ) : null}

      <div className="entidad-form-acciones">
        <button type="submit" className="button button-primary" disabled={guardando || faltaMotivo}>
          <Save size={15} aria-hidden="true" />{' '}
          {guardando ? 'Guardando…' : esAlta ? 'Crear entidad' : 'Guardar cambios'}
        </button>
        <button type="button" className="button" onClick={onCancelar} disabled={guardando}>
          <X size={15} aria-hidden="true" /> Cancelar
        </button>
      </div>
    </form>
  );
}
