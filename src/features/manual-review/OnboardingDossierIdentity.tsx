import type { UnknownRecord } from '../../utils/records';
import { DossierBlock, DossierFacts } from './DossierFacts';
import {
  BOT_SCORE_ALTO,
  bloque,
  fecha,
  lista,
  num,
  numero,
  porcentaje,
  segundos,
  siNo,
  texto,
} from './onboarding-dossier';

/** Un parecido que llega como fracción (0-1) se lee en porcentaje; si no, tal cual. */
function parecido(value: unknown): string | null {
  const n = num(value);
  if (n === null) return texto(value);
  return n <= 1 ? porcentaje(n) : numero(n, 2);
}

function verificado(valor: unknown, verificadoFlag: unknown): string | null {
  const base = texto(valor);
  if (!base) return null;
  const estado = siNo(verificadoFlag);
  return estado ? `${base} · ${estado === 'Sí' ? 'verificado' : 'sin verificar'}` : base;
}

export function DossierCliente({ alta }: Readonly<{ alta: UnknownRecord }>) {
  const cliente = bloque(alta, 'cliente');
  return (
    <DossierBlock title="Cliente" present={Boolean(cliente)}>
      <DossierFacts
        items={[
          { label: 'Código de cliente', value: texto(cliente?.customerCode), mono: true },
          { label: 'Identificador', value: texto(cliente?.customerId), mono: true },
          { label: 'Estado', value: texto(cliente?.estado) },
        ]}
      />
    </DossierBlock>
  );
}

export function DossierDeclarado({ alta }: Readonly<{ alta: UnknownRecord }>) {
  const d = bloque(alta, 'declarado');
  const dom = bloque(d ?? {}, 'domicilio');
  const empleo = bloque(d ?? {}, 'empleo');
  const extracto = bloque(d ?? {}, 'extracto');
  const direccion = dom
    ? [dom.calle, dom.zona, dom.ciudad, dom.departamento].map(texto).filter(Boolean).join(', ')
    : null;
  return (
    <DossierBlock title="Lo que declaró el cliente" present={Boolean(d)}>
      <DossierFacts
        items={[
          { label: 'Nombre completo', value: texto(d?.nombreCompleto) },
          { label: 'Nombres', value: texto(d?.nombres) },
          { label: 'Apellidos', value: texto(d?.apellidos) },
          { label: 'Carnet (últimos 4)', value: texto(d?.carnetUltimos4), mono: true },
          { label: 'Fecha de nacimiento', value: texto(d?.fechaNacimiento) },
          { label: 'Edad', value: numero(d?.edad) },
          {
            label: 'Menor de 23 años',
            value: siNo(d?.menorDe23) === 'Sí' ? 'Sí · mayor riesgo' : siNo(d?.menorDe23),
            tono: d?.menorDe23 === true ? 'aviso' : null,
          },
          { label: 'Teléfono', value: verificado(d?.telefono, d?.telefonoVerificado), mono: true },
          { label: 'Correo', value: verificado(d?.correo, d?.correoVerificado), mono: true },
          { label: 'Domicilio', value: direccion || null },
          { label: 'Tipo de empleo', value: texto(empleo?.tipo) },
          { label: 'Empleador', value: texto(empleo?.empleador) },
          { label: 'Rubro', value: texto(empleo?.rubro) },
          { label: 'Ingresos (banda)', value: texto(empleo?.bandaIngreso) },
          { label: 'Frecuencia de ingreso', value: texto(empleo?.frecuenciaIngreso) },
          { label: 'Años en el trabajo', value: numero(empleo?.aniosEnTrabajo, 1) },
          { label: 'Extracto bancario', value: texto(extracto?.estado) },
          { label: 'Meses del extracto', value: numero(extracto?.meses) },
        ]}
      />
    </DossierBlock>
  );
}

export function DossierCarnet({ alta }: Readonly<{ alta: UnknownRecord }>) {
  const c = bloque(alta, 'carnetVsDeclarado');
  const lectura = bloque(c ?? {}, 'lecturaCarnet');
  const lecturaTexto = lectura
    ? [
        [lectura.nombres, lectura.apellidos].map(texto).filter(Boolean).join(' '),
        lectura.numeroUltimos4 ? `carnet …${texto(lectura.numeroUltimos4)}` : '',
        texto(lectura.fechaNacimiento) ? `nacido el ${texto(lectura.fechaNacimiento)}` : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : null;
  return (
    <DossierBlock title="Carnet frente a lo declarado" present={Boolean(c)}>
      <DossierFacts
        items={[
          { label: 'Registro estatal (SEGIP)', value: texto(c?.segipEstado) },
          { label: 'Coincidencia con SEGIP', value: parecido(c?.segipCoincidencia) },
          { label: 'Lo que se leyó del carnet', value: lecturaTexto || null },
          {
            label: 'Coincide el nombre',
            value: siNo(c?.coincideNombre),
            tono: c?.coincideNombre === false ? 'riesgo' : null,
          },
          {
            label: 'Coincide la fecha de nacimiento',
            value: siNo(c?.coincideNacimiento),
            tono: c?.coincideNacimiento === false ? 'riesgo' : null,
          },
          { label: 'Parecido de la selfie con el carnet', value: parecido(c?.parecidoSelfie) },
          { label: 'Prueba de vida', value: texto(c?.pruebaDeVida) },
        ]}
      />
    </DossierBlock>
  );
}

export function DossierCronometro({ alta }: Readonly<{ alta: UnknownRecord }>) {
  const c = bloque(alta, 'cronometro');
  const pantallas = lista(c, 'segundosPorPantalla');
  const senales = Array.isArray(c?.senales) ? c.senales.map((s) => texto(s)).filter(Boolean) : null;
  const bot = num(c?.botScore);
  return (
    <DossierBlock title="Cronómetro y comportamiento del alta" present={Boolean(c)}>
      <DossierFacts
        items={[
          { label: 'Inicio del alta', value: fecha(c?.inicioAlta) },
          { label: 'Fin del alta', value: fecha(c?.finAlta) },
          { label: 'Duración total', value: segundos(c?.segundosTotal) },
          { label: 'Proporción de errores', value: porcentaje(c?.ratioErrores) },
          {
            label: 'Carnet pegado (no escrito)',
            value: siNo(c?.pegadoEnCarnet),
            tono: c?.pegadoEnCarnet === true ? 'riesgo' : null,
          },
          { label: 'Correcciones a la lectura del carnet', value: numero(c?.correccionesOcr) },
          { label: 'Altas abandonadas antes', value: numero(c?.abandonosPrevios) },
          {
            label: 'Indicio de automatización (0-1)',
            value: numero(c?.botScore, 2),
            tono: bot !== null && bot >= BOT_SCORE_ALTO ? 'riesgo' : null,
          },
          {
            label: 'Salió de la app durante la captura',
            value: siNo(c?.segundoPlanoEnCaptura),
            tono: c?.segundoPlanoEnCaptura === true ? 'aviso' : null,
          },
          {
            label: 'Señales anotadas',
            value: senales?.length ? senales.join(' · ') : senales ? 'Ninguna' : null,
          },
        ]}
      />
      {pantallas?.length ? (
        <table className="dossier-table">
          <caption>Tiempo por pantalla</caption>
          <thead>
            <tr>
              <th scope="col">Pantalla</th>
              <th scope="col">Tiempo</th>
            </tr>
          </thead>
          <tbody>
            {pantallas.map((fila, index) => (
              <tr key={`${texto(fila.pantalla) ?? 'pantalla'}-${index}`}>
                <td>{texto(fila.pantalla) ?? '—'}</td>
                <td>{segundos(fila.segundos) ?? 'No disponible'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </DossierBlock>
  );
}
