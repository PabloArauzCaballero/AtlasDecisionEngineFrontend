import { Alert } from '../../components/Alert';
import { Panel } from '../../components/Panel';
import type { UnknownRecord } from '../../utils/records';
import { DossierBlock, DossierFacts } from './DossierFacts';
import { bloque, fecha, lista, siNo, texto } from './onboarding-dossier';

/** Los nombres que AtlasBackend usa para el tipo de QR y los estados, dichos para una persona. */
const TIPO_DE_QR: Record<string, string> = {
  bank: 'QR bancario de cobro',
  business: 'QR del negocio',
};
const ESTADO: Record<string, string> = {
  draft: 'Borrador',
  under_review: 'En revisión',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  pending_review: 'Pendiente de revisión',
  active: 'Activo',
  inactive: 'Inactivo',
};
const estado = (value: unknown) => {
  const leido = texto(value);
  return leido ? (ESTADO[leido] ?? leido) : null;
};

/**
 * «Expediente del comercio»: quién es la empresa cuyo caso se está decidiendo.
 *
 * Un caso de comercio llegaba con el mismo panel que el de un cliente —cronómetro, teléfono,
 * agenda— y todo en «No disponible», porque AtlasBackend sólo adjuntaba el número del expediente.
 * Quien revisaba aprobaba o rechazaba sin saber ni cómo se llamaba la empresa. Aquí se enseña lo
 * que AtlasBackend adjunta ahora (`origen: KYB_COMERCIO`): la empresa, quién la representa, dónde
 * opera, sus QR de cobro y, arriba de todo, lo que todavía le falta.
 *
 * Los archivos no viajan en el anexo: se ven en «Documentos del solicitante», traídos del
 * expediente con el permiso y la bitácora de siempre.
 */
export function MerchantDossierPanel({ alta }: Readonly<{ alta: UnknownRecord }>) {
  const comercio = bloque(alta, 'comercio');
  const representantes = lista(alta, 'representantes');
  const sucursales = lista(alta, 'sucursales');
  const qr = lista(alta, 'qr');
  const pendientes = lista(alta, 'pendientes');
  const actualizado = fecha(alta.generadoEn);

  if (!comercio) {
    return (
      <Panel title="Expediente del comercio" meta="No disponible">
        <p className="muted-note">
          Este caso es del expediente de comercio {texto(alta.expedienteId) ?? 'sin número'}, pero
          todavía no trae sus datos. El sistema central los vuelve a enviar en cada sincronización;
          mientras tanto, sus archivos están en «Documentos del solicitante».
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Expediente del comercio"
      meta={actualizado ? `actualizado ${actualizado}` : 'lo que declaró el comercio'}
    >
      {pendientes?.length ? (
        <Alert tone="warning">
          <strong>Le falta para poder cobrar</strong>
          <ul className="dossier-signals">
            {pendientes.map((item) => (
              <li key={texto(item.requisito) ?? texto(item.detalle)}>{texto(item.detalle)}</li>
            ))}
          </ul>
        </Alert>
      ) : (
        <p className="muted-note">
          El expediente no declara requisitos pendientes. Compruébalo contra los documentos antes de
          decidir.
        </p>
      )}
      <div className="dossier-blocks">
        <DossierBlock title="Empresa" present>
          <DossierFacts
            items={[
              { label: 'Razón social', value: texto(comercio.razonSocial) },
              { label: 'Nombre comercial', value: texto(comercio.nombreComercial) },
              { label: 'NIT', value: texto(comercio.nit), mono: true },
              {
                label: 'Matrícula de comercio',
                value: texto(comercio.matriculaDeComercio),
                mono: true,
              },
              { label: 'Rubro', value: texto(comercio.rubro) },
              { label: 'Estado del expediente', value: estado(comercio.estado) },
              { label: 'Creado', value: fecha(comercio.creadoEn) },
              { label: 'Enviado a revisión', value: fecha(comercio.enviadoEn) },
            ]}
          />
        </DossierBlock>
        <DossierBlock title="Contacto" present>
          <DossierFacts
            items={[
              { label: 'Correo', value: texto(comercio.correo) },
              {
                label: 'Correo verificado',
                value: siNo(comercio.correoVerificado),
                tono: comercio.correoVerificado === false ? 'aviso' : null,
              },
              { label: 'Teléfono', value: texto(comercio.telefono) },
              { label: 'Teléfono verificado', value: siNo(comercio.telefonoVerificado) },
            ]}
          />
        </DossierBlock>
        <DossierBlock title="Representantes legales" present={Boolean(representantes?.length)}>
          {representantes?.map((item) => (
            <DossierFacts
              key={`${texto(item.nombre)}-${texto(item.numeroDeDocumento)}`}
              items={[
                { label: 'Nombre', value: texto(item.nombre) },
                {
                  label: 'Documento',
                  value: [texto(item.tipoDeDocumento), texto(item.numeroDeDocumento)]
                    .filter(Boolean)
                    .join(' '),
                  mono: true,
                },
                {
                  label: 'Poder adjunto',
                  value: siNo(item.poderAdjunto),
                  tono: item.poderAdjunto === false ? 'aviso' : null,
                },
                { label: 'Verificado', value: fecha(item.verificadoEn) },
              ]}
            />
          ))}
        </DossierBlock>
        <DossierBlock title="Sucursales" present={Boolean(sucursales?.length)}>
          {sucursales?.map((item) => (
            <DossierFacts
              key={texto(item.codigo) ?? texto(item.nombre)}
              items={[
                { label: 'Sucursal', value: texto(item.nombre) },
                {
                  label: 'Dirección',
                  value: [texto(item.direccion), texto(item.ciudad)].filter(Boolean).join(', '),
                },
                { label: 'Estado', value: estado(item.estado) },
              ]}
            />
          ))}
        </DossierBlock>
        <DossierBlock title="QR de cobro" present={Boolean(qr?.length)}>
          {qr?.map((item, posicion) => (
            <DossierFacts
              key={`${texto(item.tipo)}-${posicion}`}
              items={[
                { label: 'Tipo', value: TIPO_DE_QR[texto(item.tipo) ?? ''] ?? texto(item.tipo) },
                { label: 'Estado', value: estado(item.estado) },
                { label: 'Banco', value: texto(item.banco) },
                { label: 'Cuenta', value: texto(item.cuentaEnmascarada), mono: true },
              ]}
            />
          ))}
        </DossierBlock>
      </div>
    </Panel>
  );
}
