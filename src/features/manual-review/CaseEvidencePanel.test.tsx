import { render, screen } from '@testing-library/react';
import { CaseEvidencePanel } from './CaseEvidencePanel';
import { ordenarDocumentos } from './CaseImagesPanel';

vi.mock('../../api/http-client', () => ({ apiRequest: vi.fn() }));
vi.mock('../../api/file-download', () => ({ apiDownload: vi.fn() }));

function valor(rotulo: string) {
  return (screen.getByText(rotulo, { selector: 'dt' }).nextElementSibling as HTMLElement)
    .textContent;
}

describe('CaseEvidencePanel', () => {
  it('pinta TODAS las claves: las conocidas en español, las de comportamiento incluidas', () => {
    render(
      <CaseEvidencePanel
        evidence={{
          motivo: 'COMPORTAMIENTO_IDENTIDAD_MECANICO',
          parecido: 0.9,
          segundosTotal: 75,
          segundosIdentidad: 30,
          pegadoEnCarnet: true,
          correccionesOcr: 0,
          capturaInterrumpida: false,
          abandonosPrevios: 2,
          botScore: 0.85,
          claveNueva: 'valor',
          alta: { version: 1 },
          altaActualizadaEn: '2026-09-28T12:00:00.000Z',
        }}
      />,
    );

    expect(valor('Motivo')).toBe('COMPORTAMIENTO_IDENTIDAD_MECANICO');
    expect(valor('Duración total del alta')).toBe('75 s (1 min 15 s)');
    expect(valor('Duración del paso de identidad')).toBe('30 s');
    expect(valor('Carnet pegado (no escrito)')).toContain('Señal de fraude');
    expect(valor('Correcciones a la lectura del carnet')).toBe('0');
    expect(valor('Salió de la app durante la captura')).toBe('No');
    expect(valor('Altas abandonadas antes')).toBe('2');
    expect(valor('Indicio de automatización (0-1)')).toContain('Señal de fraude');
    // Lo desconocido no desaparece: va con su clave tal cual.
    expect(screen.getByText('Otros datos de la evidencia')).toBeInTheDocument();
    expect(valor('claveNueva')).toBe('valor');
    // El expediente del alta tiene su propio panel: aquí no se repite.
    expect(screen.queryByText('alta', { selector: 'dt' })).not.toBeInTheDocument();
  });

  it('sin evidencia lo dice', () => {
    render(<CaseEvidencePanel evidence={{}} />);
    expect(screen.getByText(/no trae evidencia/i)).toBeInTheDocument();
  });
});

describe('ordenarDocumentos', () => {
  it('carnet anverso, reverso y las tres selfies; lo desconocido al final', () => {
    const tipos = [
      'selfie_right',
      'otro',
      'selfie',
      'identity_back',
      'selfie_left',
      'identity_front',
    ];
    expect(
      ordenarDocumentos(tipos.map((documentType) => ({ documentType }))).map((d) => d.documentType),
    ).toEqual(['identity_front', 'identity_back', 'selfie', 'selfie_left', 'selfie_right', 'otro']);
  });
});
