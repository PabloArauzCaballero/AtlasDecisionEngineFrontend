import type { Option } from '../../contracts/option';

/** Cómo quedó resuelto un caso, en minúsculas para las frases de aviso. */
export const RESOLUTION_LABEL: Record<string, string> = {
  APPROVE: 'aprobado',
  REJECT: 'rechazado',
  ESCALATE: 'escalado',
};

/** Las tres salidas de una revisión manual, con lo que significa cada una. */
export const RESOLUTION_OPTIONS: Option[] = [
  {
    value: 'APPROVE',
    label: 'Aprobar',
    description: 'Resuelve el caso a favor de la solicitud.',
  },
  {
    value: 'REJECT',
    label: 'Rechazar',
    description: 'Resuelve el caso en contra de la solicitud.',
  },
  {
    value: 'ESCALATE',
    label: 'Escalar',
    description: 'Lo pasa a un nivel superior de revisión.',
  },
];
