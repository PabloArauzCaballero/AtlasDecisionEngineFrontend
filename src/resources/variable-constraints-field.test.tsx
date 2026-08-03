import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExampleCheckHint } from './ExampleCheckHint';
import { VariableConstraintsField } from './VariableConstraintsField';

/**
 * Las restricciones se escribían como JSON libre, así que una clave inventada
 * («maximo», «max_value») se guardaba sin error y el motor la descartaba: la
 * variable quedaba sin el límite que su autor creía haber puesto.
 */
describe('restricciones de una variable', () => {
  const render_ = (dataType: string, value = '', onChange = vi.fn()) => {
    render(
      <VariableConstraintsField
        label="Restricciones"
        value={value}
        onChange={onChange}
        dataType={dataType}
      />,
    );
    return onChange;
  };

  it('ofrece sólo las restricciones que aplican al tipo', () => {
    render_('DECIMAL');
    expect(screen.getByText('Valor mínimo')).toBeInTheDocument();
    expect(screen.queryByText('Longitud mínima')).not.toBeInTheDocument();
  });

  it('cambia las opciones cuando cambia el tipo de dato', () => {
    render_('STRING');
    expect(screen.getByText('Longitud mínima')).toBeInTheDocument();
    expect(screen.queryByText('Valor mínimo')).not.toBeInTheDocument();
  });

  it('emite el JSON con el nombre canónico de la restricción', () => {
    const onChange = render_('DECIMAL');
    fireEvent.change(screen.getByLabelText('Valor mínimo'), { target: { value: '10' } });
    expect(onChange).toHaveBeenCalledWith(JSON.stringify({ min: 10 }));
  });

  it('deja volver al JSON crudo, avisando de que el nombre debe ser exacto', () => {
    render_('DECIMAL', '{"min":0}');
    fireEvent.click(screen.getByRole('button', { name: /Editar como JSON/ }));
    expect(screen.getByText(/debe escribirse\s+exactamente/)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('{"min":0}');
  });
});

describe('coherencia de los ejemplos', () => {
  it('avisa cuando el ejemplo válido incumple las restricciones', () => {
    render(
      <ExampleCheckHint value="5" dataType="DECIMAL" constraints='{"min":100}' expects="VALID" />,
    );
    expect(screen.getByText(/NO cumple el contrato/)).toBeInTheDocument();
  });

  it('confirma el ejemplo válido que sí cumple', () => {
    render(
      <ExampleCheckHint value="150" dataType="DECIMAL" constraints='{"min":100}' expects="VALID" />,
    );
    expect(screen.getByText(/Cumple el tipo y las restricciones/)).toBeInTheDocument();
  });

  it('avisa cuando el ejemplo inválido resulta aceptado', () => {
    render(
      <ExampleCheckHint
        value="150"
        dataType="DECIMAL"
        constraints='{"min":100}'
        expects="INVALID"
      />,
    );
    expect(screen.getByText(/no demuestra nada/)).toBeInTheDocument();
  });

  it('detecta el ejemplo que no encaja con el TIPO, no sólo con el rango', () => {
    render(<ExampleCheckHint value='"hola"' dataType="DECIMAL" constraints="" expects="VALID" />);
    expect(screen.getByText(/NO cumple el contrato/)).toBeInTheDocument();
  });
});
