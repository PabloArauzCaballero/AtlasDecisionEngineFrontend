'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';
import { SimulatorSampleBar } from '../simulator/SimulatorSampleBar';
import type { ImportField } from '../simulator/sample-import';
import { asRows, display, type UnknownRecord } from '../../utils/records';

interface Props {
  artifactCode: string;
  environmentCode: string;
  onLoad: (input: Record<string, unknown>) => void;
}

/** Las salidas no se piden al usuario: las produce el motor. */
function isOutput(usageType: unknown): boolean {
  return String(usageType ?? '').startsWith('OUTPUT');
}

/**
 * Valores de prueba para la ejecución en vivo.
 *
 * La pantalla arrancaba con `{}` y el algoritmo real declara decenas de entradas
 * obligatorias, así que lo único que se podía obtener al pulsar «Iniciar» era
 * `VARIABLE_MISSING_OR_INVALID`. Para ver una sola ejecución había que teclear
 * el contrato entero a mano: en la práctica, la pantalla no se podía usar.
 *
 * Reutiliza la barra del simulador —mismo endpoint, mismo generador— en vez de
 * repetirla: los valores salen del contrato REALMENTE desplegado en el ambiente
 * elegido, así que no pueden quedarse desfasados como sí lo haría una plantilla
 * escrita en el navegador. Deja elegir el tipo (válidos, en el límite,
 * inválidos) y cuántos generar.
 *
 * Este envoltorio existe sólo para resolver el contrato de entrada: la barra lo
 * recibe ya resuelto porque en el simulador ya lo tenía a mano.
 */
export function LiveExecutionSampleBar({ artifactCode, environmentCode, onLoad }: Props) {
  const contract = useQuery({
    // Misma clave que usa el simulador: si ya se consultó allí, React Query lo
    // reutiliza en vez de volver a pedirlo.
    queryKey: ['artifact-input-contract', artifactCode],
    enabled: artifactCode.trim() !== '',
    queryFn: () =>
      apiRequest<UnknownRecord>(
        `/v1/views/artifact-inputs?artifactCode=${encodeURIComponent(artifactCode.trim())}`,
      ),
  });

  const inputs: ImportField[] = asRows(contract.data?.variables)
    .filter((variable) => !isOutput(variable.usageType))
    .map((variable) => ({
      code: display(variable, 'variableCode'),
      dataType: display(variable, 'dataType'),
      required: Boolean(variable.isRequired),
    }));

  return (
    <SimulatorSampleBar
      artifactCode={artifactCode}
      environmentCode={environmentCode}
      contract={inputs}
      onLoad={onLoad}
    />
  );
}
