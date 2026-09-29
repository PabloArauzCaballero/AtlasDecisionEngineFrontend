import { render, screen, within } from '@testing-library/react';
import { OnboardingDossierPanel } from './OnboardingDossierPanel';

/**
 * El expediente del alta es lo que el revisor mira para decidir sobre una identidad. Se fija que
 * enseña cada bloque, que marca las señales de fraude CON TEXTO, y que lo que no vino se dice
 * «No disponible» en vez de pintarse como cero o como vacío.
 */

const ALTA_COMPLETA = {
  version: 1,
  generadoEn: '2026-09-28T12:00:00.000Z',
  cliente: { customerId: 'c-1', customerCode: 'CLI-0042', estado: 'IN_REVIEW' },
  declarado: {
    nombreCompleto: 'Ana Pérez Rojas',
    nombres: 'Ana',
    apellidos: 'Pérez Rojas',
    carnetUltimos4: '4321',
    fechaNacimiento: '2004-05-01',
    edad: 22,
    menorDe23: true,
    telefono: '+591 7•••••21',
    telefonoVerificado: true,
    correo: 'a•••@correo.bo',
    correoVerificado: false,
    domicilio: { departamento: 'La Paz', ciudad: 'El Alto', zona: 'Villa Adela', calle: 'Calle 5' },
    empleo: {
      tipo: 'DEPENDIENTE',
      empleador: 'Comercial Andina',
      rubro: 'Comercio',
      bandaIngreso: '3000-5000',
      frecuenciaIngreso: 'MENSUAL',
      aniosEnTrabajo: 2,
    },
    extracto: { estado: 'VERIFICADO', meses: 3 },
  },
  carnetVsDeclarado: {
    segipEstado: 'CONFIRMADO',
    segipCoincidencia: 0.97,
    lecturaCarnet: {
      nombres: 'ANA',
      apellidos: 'PEREZ ROJAS',
      numeroUltimos4: '4321',
      fechaNacimiento: '2004-05-01',
    },
    coincideNombre: false,
    coincideNacimiento: true,
    parecidoSelfie: 0.91,
    pruebaDeVida: 'SUPERADA',
  },
  cronometro: {
    inicioAlta: '2026-09-28T11:00:00.000Z',
    finAlta: '2026-09-28T11:07:00.000Z',
    segundosTotal: 420,
    segundosPorPantalla: [
      { pantalla: 'datos-personales', segundos: 95 },
      { pantalla: 'carnet', segundos: 140 },
    ],
    ratioErrores: 0.1,
    pegadoEnCarnet: true,
    correccionesOcr: 2,
    abandonosPrevios: 0,
    botScore: 0.82,
    segundoPlanoEnCaptura: false,
    senales: ['RITMO_CONSTANTE'],
  },
  dispositivo: {
    marca: 'Samsung',
    modelo: 'A54',
    sistema: 'Android',
    version: '14',
    versionApp: '1.0.7',
    rooteado: false,
    emulador: true,
    huella: 'ab12…ef',
    primeraVezVisto: '2026-09-20T10:00:00.000Z',
    otrosClientesConEsteDispositivo: 0,
  },
  permisos: [{ permiso: 'ubicacion', decision: 'granted', fecha: '2026-09-28T11:01:00.000Z' }],
  consentimientos: [
    { finalidad: 'agenda', decision: 'accepted', fecha: '2026-09-28T11:02:00.000Z' },
  ],
  ubicacion: {
    puntoDomicilio: { lat: -16.5, lng: -68.15, precision: 12 },
    pings: {
      total: 30,
      primerPlano: 20,
      segundoPlano: 10,
      simulados: 3,
      primero: '2026-09-28T11:00:00.000Z',
      ultimo: '2026-09-28T13:00:00.000Z',
      ultimaPosicion: { lat: -16.51, lng: -68.16 },
      distanciaMedianaAlDomicilioM: 350,
      distanciaMaximaAlDomicilioM: 2500,
    },
    rastreoSiempre: true,
  },
  agenda: {
    compartida: true,
    alcance: 'COMPLETA',
    total: 180,
    unicosRatio: 0.95,
    boliviaRatio: 0.9,
    referenciasEnAgenda: 2,
    coincidenciasRiesgo: 1,
    sincronizados: 180,
  },
  evidencias: [
    { tipo: 'identity_front', fecha: '2026-09-28T11:03:00.000Z' },
    { tipo: 'selfie_left', fecha: '2026-09-28T11:05:00.000Z' },
  ],
};

function bloque(nombre: string) {
  return within(screen.getByRole('region', { name: nombre }));
}

function valorDe(scope: ReturnType<typeof within>, rotulo: string) {
  const dt = scope.getByText(rotulo, { selector: 'dt' });
  return dt.nextElementSibling as HTMLElement;
}

describe('OnboardingDossierPanel', () => {
  it('con el expediente completo pinta cada bloque y resume las señales de fraude', () => {
    render(<OnboardingDossierPanel evidence={{ motivo: 'X', alta: ALTA_COMPLETA }} />);

    const resumen = screen.getByText('Señales de fraude').closest('.alert') as HTMLElement;
    for (const texto of [
      'El alta se hizo en un emulador',
      '3 ubicaciones simuladas',
      'El número de carnet se pegó, no se escribió',
      'Comportamiento de automatización alto',
      'El nombre declarado no coincide con el carnet',
    ]) {
      expect(within(resumen).getByText(texto)).toBeInTheDocument();
    }
    const avisos = screen
      .getByText('A revisar', { selector: 'strong' })
      .closest('.alert') as HTMLElement;
    expect(within(avisos).getByText('Menor de 23 años: mayor riesgo')).toBeInTheDocument();

    // Los datos, legibles y en su bloque.
    expect(valorDe(bloque('Lo que declaró el cliente'), 'Menor de 23 años').textContent).toContain(
      'mayor riesgo',
    );
    expect(valorDe(bloque('Lo que declaró el cliente'), 'Domicilio').textContent).toBe(
      'Calle 5, Villa Adela, El Alto, La Paz',
    );
    const emulador = valorDe(bloque('Teléfono'), 'Emulador');
    expect(emulador.textContent).toContain('Sí');
    expect(emulador.textContent).toContain('Señal de fraude');
    expect(valorDe(bloque('Teléfono'), 'Rooteado').textContent).toBe('No');
    expect(
      valorDe(bloque('Cronómetro y comportamiento del alta'), 'Duración total').textContent,
    ).toBe('420 s (7 min 0 s)');
    expect(bloque('Cronómetro y comportamiento del alta').getByText('carnet')).toBeInTheDocument();
    expect(
      valorDe(bloque('Carnet frente a lo declarado'), 'Coincide el nombre').textContent,
    ).toContain('Señal de fraude');

    // Las coordenadas llevan su enlace al mapa.
    const mapas = bloque('Ubicación').getAllByRole('link', { name: 'Ver en el mapa' });
    expect(mapas.map((a) => a.getAttribute('href'))).toEqual([
      'https://www.google.com/maps/search/?api=1&query=-16.5,-68.15',
      'https://www.google.com/maps/search/?api=1&query=-16.51,-68.16',
    ]);
    expect(bloque('Permisos del teléfono').getByText('Concedido')).toBeInTheDocument();
    expect(
      bloque('Evidencias entregadas').getByText(/Selfie perfil izquierdo/),
    ).toBeInTheDocument();
  });

  it('sin expediente lo dice, en vez de pintar bloques vacíos', () => {
    render(<OnboardingDossierPanel evidence={{ motivo: 'REQUIERE_REVISION' }} />);
    expect(screen.getByText(/no trae el expediente del alta/i)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Teléfono' })).not.toBeInTheDocument();
  });

  it('un expediente parcial dice «No disponible» en lo que falta, nunca un cero', () => {
    render(
      <OnboardingDossierPanel
        evidence={{
          alta: {
            version: 1,
            cliente: { customerCode: 'CLI-1' },
            dispositivo: null,
            ubicacion: { puntoDomicilio: null, pings: { total: 0, simulados: null } },
            cronometro: { segundosTotal: null, botScore: 0.1 },
          },
        }}
      />,
    );

    // Bloques ausentes o nulos: el bloque entero se anuncia no disponible.
    expect(bloque('Teléfono').getByText('No disponible')).toBeInTheDocument();
    expect(bloque('Agenda de contactos').getByText('No disponible')).toBeInTheDocument();
    expect(bloque('Permisos del teléfono').getByText('No disponible')).toBeInTheDocument();

    // Campos ausentes dentro de un bloque presente.
    const ubicacion = bloque('Ubicación');
    expect(valorDe(ubicacion, 'Punto del domicilio').textContent).toBe('No disponible');
    expect(valorDe(ubicacion, 'Ubicaciones simuladas').textContent).toBe('No disponible');
    // Un cero que SÍ vino se enseña como cero.
    expect(valorDe(ubicacion, 'Ubicaciones recibidas').textContent).toBe('0');
    expect(ubicacion.queryByRole('link')).not.toBeInTheDocument();
    expect(
      valorDe(bloque('Cronómetro y comportamiento del alta'), 'Duración total').textContent,
    ).toBe('No disponible');

    // Sin señales, no hay resumen de fraude, y se avisa de que la ausencia puede ser falta de dato.
    expect(screen.queryByText('Señales de fraude')).not.toBeInTheDocument();
    expect(screen.getByText(/no marca señales de fraude/i)).toBeInTheDocument();
  });
});
