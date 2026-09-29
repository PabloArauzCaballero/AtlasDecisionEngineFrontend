import type { ReactNode } from 'react';
import { NO_DISPONIBLE, type Tono } from './onboarding-dossier';

export interface DossierFact {
  label: string;
  /** `null`/`undefined` se pinta «No disponible», nunca como vacío ni como cero. */
  value: ReactNode;
  /** Marca el dato como señal de fraude (`riesgo`) o de mayor riesgo (`aviso`). */
  tono?: Tono | null;
  mono?: boolean;
}

const ETIQUETA_TONO: Record<Tono, string> = {
  riesgo: 'Señal de fraude',
  aviso: 'A revisar',
};

/**
 * Pares etiqueta/valor de un bloque del expediente.
 *
 * Reutiliza la rejilla de `DefinitionGrid` para verse como el resto del caso, pero admite un valor
 * con marcado (un enlace al mapa) y una marca de tono. La marca lleva TEXTO además del color: una
 * señal de fraude que sólo se distingue por ser roja no existe para quien no ve el rojo.
 */
export function DossierFacts({ items }: Readonly<{ items: readonly DossierFact[] }>) {
  return (
    <dl className="definition-grid dossier-facts">
      {items.map((item) => {
        const ausente = item.value === null || item.value === undefined || item.value === '';
        return (
          <div key={item.label} className={item.tono ? `dossier-fact--${item.tono}` : undefined}>
            <dt>{item.label}</dt>
            <dd className={item.mono ? 'mono' : undefined}>
              {ausente ? <span className="dossier-missing">{NO_DISPONIBLE}</span> : item.value}
              {item.tono && !ausente ? (
                <span className={`dossier-flag dossier-flag--${item.tono}`}>
                  {ETIQUETA_TONO[item.tono]}
                </span>
              ) : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Un bloque del expediente con su título; si el bloque no vino, lo dice. */
export function DossierBlock({
  title,
  present,
  children,
}: Readonly<{ title: string; present: boolean; children: ReactNode }>) {
  return (
    <section className="dossier-block" aria-label={title}>
      <h3 className="dossier-block__title">{title}</h3>
      {present ? children : <p className="dossier-missing">{NO_DISPONIBLE}</p>}
    </section>
  );
}
