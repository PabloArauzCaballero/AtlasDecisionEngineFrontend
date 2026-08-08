import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { PairsEditor } from './SimulatorPairsEditor';

/**
 * Lo que se ve y lo que se envía tienen que ser lo mismo.
 *
 * Las cajas eran no controladas (`defaultValue`), así que el navegador se
 * quedaba con lo escrito y React sólo lo fijaba al montar: cuando el payload
 * cambiaba desde fuera —subir un PDF, generar valores— la fila seguía enseñando
 * lo anterior mientras la petición ya decía otra cosa. El síntoma en producción
 * fue «ya están todas llenas» con el motor contestando
 * `Required variable cuota_solicitada_extracto is missing`.
 */

/** Anfitrión con el payload en estado, como la vista real. */
function Host({ initial }: { initial: Record<string, unknown> }) {
  const [parsed, setParsed] = useState(initial);
  return (
    <>
      <PairsEditor parsed={parsed} onCommit={setParsed} />
      <output data-testid="payload">{JSON.stringify(parsed)}</output>
      <button type="button" onClick={() => setParsed({ ...parsed, cuota: 999 })}>
        cambiar desde fuera
      </button>
    </>
  );
}

const payload = () => JSON.parse(screen.getByTestId('payload').textContent ?? '{}');

describe('editor atributo-valor', () => {
  it('confirma el valor al teclear, sin esperar a salir del campo', () => {
    render(<Host initial={{ cuota: '' }} />);

    fireEvent.change(screen.getByLabelText('Valor de cuota'), { target: { value: '150000' } });

    // Antes se confirmaba en `onBlur`: pulsar «Ejecutar simulación» sin salir
    // antes de la caja enviaba el valor anterior.
    expect(payload()).toEqual({ cuota: 150000 });
  });

  it('refleja un cambio que viene de fuera en vez de seguir enseñando lo tecleado', () => {
    render(<Host initial={{ cuota: 1 }} />);
    fireEvent.change(screen.getByLabelText('Valor de cuota'), { target: { value: '2' } });

    fireEvent.click(screen.getByRole('button', { name: 'cambiar desde fuera' }));

    // Ésta es la divergencia que producía el error del motor: la fila enseñaba
    // un valor que la petición no llevaba.
    expect(screen.getByLabelText('Valor de cuota')).toHaveValue('999');
    expect(payload()).toEqual({ cuota: 999 });
  });

  it('deduce el tipo del texto: número, booleano y texto', () => {
    render(<Host initial={{ a: '', b: '', c: '' }} />);

    fireEvent.change(screen.getByLabelText('Valor de a'), { target: { value: '42.5' } });
    fireEvent.change(screen.getByLabelText('Valor de b'), { target: { value: 'true' } });
    fireEvent.change(screen.getByLabelText('Valor de c'), { target: { value: 'REJECTED' } });

    expect(payload()).toEqual({ a: 42.5, b: true, c: 'REJECTED' });
  });

  it('renombra al salir del campo, no en cada tecla', () => {
    render(<Host initial={{ viejo: 7 }} />);
    const clave = screen.getByLabelText('Atributo');

    fireEvent.change(clave, { target: { value: 'nuevo' } });
    // A media escritura no se ha creado ninguna entrada suelta.
    expect(payload()).toEqual({ viejo: 7 });

    fireEvent.blur(clave, { target: { value: 'nuevo' } });

    expect(payload()).toEqual({ nuevo: 7 });
  });

  it('quitar un atributo lo saca de la petición', () => {
    render(<Host initial={{ a: 1, b: 2 }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Quitar a' }));

    expect(payload()).toEqual({ b: 2 });
  });
});
