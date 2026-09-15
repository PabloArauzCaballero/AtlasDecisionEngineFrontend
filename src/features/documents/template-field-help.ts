import type { Option } from '../../contracts/option';
import type { TemplateFieldDescriptor } from './document-types';

/**
 * Qué significan los valores de los enums que publican las plantillas de
 * documento, y qué poner en sus campos más habituales.
 *
 * El contrato del motor trae `values: string[]` y nada más: la lista llegaba a
 * la pantalla como `APPROVED · REJECTED · REVIEW`, sin decir qué imprime cada
 * uno en el documento. **Este mapa es LOCAL a propósito**: cambiar el contrato
 * del motor para meterle glosas obligaría a versionar cada plantilla por un
 * texto de interfaz. Cuando una plantilla traiga su propia descripción, ésa
 * manda.
 */
const VALORES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  decision: {
    APPROVED: 'El documento se emite declarando la solicitud aprobada.',
    REJECTED: 'El documento se emite declarando la solicitud rechazada.',
    REVIEW: 'El documento declara que el caso quedó a la espera de una persona.',
  },
  outcome: {
    APPROVED: 'Resultado a favor, con los motivos que lo acompañan.',
    DECLINED: 'Resultado en contra, con los motivos que lo acompañan.',
    MANUAL_REVIEW: 'Sin resolver por el motor: el caso pasó a revisión humana.',
  },
  classification: {
    PUBLIC: 'Puede salir de la organización tal como está.',
    INTERNAL: 'Circula dentro de la organización, no fuera.',
    CONFIDENTIAL: 'Sólo para quien lo necesite: lleva datos sensibles dentro.',
  },
};

/** Qué poner en los campos de plantilla que se repiten en todos los documentos. */
const CAMPOS: Readonly<Record<string, string>> = {
  title: 'Encabezado que se imprime arriba del documento. Ej.: «Resultado del análisis».',
  subtitle: 'Contexto breve bajo el título; deja constancia de a qué caso pertenece el documento.',
  score: 'Puntaje que el modelo produjo, tal cual; se imprime junto al veredicto.',
  decision: 'Veredicto que el documento declara; es lo que lee quien lo reciba.',
  revisado: 'Márcalo si una persona ya revisó el contenido antes de emitirlo.',
  sections: 'Bloques del cuerpo, en JSON: cada uno con su título y su contenido.',
};

/**
 * La ayuda del campo. Manda lo que declare la plantilla; si no declara nada, el
 * mapa local; y si tampoco, se dice lo que de verdad se sabe —el tipo y si es
 * obligatorio—, que es honesto y sigue siendo más de lo que había.
 */
export function ayudaDeCampo(name: string, descriptor: TemplateFieldDescriptor): string {
  if (descriptor.description) return descriptor.description;
  const local = CAMPOS[name];
  if (local) return local;
  const obligatorio = descriptor.required ? 'obligatorio' : 'opcional';
  return `Campo ${obligatorio} de tipo ${descriptor.type} que exige el contrato de esta plantilla.`;
}

/** Las opciones de un enum de plantilla, con su descripción cuando se conoce. */
export function opcionesDeEnum(name: string, values: readonly string[]): Option[] {
  const mapa = VALORES[name] ?? {};
  // Sin entrada en el mapa la opción va SIN descripción: el valor sale del
  // contrato de un tercero y una glosa inventada sería peor que ninguna.
  return values.map((value) => ({ value, label: value, description: mapa[value] }));
}
