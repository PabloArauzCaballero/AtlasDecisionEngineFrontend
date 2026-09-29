import type { ReactNode } from 'react';
import type { UnknownRecord } from '../../utils/records';
import { DossierBlock, DossierFacts } from './DossierFacts';
import {
  bloque,
  decision,
  enlaceMapa,
  fecha,
  lista,
  metros,
  num,
  numero,
  porcentaje,
  siNo,
  texto,
} from './onboarding-dossier';

function MapLink({ punto, extra }: Readonly<{ punto: unknown; extra?: string | null }>): ReactNode {
  const mapa = enlaceMapa(punto);
  if (!mapa) return null;
  return (
    <>
      <span className="mono">{mapa.texto}</span>
      {extra ? ` · ${extra}` : null}{' '}
      <a href={mapa.url} target="_blank" rel="noreferrer">
        Ver en el mapa
      </a>
    </>
  );
}

export function DossierDispositivo({ alta }: Readonly<{ alta: UnknownRecord }>) {
  const d = bloque(alta, 'dispositivo');
  const otros = num(d?.otrosClientesConEsteDispositivo);
  const sistema = [d?.sistema, d?.version].map(texto).filter(Boolean).join(' ');
  return (
    <DossierBlock title="Teléfono" present={Boolean(d)}>
      <DossierFacts
        items={[
          {
            label: 'Marca y modelo',
            value: [d?.marca, d?.modelo].map(texto).filter(Boolean).join(' ') || null,
          },
          { label: 'Sistema', value: sistema || null },
          { label: 'Versión de la app', value: texto(d?.versionApp), mono: true },
          {
            label: 'Rooteado',
            value: siNo(d?.rooteado),
            tono: d?.rooteado === true ? 'riesgo' : null,
          },
          {
            label: 'Emulador',
            value: siNo(d?.emulador),
            tono: d?.emulador === true ? 'riesgo' : null,
          },
          { label: 'Huella del teléfono', value: texto(d?.huella), mono: true },
          { label: 'Visto por primera vez', value: fecha(d?.primeraVezVisto) },
          {
            label: 'Otros clientes con este teléfono',
            value: numero(otros),
            tono: otros !== null && otros > 0 ? 'aviso' : null,
          },
        ]}
      />
    </DossierBlock>
  );
}

function DecisionesTable({
  title,
  rows,
  clave,
  rotulo,
}: Readonly<{ title: string; rows: UnknownRecord[] | null; clave: string; rotulo: string }>) {
  return (
    <DossierBlock title={title} present={rows !== null}>
      {rows?.length ? (
        <table className="dossier-table">
          <thead>
            <tr>
              <th scope="col">{rotulo}</th>
              <th scope="col">Decisión</th>
              <th scope="col">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((fila, index) => (
              <tr key={`${texto(fila[clave]) ?? 'fila'}-${index}`}>
                <td>{texto(fila[clave]) ?? '—'}</td>
                <td>{decision(fila.decision) ?? 'No disponible'}</td>
                <td>{fecha(fila.fecha) ?? 'No disponible'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="dossier-missing">No se registró ninguna.</p>
      )}
    </DossierBlock>
  );
}

export function DossierPermisos({ alta }: Readonly<{ alta: UnknownRecord }>) {
  return (
    <>
      <DecisionesTable
        title="Permisos del teléfono"
        rows={lista(alta, 'permisos')}
        clave="permiso"
        rotulo="Permiso"
      />
      <DecisionesTable
        title="Consentimientos"
        rows={lista(alta, 'consentimientos')}
        clave="finalidad"
        rotulo="Finalidad"
      />
    </>
  );
}

export function DossierUbicacion({ alta }: Readonly<{ alta: UnknownRecord }>) {
  const u = bloque(alta, 'ubicacion');
  const domicilio = bloque(u ?? {}, 'puntoDomicilio');
  const p = bloque(u ?? {}, 'pings');
  const simulados = num(p?.simulados);
  const precision = metros(domicilio?.precision);
  // Sin coordenadas no hay enlace: `null` para que se lea «No disponible».
  const puntoDomicilio = enlaceMapa(domicilio) ? (
    <MapLink punto={domicilio} extra={precision ? `precisión ${precision}` : null} />
  ) : null;
  const ultimaPosicion = enlaceMapa(p?.ultimaPosicion) ? (
    <MapLink punto={p?.ultimaPosicion} />
  ) : null;
  return (
    <DossierBlock title="Ubicación" present={Boolean(u)}>
      <DossierFacts
        items={[
          { label: 'Punto del domicilio', value: puntoDomicilio },
          { label: 'Rastreo permanente', value: siNo(u?.rastreoSiempre) },
          { label: 'Ubicaciones recibidas', value: numero(p?.total) },
          { label: 'Con la app abierta', value: numero(p?.primerPlano) },
          { label: 'En segundo plano', value: numero(p?.segundoPlano) },
          {
            label: 'Ubicaciones simuladas',
            value: numero(simulados),
            tono: simulados !== null && simulados > 0 ? 'riesgo' : null,
          },
          { label: 'Primera ubicación', value: fecha(p?.primero) },
          { label: 'Última ubicación', value: fecha(p?.ultimo) },
          { label: 'Última posición', value: ultimaPosicion },
          {
            label: 'Distancia habitual al domicilio',
            value: metros(p?.distanciaMedianaAlDomicilioM),
          },
          { label: 'Distancia máxima al domicilio', value: metros(p?.distanciaMaximaAlDomicilioM) },
        ]}
      />
    </DossierBlock>
  );
}

export function DossierAgenda({ alta }: Readonly<{ alta: UnknownRecord }>) {
  const a = bloque(alta, 'agenda');
  const riesgo = num(a?.coincidenciasRiesgo);
  return (
    <DossierBlock title="Agenda de contactos" present={Boolean(a)}>
      <DossierFacts
        items={[
          { label: 'La compartió', value: siNo(a?.compartida) },
          { label: 'Alcance', value: texto(a?.alcance) },
          { label: 'Contactos', value: numero(a?.total) },
          { label: 'Contactos únicos', value: porcentaje(a?.unicosRatio) },
          { label: 'Números de Bolivia', value: porcentaje(a?.boliviaRatio) },
          { label: 'Referencias que están en la agenda', value: numero(a?.referenciasEnAgenda) },
          {
            label: 'Contactos marcados como riesgo',
            value: numero(riesgo),
            tono: riesgo !== null && riesgo > 0 ? 'aviso' : null,
          },
          { label: 'Contactos sincronizados', value: numero(a?.sincronizados) },
        ]}
      />
    </DossierBlock>
  );
}

const TIPO_EVIDENCIA: Record<string, string> = {
  identity_front: 'Anverso del carnet',
  identity_back: 'Reverso del carnet',
  selfie: 'Selfie de frente',
  selfie_left: 'Selfie perfil izquierdo',
  selfie_right: 'Selfie perfil derecho',
};

export function DossierEvidencias({ alta }: Readonly<{ alta: UnknownRecord }>) {
  const rows = lista(alta, 'evidencias');
  return (
    <DossierBlock title="Evidencias entregadas" present={rows !== null}>
      {rows?.length ? (
        <ul className="dossier-list">
          {rows.map((fila, index) => {
            const tipo = texto(fila.tipo);
            return (
              <li key={`${tipo ?? 'evidencia'}-${index}`}>
                {tipo ? (TIPO_EVIDENCIA[tipo] ?? tipo) : 'Sin tipo'} ·{' '}
                {fecha(fila.fecha) ?? 'fecha no disponible'}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="dossier-missing">No se registró ninguna.</p>
      )}
    </DossierBlock>
  );
}
