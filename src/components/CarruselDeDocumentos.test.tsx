import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CarruselDeDocumentos } from './CarruselDeDocumentos';

const documentos = [{ id: 'a', etiqueta: 'Anverso del carnet', objectUrl: 'blob:a' }];

describe('CarruselDeDocumentos · edición de la imagen', () => {
  it('ofrece girar, voltear y recortar', () => {
    render(<CarruselDeDocumentos documentos={documentos} etiquetaDelGrupo="Docs" />);
    for (const nombre of [
      /Girar izquierda/,
      /Girar derecha/,
      /Voltear horizontal/,
      /Voltear vertical/,
      /Recortar/,
    ]) {
      expect(screen.getByRole('button', { name: nombre })).toBeTruthy();
    }
  });

  it('entra y sale del modo recorte sin tocar la imagen', () => {
    render(<CarruselDeDocumentos documentos={documentos} etiquetaDelGrupo="Docs" />);
    fireEvent.click(screen.getByRole('button', { name: /Recortar/ }));
    expect(
      (screen.getByRole('button', { name: 'Aplicar recorte' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: /Recortar/ })).toBeTruthy();
    expect(screen.getByAltText('Anverso del carnet').getAttribute('src')).toBe('blob:a');
  });
});
