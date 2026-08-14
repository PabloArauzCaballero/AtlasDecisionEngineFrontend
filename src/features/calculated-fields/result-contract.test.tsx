import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CalculatedFieldResultContract } from './CalculatedFieldResultContract';

/**
 * `returns` tal como lo guarda el motor para `payment_headroom_ratio` (campo 80):
 * rango 0–50, dos decimales y `RETURN_DEFAULT` fuera de rango.
 */
const version = {
  id: '8',
  versionNumber: 1,
  timeoutMs: 50,
  defaultValue: 0,
  returns: {
    dataType: 'DECIMAL',
    nullable: false,
    precision: 2,
    errorCode: 'HEADROOM_NOT_COMPUTABLE',
    constraints: { min: 0, max: 50 },
    outOfRange: 'RETURN_DEFAULT',
    missingData: 'FAIL',
    divisionByZero: 'FAIL',
    nullConditions: [],
  },
};

describe('contrato de salida de un campo calculado', () => {
  it('separa los tres desenlaces con su propia etiqueta', () => {
    render(<CalculatedFieldResultContract version={version} />);

    expect(screen.getByRole('heading', { name: 'Fuera de rango' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Si falta un dato de entrada' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'División entre cero' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dentro de rango' })).toBeInTheDocument();
  });

  it('dice qué implica estar dentro y fuera de rango, no sólo el nombre de la política', () => {
    render(<CalculatedFieldResultContract version={version} />);

    expect(screen.getByText(/El propio 0 SÍ se acepta/)).toBeInTheDocument();
    expect(screen.getByText(/El propio 50 SÍ se acepta/)).toBeInTheDocument();
    expect(screen.getByText(/entrega el valor por defecto/)).toBeInTheDocument();
    // Dos desenlaces declaran `FAIL`, y cada uno lo explica en su tarjeta.
    expect(screen.getAllByText(/falla con HEADROOM_NOT_COMPUTABLE/)).toHaveLength(2);
  });

  it('avisa cuando la política declarada no se puede cumplir', () => {
    render(
      <CalculatedFieldResultContract
        version={{ ...version, defaultValue: undefined, returns: { ...version.returns } }}
      />,
    );

    expect(screen.getByText(/NO declara ninguno/)).toBeInTheDocument();
  });

  it('un contrato sin rango lo dice en vez de dejar el bloque vacío', () => {
    render(
      <CalculatedFieldResultContract
        version={{ returns: { dataType: 'STRING', nullable: true, missingData: 'RETURN_NULL' } }}
      />,
    );

    expect(screen.getByText(/Sin rango declarado/)).toBeInTheDocument();
    expect(screen.getByText(/debe tratar el nulo/)).toBeInTheDocument();
  });
});
