import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OnboardingDossierPanel } from './OnboardingDossierPanel';

/**
 * Un caso de comercio enseña la empresa, no el panel del alta de un cliente en «No disponible».
 * El anexo lo arma AtlasBackend (`buildKybDossier`, versión 1).
 */
const ANEXO = {
  version: 1,
  origen: 'KYB_COMERCIO',
  expedienteId: '10',
  generadoEn: '2026-10-07T22:00:00.000Z',
  comercio: {
    razonSocial: 'Tienda Ejemplo SRL',
    nombreComercial: 'La Tienda',
    nit: '1234567011',
    matriculaDeComercio: 'MAT-0099',
    rubro: 'retail',
    correo: 'contacto@tienda.example',
    correoVerificado: false,
    telefono: '+59170000000',
    telefonoVerificado: true,
    estado: 'under_review',
    creadoEn: '2026-09-30T10:00:00.000Z',
    enviadoEn: '2026-10-02T10:00:00.000Z',
  },
  representantes: [
    {
      nombre: 'Ana Pérez',
      tipoDeDocumento: 'CI',
      numeroDeDocumento: '7654321',
      poderAdjunto: false,
    },
  ],
  sucursales: [
    {
      codigo: 'S1',
      nombre: 'Central',
      direccion: 'Av. Uno 1',
      ciudad: 'Santa Cruz',
      estado: 'active',
    },
  ],
  qr: [{ tipo: 'bank', estado: 'pending_review', banco: 'BNB', cuentaEnmascarada: '****4321' }],
  pendientes: [
    {
      requisito: 'power_of_attorney',
      detalle: 'Falta el poder que acredita al representante legal.',
    },
  ],
};

describe('expediente del comercio en el caso', () => {
  it('enseña la empresa, quién la representa, dónde opera y lo que le falta', () => {
    render(<OnboardingDossierPanel evidence={{ alta: ANEXO }} />);

    expect(screen.getByText('Expediente del comercio')).toBeTruthy();
    expect(screen.getByText('Tienda Ejemplo SRL')).toBeTruthy();
    expect(screen.getByText('1234567011')).toBeTruthy();
    expect(screen.getByText('Ana Pérez')).toBeTruthy();
    expect(screen.getByText('CI 7654321')).toBeTruthy();
    expect(screen.getByText('Av. Uno 1, Santa Cruz')).toBeTruthy();
    expect(screen.getByText('QR bancario de cobro')).toBeTruthy();
    expect(screen.getByText('****4321')).toBeTruthy();
    expect(screen.getByText('En revisión')).toBeTruthy();
    // Lo pendiente va arriba y con texto, no sólo como un color.
    expect(screen.getByText('Le falta para poder cobrar')).toBeTruthy();
    expect(screen.getByText(/Falta el poder que acredita/)).toBeTruthy();
    // No es el panel de un cliente.
    expect(screen.queryByText('Expediente del alta')).toBeNull();
  });

  it('un caso anterior, que sólo trae el número, lo dice en vez de pintar un cliente vacío', () => {
    render(
      <OnboardingDossierPanel
        evidence={{ alta: { origen: 'KYB_COMERCIO', expedienteId: '10' } }}
      />,
    );

    expect(screen.getByText(/todavía no trae sus datos/)).toBeTruthy();
    expect(screen.queryByText('Expediente del alta')).toBeNull();
  });

  it('sin representantes ni sucursales declara cada bloque como no disponible', () => {
    render(
      <OnboardingDossierPanel
        evidence={{
          alta: { ...ANEXO, representantes: [], sucursales: [], qr: [], pendientes: [] },
        }}
      />,
    );

    expect(screen.getAllByText('No disponible').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText(/no declara requisitos pendientes/)).toBeTruthy();
  });
});
