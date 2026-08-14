'use client';

import { useState } from 'react';
import { Check, Ban, Repeat } from 'lucide-react';
import { textoDePendiente } from './unresolved-contract';
import type { ResolutionType, UnresolvedItem } from './unresolved.api';

/**
 * Un caso de la bandeja, con todo lo que hace falta para decidirlo en un clic.
 *
 * Vive fuera de la consola por el tope de 299 líneas del repositorio, y el corte
 * cae donde toca: la consola orquesta —busca, reevalúa, aplica en bloque— y esto
 * presenta un caso.
 */
export function FilaPendiente({
  item,
  hojas,
  ocupado,
  onResolver,
}: {
  item: UnresolvedItem;
  hojas: readonly string[];
  ocupado: boolean;
  onResolver: (tipo: ResolutionType, categoryCode?: string) => void;
}) {
  const [elegida, setElegida] = useState(item.suggestedCategoryCode ?? '');
  const alternativas = item.alternatives ?? [];
  const texto = textoDePendiente(item);

  return (
    <li className="pendiente">
      <div className="pendiente-cabecera">
        {/*
         * Arriba, el texto que el clasificador LEE —sin `MCC 8299`,
         * `CONTABILIZADA` ni `TX-543462-F`—, porque es el que explica por qué no
         * decidió y el que hay que juzgar. Debajo, el original entero y sin
         * recortar: el matiz que falta puede estar justo en lo que se descartó,
         * y ese valor no se reescribe nunca.
         */}
        <div className="pendiente-textos">
          <p className="pendiente-valor">{texto}</p>
          {texto === item.rawValue ? null : (
            <p className="pendiente-crudo" title="Como llegó, sin tocar">
              {item.rawValue}
            </p>
          )}
        </div>
        <span
          className="pendiente-veces"
          title="Veces que este mismo valor apareció sin poder clasificarse"
        >
          <Repeat size={12} aria-hidden="true" /> {item.occurrenceCount}
        </span>
      </div>

      <div className="pendiente-datos">
        <span className="pendiente-origen">{item.source}</span>
        {item.suggestedCategoryCode !== null ? (
          <span className="pendiente-sugerida">
            recomienda <code>{item.suggestedCategoryCode}</code>
            {item.confidence !== null ? ` · ${(item.confidence * 100).toFixed(0)} %` : ''}
          </span>
        ) : (
          <span className="pendiente-sugerida is-vacia">
            sin recomendación: ninguna candidata fue suficiente
          </span>
        )}
      </div>

      {alternativas.length > 0 ? (
        <div className="pendiente-alternativas">
          <span className="categoria-import-rotulo">Alternativas</span>
          {alternativas.map((alternativa) => (
            <button
              key={alternativa.categoryCode}
              type="button"
              className="button"
              onClick={() => setElegida(alternativa.categoryCode)}
            >
              {alternativa.categoryCode} · {(alternativa.confidence * 100).toFixed(0)} %
            </button>
          ))}
        </div>
      ) : null}

      <div className="pendiente-acciones">
        <label className="field">
          <span className="sr-only">Categoría a asignar</span>
          <select value={elegida} onChange={(evento) => setElegida(evento.target.value)}>
            <option value="">Elige una categoría…</option>
            {hojas.map((codigo) => (
              <option key={codigo} value={codigo}>
                {codigo}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button button-primary"
          disabled={ocupado || elegida === ''}
          onClick={() =>
            onResolver(
              elegida === item.suggestedCategoryCode ? 'USE_SUGGESTED' : 'ASSIGN_EXISTING',
              elegida,
            )
          }
        >
          <Check size={15} aria-hidden="true" /> Asignar y aprender
        </button>
        <button
          type="button"
          className="button"
          disabled={ocupado}
          onClick={() => onResolver('DISCARD')}
          title="Cierra el caso sin enseñar nada al catálogo"
        >
          <Ban size={15} aria-hidden="true" /> Descartar
        </button>
      </div>
    </li>
  );
}
