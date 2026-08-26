import { render, screen, within } from '@testing-library/react';
import { InstitutionsTable } from './InstitutionsTable';
import {
  INSTITUTION_KIND_LABELS,
  LICENSE_STATUS_LABELS,
  type FinancialInstitution,
  type InstitutionKind,
} from './institutions.api';

/**
 * El padrón de entidades, tal como la pantalla lo AFIRMA.
 *
 * No se mide el dibujo sino lo que el dibujo dice, porque aquí decir mal una
 * cosa cambia lo que alguien hace con el motor: **una entidad sin licencia y una
 * dada de baja no significan lo mismo**. La primera sigue reconociendo sus
 * extractos y los manda a revisión humana; la segunda deja de reconocerlos y los
 * suyos pasan a rechazarse como emisor no reconocido. Enseñarlas igual haría
 * creer que dar de baja una entidad es la forma de marcarla como intervenida, y
 * hace exactamente lo contrario.
 */

function entidad(overrides: Partial<FinancialInstitution> = {}): FinancialInstitution {
  return {
    code: 'BNB',
    name: 'Banco Nacional de Bolivia S.A.',
    kind: 'MULTIPLE_BANK',
    licenseStatus: 'LICENSED',
    retailDeposits: true,
    markers: ['BANCO\\s+NACIONAL\\s+DE\\s+BOLIVIA', '\\bBNB\\b'],
    exclusions: [],
    note: null,
    website: null,
    hasLogo: false,
    logoSource: null,
    logoSourceUrl: null,
    logoUpdatedAt: null,
    isActive: true,
    updatedAt: '2026-08-19T12:00:00.000Z',
    updatedBy: 'seed@atlas',
    ...overrides,
  };
}

const nada = () => undefined;

function pintar(entidades: readonly FinancialInstitution[]) {
  return render(
    <InstitutionsTable
      entidades={entidades}
      onEditar={nada}
      onDesactivar={nada}
      onReactivar={nada}
    />,
  );
}

describe('padrón de entidades financieras', () => {
  it('agrupa por tipo con su recuento, en el orden de la nómina de ASFI', () => {
    pintar([
      entidad(),
      entidad({ code: 'PEF', name: 'Banco PYME Ecofuturo S.A.', kind: 'PYME_BANK' }),
      entidad({ code: 'CJN', name: 'Cooperativa Jesús Nazareno R.L.', kind: 'COOPERATIVE' }),
      entidad({ code: 'CFA', name: 'Cooperativa Fátima R.L.', kind: 'COOPERATIVE' }),
    ]);

    /*
     * Agrupado y no como una lista plana de 68 filas: los bancos múltiples son
     * once y se revisan uno a uno, las cooperativas son cuarenta y una y se
     * revisan como bloque. Alfabético mezclaría el Banco Nacional con la
     * cooperativa de Aiquile y no habría forma de responder de un vistazo
     * «¿están todos los bancos?».
     */
    const titulos = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent ?? '');
    expect(titulos[0]).toContain(INSTITUTION_KIND_LABELS.MULTIPLE_BANK);
    expect(titulos[1]).toContain(INSTITUTION_KIND_LABELS.PYME_BANK);
    expect(titulos[2]).toContain(INSTITUTION_KIND_LABELS.COOPERATIVE);
    // El recuento va junto al rótulo: es lo que responde «¿están todas?» sin contar filas.
    expect(titulos[2]).toContain('2');
  });

  it('la entidad intervenida se distingue de la dada de baja', () => {
    pintar([
      entidad({
        code: 'BFS',
        name: 'Banco Fassil S.A.',
        licenseStatus: 'REVOKED',
        note: 'Intervenido por ASFI el 26 de abril de 2023.',
      }),
      entidad({ code: 'BIS', name: 'Banco Bisa S.A.', isActive: false }),
    ]);

    // La intervenida dice por qué lo está: es lo único que quien revise el caso
    // podrá leer, y sin eso «esta entidad no opera» es una afirmación sin respaldo.
    const fassil = screen.getByRole('row', { name: /Fassil/ });
    expect(within(fassil).getByText(LICENSE_STATUS_LABELS.REVOKED)).toBeInTheDocument();
    expect(within(fassil).getByText(/26 de abril de 2023/)).toBeInTheDocument();
    expect(within(fassil).queryByText(/Dada de baja/)).not.toBeInTheDocument();

    // La dada de baja conserva su licencia vigente y aun así deja de reconocer.
    const bisa = screen.getByRole('row', { name: /Bisa/ });
    expect(within(bisa).getByText(LICENSE_STATUS_LABELS.LICENSED)).toBeInTheDocument();
    expect(within(bisa).getByText(/no reconoce documentos/)).toBeInTheDocument();
  });

  /*
   * El padrón vacío no es una tabla vacía: es el estado en que el motor rechaza
   * TODOS los extractos a la vez, y no da ningún error que lo delate —cada
   * documento se rechaza por su cuenta como «emisor no reconocido»—. La única
   * forma de enterarse es que la pantalla lo diga sin que nadie lo pregunte.
   */
  it('un padrón vacío explica la consecuencia, no dice sólo «sin datos»', () => {
    pintar([]);

    expect(screen.getByText(/emisor no reconocido/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('cada tipo del contrato tiene rótulo: ninguno se pinta con la clave del enum', () => {
    /*
     * Quien administra el padrón conoce la nómina por su nombre oficial.
     * Enseñarle `PYME_BANK` le obliga a traducir mentalmente una lista que ya
     * sabe leer, y un tipo nuevo sin rótulo aparecería así sin avisar.
     */
    const tipos: InstitutionKind[] = [
      'MULTIPLE_BANK',
      'PYME_BANK',
      'STATE_BANK',
      'DEVELOPMENT_BANK',
      'HOUSING_ENTITY',
      'COOPERATIVE',
      'DEVELOPMENT_IFD',
    ];
    for (const tipo of tipos) {
      expect(INSTITUTION_KIND_LABELS[tipo]).toBeTruthy();
      expect(INSTITUTION_KIND_LABELS[tipo]).not.toMatch(/^[A-Z_]+$/);
    }
  });
});
