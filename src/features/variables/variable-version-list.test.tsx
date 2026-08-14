import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VariableVersionList } from './VariableVersionList';

/**
 * La forma de estos registros es la que devuelve `GET /v1/variables/:id` (Prisma con
 * `sources` y `validationRules` incluidos), no una inventada: `device_reputation`
 * guarda su enumeración en `constraintsJson` y su procedencia en `sources`.
 */
const deviceReputation = {
  id: '78',
  versionNumber: 1,
  dataType: 'STRING',
  nullable: false,
  expectedOrigin: 'REQUEST',
  effectiveFrom: '2026-08-02T23:37:45.254Z',
  effectiveTo: null,
  constraintsJson: { enum: ['TRUSTED', 'NEUTRAL', 'SUSPICIOUS', 'BLOCKLISTED'] },
  sources: [
    {
      id: '78',
      sourceSystemCode: 'REQUEST_PAYLOAD',
      sourcePath: '$.variables',
      sourceField: 'device_reputation',
      freshnessSlaSeconds: 60,
      precedence: 1,
      isAuthoritative: true,
    },
  ],
  validationRules: [],
};

describe('ficha del contrato de una variable', () => {
  it('enumera los valores permitidos en vez de contarlos', () => {
    render(<VariableVersionList versions={[deviceReputation]} />);

    for (const value of ['TRUSTED', 'NEUTRAL', 'SUSPICIOUS', 'BLOCKLISTED']) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    expect(screen.getByText(/VALUE_NOT_ALLOWED/)).toBeInTheDocument();
  });

  it('dice de dónde llega el valor y si esa fuente manda', () => {
    render(<VariableVersionList versions={[deviceReputation]} />);

    expect(screen.getByText('REQUEST_PAYLOAD')).toBeInTheDocument();
    expect(screen.getByText(/\$\.variables → device_reputation/)).toBeInTheDocument();
    expect(screen.getByText(/fuente autoritativa/)).toBeInTheDocument();
  });

  it('explica el borde de cada límite y la regla bloqueante que lo acompaña', () => {
    render(
      <VariableVersionList
        versions={[
          {
            id: '1',
            versionNumber: 2,
            dataType: 'NUMBER',
            nullable: true,
            effectiveTo: '2026-08-01T00:00:00.000Z',
            constraintsJson: { minimum: 0, exclusiveMaximum: 100 },
            validationRules: [
              {
                id: '9',
                ruleType: 'RANGE',
                ruleConfigJson: { minimum: 0, maximum: 1000000 },
                severity: 'BLOCKING',
                errorCode: 'INCOME_OUT_OF_RANGE',
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText(/El propio 0 SÍ se acepta/)).toBeInTheDocument();
    expect(screen.getByText(/El propio 100 NO se acepta/)).toBeInTheDocument();
    expect(screen.getByText(/la ejecución no sigue/)).toBeInTheDocument();
    expect(screen.getByText('reemplazada')).toBeInTheDocument();
    expect(screen.getByText(/Admite nulos/)).toBeInTheDocument();
  });

  it('un contrato sin restricciones lo dice, en vez de dejar la ficha vacía', () => {
    render(
      <VariableVersionList
        versions={[{ id: '2', versionNumber: 1, dataType: 'STRING', nullable: false }]}
      />,
    );

    expect(screen.getByText(/Sin restricciones declaradas/)).toBeInTheDocument();
  });
});
