'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api/http-client';
import { asRows, display, type UnknownRecord } from '../../utils/records';

/**
 * El contrato del artefacto: qué variables declara y cómo se llaman de verdad.
 *
 * Vive aparte porque lo necesitan las DOS columnas del simulador —el formulario
 * de entrada y el panel de resultado—, y con la consulta escrita en cada una la
 * clave se escribía dos veces: bastaba que una recortara el código y la otra no
 * para que React Query las tratara como consultas distintas y pidiera el mismo
 * contrato dos veces. Compartiendo hook comparten clave, y con ella la caché.
 */
export function useArtifactContract(artifactCode: string) {
  const code = artifactCode.trim();
  return useQuery({
    queryKey: ['artifact-input-contract', code],
    enabled: code !== '',
    queryFn: () =>
      apiRequest<UnknownRecord>(
        `/v1/views/artifact-inputs?artifactCode=${encodeURIComponent(code)}`,
      ),
  });
}

/**
 * Nombre legible de cada variable, por su código.
 *
 * El motor publica `canonicalName` en el contrato —«Ingreso verificado»,
 * «Decisión sobre el extracto»— y el resultado de una simulación viene indexado
 * por el CÓDIGO (`ingreso_verificado`, `decision_extracto`). Sin este puente, la
 * pantalla que enseña la decisión obliga a traducir identificadores en
 * minúscula y guiones bajos, cosa que el formulario de al lado ya dejó de pedir.
 *
 * Un código sin nombre publicado no se inventa: se queda como está, que es
 * preferible a rotularlo con una versión bonita que el contrato no dice.
 */
export function variableNames(contract: UnknownRecord | undefined): Record<string, string> {
  const names: Record<string, string> = {};
  for (const variable of asRows(contract?.variables)) {
    const code = display(variable, 'variableCode', 'code');
    const name = display(variable, 'canonicalName');
    if (code !== '—' && name !== '—') names[code] = name;
  }
  return names;
}
