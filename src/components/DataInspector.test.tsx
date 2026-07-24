import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataInspector } from './DataInspector';

const DATA = {
  variableCode: 'kyc_status',
  isSensitive: true,
  latestVersion: 3,
  meta: { a: 1 },
  updatedAt: '2026-07-13T05:10:18.840Z',
  empty: null,
};

describe('DataInspector', () => {
  it('muestra la tabla atributo-valor por defecto, con valores formateados', () => {
    render(<DataInspector data={DATA} idPrefix="t" />);
    expect(screen.getByText('variableCode')).toBeInTheDocument();
    expect(screen.getByText('kyc_status')).toBeInTheDocument();
    // booleano en español
    expect(screen.getByText('Sí')).toBeInTheDocument();
    // objeto anidado como JSON compacto
    expect(screen.getByText('{"a":1}')).toBeInTheDocument();
    // nulo como guion
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('permite cambiar a la vista JSON de la misma respuesta', () => {
    render(<DataInspector data={DATA} idPrefix="t" />);
    fireEvent.click(screen.getByRole('tab', { name: /JSON/ }));
    expect(screen.getByText(/"variableCode": "kyc_status"/)).toBeInTheDocument();
  });
});
