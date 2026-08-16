'use client';

import { ChevronsDownUp, ChevronsUpDown, FileJson, Plus, Sheet } from 'lucide-react';
import type { SemanticCategory } from './categories.api';
import { categoriasACsv } from './category-csv';
import { categoriasAJson } from './category-json';
import type { ControlDeRamas } from './category-tree.model';
import { exportFilename, saveBlob } from '../../utils/download';

/**
 * Las acciones que operan sobre el árbol ENTERO, juntas y encima de él.
 *
 * **Por qué la descarga vive aquí y no en el panel de inyección.** Estaba
 * dentro de «Inyección masiva», donde tenía sentido como plantilla para volver a
 * subir el archivo. Pero descargar el catálogo también es lo que hace quien
 * quiere revisarlo, archivarlo o mandárselo a otra persona, y ésa no va a abrir
 * un panel titulado «inyección» —que suena a escritura— para bajar algo. Un
 * botón que sólo encuentra quien ya sabe que está ahí, no está.
 *
 * **Se descarga el catálogo COMPLETO**, tal cual lo devuelve la API, no lo que
 * esté expandido en pantalla. El plegado es una comodidad para mirar; si además
 * decidiera qué entra en el archivo, dos personas se bajarían archivos distintos
 * del mismo catálogo y ninguna sabría que le faltan ramas.
 *
 * **Dos formatos, dos usos.** El JSON conserva la jerarquía dentro del archivo y
 * es el que se lee y se archiva; el CSV es filas y columnas, que es como se
 * edita un catálogo entre varias personas en una hoja de cálculo. Los dos se
 * pueden volver a subir por el panel de inyección.
 */

export interface CategoryTreeToolbarProps {
  categorias: readonly SemanticCategory[];
  control: ControlDeRamas;
  onNueva: () => void;
}

export function CategoryTreeToolbar({ categorias, control, onNueva }: CategoryTreeToolbarProps) {
  const vacio = categorias.length === 0;

  return (
    <div className="categoria-barra">
      <button type="button" className="button button-primary" onClick={onNueva}>
        <Plus size={15} aria-hidden="true" /> Nueva categoría
      </button>

      <div className="categoria-barra-grupo" role="group" aria-label="Plegado del árbol">
        <button type="button" className="button" disabled={vacio} onClick={control.expandirTodo}>
          <ChevronsUpDown size={15} aria-hidden="true" /> Expandir todo
        </button>
        <button type="button" className="button" disabled={vacio} onClick={control.colapsarTodo}>
          <ChevronsDownUp size={15} aria-hidden="true" /> Colapsar todo
        </button>
      </div>

      <div
        className="categoria-barra-grupo categoria-barra-descargas"
        role="group"
        aria-label="Descargar el árbol de categorías"
      >
        <button
          type="button"
          className="button"
          disabled={vacio}
          title="El catálogo completo, con la jerarquía dentro del archivo"
          onClick={() =>
            saveBlob(
              exportFilename('categorias', 'json'),
              new Blob([categoriasAJson(categorias)], { type: 'application/json' }),
            )
          }
        >
          <FileJson size={15} aria-hidden="true" /> Descargar JSON
        </button>
        <button
          type="button"
          className="button"
          disabled={vacio}
          title="El catálogo completo en filas y columnas, para editar en una hoja de cálculo"
          onClick={() =>
            saveBlob(
              exportFilename('categorias', 'csv'),
              // `categoriasACsv` ya antepone la marca de orden de bytes: sin
              // ella Excel en Windows lee el archivo como ANSI y toda tilde sale
              // rota. Por eso NO se pasa por `downloadCsv`, que la añadiría otra
              // vez y dejaría la primera columna con un nombre que no existe.
              new Blob([categoriasACsv(categorias)], { type: 'text/csv;charset=utf-8' }),
            )
          }
        >
          <Sheet size={15} aria-hidden="true" /> Descargar CSV
        </button>
      </div>
    </div>
  );
}
