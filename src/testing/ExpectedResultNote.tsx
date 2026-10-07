import { Alert } from '../components/Alert';

interface Props {
  /** Lo que devuelve `expectationGap`: el motivo, o `null` si no hay nada que avisar. */
  gap: string | null;
}

/** Qué poner en «Resultado esperado» cuando aún no afirma nada, y el atajo para no escribirlo. */
export function ExpectedResultNote({ gap }: Props) {
  if (!gap) return null;
  return (
    <Alert tone="warning">
      {gap} Escribe al menos el desenlace, por ejemplo <code>{'{"outcome": "APPROVED"}'}</code>. Si
      no quieres escribirlos a mano, «Generar pruebas automáticas» —en Suites de prueba y en
      Revisiones— crea los casos con su resultado esperado ya puesto.
    </Alert>
  );
}
