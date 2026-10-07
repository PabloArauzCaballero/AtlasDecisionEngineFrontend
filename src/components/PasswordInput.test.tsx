import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';
import { PasswordInput } from './PasswordInput';

describe('PasswordInput · el ojito', () => {
  it('empieza oculta y el botón la enseña y la vuelve a ocultar', () => {
    render(<PasswordInput aria-label="Clave nueva" defaultValue="secreta" />);
    const campo = screen.getByLabelText('Clave nueva');
    expect(campo.getAttribute('type')).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: 'Ver la clave' }));
    expect(campo.getAttribute('type')).toBe('text');

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar la clave' }));
    expect(campo.getAttribute('type')).toBe('password');
  });

  it('el ojito no envía el formulario ni roba el Tab', () => {
    render(<PasswordInput aria-label="Clave nueva" />);
    const ojito = screen.getByRole('button', { name: 'Ver la clave' });

    expect(ojito.getAttribute('type')).toBe('button');
    expect(ojito.getAttribute('tabindex')).toBe('-1');
  });

  it('dentro de un Field, la etiqueta nombra al campo y sólo al campo', () => {
    render(
      <Field label="Contraseña nueva" tooltip="La contraseña que usarás desde ahora.">
        <PasswordInput autoComplete="new-password" />
      </Field>,
    );

    const encontrados = screen.getAllByLabelText(/contraseña/i);
    expect(encontrados).toHaveLength(1);
    expect(encontrados[0]?.tagName).toBe('INPUT');
  });
});
