import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FieldLabel } from './FieldLabel';
import { OptionSelect } from './OptionSelect';
import { useFieldHelp } from '../hooks/useFieldHelp';
import type { Option } from '../contracts/option';

const ESTADOS: Option[] = [
  { value: 'DRAFT', label: 'Borrador', description: 'Se puede editar y nadie lo ejecuta todavía.' },
  {
    value: 'ACTIVE',
    label: 'Activa',
    description: 'Atiende decisiones reales en producción ahora mismo.',
  },
  { value: 'RETIRED', label: 'Retirada', description: 'Ya no decide; se conserva para auditar.' },
];

function Campo(props: { onChange?: (value: string) => void; required?: boolean }) {
  const ayuda = useFieldHelp('Qué puede hacerse con la versión en cada momento.');
  return (
    <form data-testid="formulario">
      <FieldLabel
        htmlFor="estado"
        label="Estado"
        required={props.required}
        tooltip="Qué puede hacerse con la versión en cada momento."
        describedById={ayuda.describedById}
        controlFocused={ayuda.focused}
      />
      <OptionSelect
        id="estado"
        name="status"
        options={ESTADOS}
        required={props.required}
        describedById={ayuda.describedById}
        onChange={props.onChange}
        onFocus={ayuda.onFocus}
        onBlur={ayuda.onBlur}
      />
    </form>
  );
}

const boton = () => screen.getByTestId('select-status');

describe('OptionSelect', () => {
  it('enseña qué significa cada opción en su fila, que es lo que el <option> nativo no podía', () => {
    render(<Campo />);
    fireEvent.click(boton());

    const filas = screen.getAllByRole('option');
    expect(filas).toHaveLength(3);
    expect(filas[0]).toHaveTextContent('Borrador');
    expect(filas[0]).toHaveTextContent('Se puede editar y nadie lo ejecuta todavía.');
    // Descripción completa disponible aunque el recorte a dos líneas la corte.
    expect(filas[1]).toHaveAttribute(
      'title',
      'Atiende decisiones reales en producción ahora mismo.',
    );
  });

  it('manda el valor al formulario y repite la descripción bajo el campo', () => {
    const onChange = vi.fn();
    render(<Campo onChange={onChange} />);

    fireEvent.click(boton());
    fireEvent.click(screen.getByTestId('select-status-option-ACTIVE'));

    expect(onChange).toHaveBeenCalledWith('ACTIVE');
    const formulario = screen.getByTestId('formulario') as HTMLFormElement;
    expect(new FormData(formulario).get('status')).toBe('ACTIVE');
    expect(screen.getByTestId('select-status-descripcion')).toHaveTextContent(
      'Atiende decisiones reales en producción ahora mismo.',
    );
  });

  it('se maneja entero con el teclado: flechas, Enter, Inicio y Escape', () => {
    render(<Campo />);

    fireEvent.keyDown(boton(), { key: 'ArrowDown' });
    expect(boton()).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(boton(), { key: 'ArrowDown' });
    fireEvent.keyDown(boton(), { key: 'Enter' });
    expect(boton()).toHaveAttribute('data-value', 'ACTIVE');

    fireEvent.keyDown(boton(), { key: 'ArrowDown' });
    fireEvent.keyDown(boton(), { key: 'Home' });
    fireEvent.keyDown(boton(), { key: 'Enter' });
    expect(boton()).toHaveAttribute('data-value', 'DRAFT');

    fireEvent.keyDown(boton(), { key: 'ArrowDown' });
    fireEvent.keyDown(boton(), { key: 'Escape' });
    expect(boton()).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(boton());
  });

  it('escribir salta a la opción que empieza por esas letras', () => {
    render(<Campo />);
    fireEvent.keyDown(boton(), { key: 'ArrowDown' });
    fireEvent.keyDown(boton(), { key: 'r' });
    fireEvent.keyDown(boton(), { key: 'Enter' });

    expect(boton()).toHaveAttribute('data-value', 'RETIRED');
  });

  it('con más de ocho opciones aparece el buscador, y filtra sin tildes', () => {
    const muchas: Option[] = Array.from({ length: 9 }, (_, index) => ({
      value: `v${index}`,
      label: index === 0 ? 'Solicitud de crédito' : `Opción ${index}`,
      description: 'Qué significa esta opción del catálogo.',
    }));
    render(<OptionSelect name="tipo" options={muchas} ariaLabel="Tipo" />);

    fireEvent.click(screen.getByTestId('select-tipo'));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar una opción' }), {
      target: { value: 'credito' },
    });

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option')).toHaveTextContent('Solicitud de crédito');
  });

  it('sin opciones lo dice y no deja abrir una lista vacía', () => {
    render(<OptionSelect name="vacio" options={[]} ariaLabel="Artefacto" />);

    const control = screen.getByTestId('select-vacio');
    expect(control).toBeDisabled();
    expect(control).toHaveTextContent('— No hay datos registrados —');
  });
});

describe('FieldLabel + ayuda del campo', () => {
  it('el nombre accesible del control es la etiqueta, sin el texto del icono de ayuda', () => {
    render(<Campo />);
    // Si el ⓘ llevara `aria-label`, este `getByLabelText` casaría con dos nodos.
    expect(screen.getByLabelText('Estado')).toBe(boton());
    expect(screen.getByTitle('Ayuda: Estado')).toBeInTheDocument();
  });

  it('el texto de ayuda lo lee el lector aunque la burbuja esté cerrada', () => {
    render(<Campo />);
    const descrito = boton().getAttribute('aria-describedby');
    expect(descrito).toBeTruthy();
    expect(document.getElementById(descrito as string)).toHaveTextContent(
      'Qué puede hacerse con la versión en cada momento.',
    );
  });

  it('la burbuja abre al enfocar el control con el teclado y cierra con Escape', () => {
    render(<Campo />);
    const burbuja = screen.getAllByRole('tooltip')[0];
    expect(burbuja).not.toHaveAttribute('data-open');

    fireEvent.focus(boton());
    expect(screen.getAllByRole('tooltip')[0]).toHaveAttribute('data-open', 'true');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getAllByRole('tooltip')[0]).not.toHaveAttribute('data-open');
  });
});
