'use client';

import { useState } from 'react';
import { Save, X } from 'lucide-react';
import type { SemanticCategory } from './categories.api';
import { Field } from '../../components/Field';
import { OptionSelect } from '../../components/OptionSelect';

/**
 * Alta y edición de una categoría.
 *
 * Los ejemplos y contraejemplos se editan como una línea por caso, no como JSON:
 * quien mantiene un catálogo está escribiendo glosas de banco, y obligarle a
 * poner comillas y comas convierte una tarea de dominio en una de sintaxis.
 *
 * **Los contraejemplos tienen su propio bloque, con la misma jerarquía visual
 * que los positivos.** No son un extra: el clasificador mide el parecido con
 * ellos y descarta la categoría si gana el contraejemplo, así que enterrarlos en
 * un desplegable haría que nadie los escribiera y el catálogo confundiría
 * «cobro de alquiler» con «pago de alquiler», que fue un defecto real.
 */

const LINEAS = (valor: string): string[] =>
  valor
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea !== '');

export interface CategoryFormProps {
  /** `undefined` para un alta; la categoría para editarla. */
  inicial?: SemanticCategory;
  /** Códigos disponibles como padre. */
  padres: readonly string[];
  guardando: boolean;
  onGuardar: (categoria: Partial<SemanticCategory>) => void;
  onCancelar: () => void;
}

export function CategoryForm({
  inicial,
  padres,
  guardando,
  onGuardar,
  onCancelar,
}: CategoryFormProps) {
  const [code, setCode] = useState(inicial?.code ?? '');
  const [name, setName] = useState(inicial?.name ?? '');
  const [description, setDescription] = useState(inicial?.description ?? '');
  const [parentCode, setParentCode] = useState(inicial?.parentCode ?? '');
  const [positivos, setPositivos] = useState((inicial?.positiveExamples ?? []).join('\n'));
  const [contra, setContra] = useState((inicial?.counterExamples ?? []).join('\n'));
  const [umbral, setUmbral] = useState(String(inicial?.acceptanceThreshold ?? 0.62));
  const esAlta = inicial === undefined;

  return (
    <form
      className="categoria-form"
      onSubmit={(evento) => {
        evento.preventDefault();
        onGuardar({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          description: description.trim(),
          parentCode: parentCode === '' ? null : parentCode,
          positiveExamples: LINEAS(positivos),
          counterExamples: LINEAS(contra),
          acceptanceThreshold: Number(umbral),
          isActive: inicial?.isActive ?? true,
        });
      }}
    >
      <div className="categoria-form-grid">
        <Field
          label="Código"
          tooltip="Código de la categoría en mayúsculas, con puntos entre niveles."
        >
          <input
            value={code}
            onChange={(evento) => setCode(evento.target.value)}
            /* Al editar es la CLAVE de la fila: cambiarlo aquí crearía otra
               categoría y dejaría la vieja viva, que no es lo que nadie espera
               de un formulario de edición. */
            readOnly={!esAlta}
            required
            placeholder="GASTOS.VIVIENDA.ALQUILER"
          />
          <small className="field-help">
            Mayúsculas y puntos entre niveles. El prefijo dice de quién cuelga.
          </small>
        </Field>

        <Field label="Nombre" tooltip="Nombre legible de la categoría.">
          <input
            value={name}
            onChange={(evento) => setName(evento.target.value)}
            required
            placeholder="Alquiler"
          />
        </Field>

        <Field
          label={'Categoría padre'}
          tooltip="Categoría de la que cuelga esta; sin padre queda como raíz del árbol."
        >
          <OptionSelect
            name="categoria-padre"
            value={parentCode}
            onChange={setParentCode}
            options={[
              {
                value: '',
                label: '(ninguna: es una raíz)',
                description: 'La categoría queda en la raíz del árbol.',
              },
              ...padres
                .filter((candidato) => candidato !== code)
                .map((candidato) => ({
                  value: candidato, // sin-ayuda: códigos del árbol de categorías, sin ficha
                  label: candidato,
                })),
            ]}
          />
        </Field>

        <Field
          label="Umbral de aceptación"
          tooltip="Confianza mínima que exige la clasificación para aceptarse, de 0 a 1."
        >
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={umbral}
            onChange={(evento) => setUmbral(evento.target.value)}
            required
          />
          <small className="field-help">
            Cuánta confianza exige antes de aceptarse. <strong>1</strong> la vuelve inalcanzable,
            que es lo que se pone en las ramas: agrupan, no clasifican.
          </small>
        </Field>
      </div>

      <Field label="Descripción" tooltip="Qué movimientos entran en esta categoría.">
        <textarea
          value={description}
          onChange={(evento) => setDescription(evento.target.value)}
          rows={2}
          required
          placeholder="Pago periódico por el uso de una vivienda que no es propiedad propia."
        />
      </Field>

      <div className="categoria-form-ejemplos">
        <Field
          label="Ejemplos (uno por línea)"
          tooltip="Glosas que sí son de esta categoría, como las imprime el banco."
        >
          <textarea
            value={positivos}
            onChange={(evento) => setPositivos(evento.target.value)}
            rows={6}
            placeholder={'PAGO ALQUILER\nPAGO ALQUILER DEPARTAMENTO'}
          />
          <small className="field-help">
            Escríbelos como los imprime el banco: cortos, en mayúsculas y abreviados.
          </small>
        </Field>

        <Field
          label="Contraejemplos (uno por línea)"
          tooltip="Glosas parecidas que NO son de esta categoría."
        >
          <textarea
            value={contra}
            onChange={(evento) => setContra(evento.target.value)}
            rows={6}
            placeholder={'PAGO CUOTA PRESTAMO HIPOTECARIO\nABONO ALQUILER INQUILINO'}
          />
          <small className="field-help">
            Pesan tanto como los ejemplos: son los que evitan que un cobro se lea como un pago.
          </small>
        </Field>
      </div>

      <div className="categoria-form-acciones">
        <button type="submit" className="button button-primary" disabled={guardando}>
          <Save size={15} aria-hidden="true" />
          {guardando ? 'Guardando…' : esAlta ? 'Crear categoría' : 'Guardar cambios'}
        </button>
        <button type="button" className="button" onClick={onCancelar} disabled={guardando}>
          <X size={15} aria-hidden="true" /> Cancelar
        </button>
      </div>
    </form>
  );
}
