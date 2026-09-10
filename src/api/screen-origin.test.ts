import { describe, expect, it } from 'vitest';
import { ATLAS_PRODUCT, pantallaDeOrigen, setOriginHeaders } from './screen-origin';

/**
 * El backend del Motor guarda estas cabeceras con cada acceso y AtlasBackend las cruza con su
 * catálogo de pantallas. Un código de producto que no casara, o una ruta que el backend descarta,
 * no darían error: darían cero pantallas verificadas, que se leería como «nadie usa el portal».
 */
describe('origen de pantalla del portal del Motor', () => {
  it('el producto se normaliza al código del catálogo de pantallas', () => {
    expect(ATLAS_PRODUCT.replace(/-/g, '_').toUpperCase()).toBe('MOTOR_PORTAL');
  });

  it('manda la ruta concreta que está abierta', () => {
    const headers = new Headers();
    setOriginHeaders(headers, { pathname: '/approval-requests/42' });
    expect(headers.get('x-atlas-product')).toBe('motor-portal');
    expect(headers.get('x-atlas-flow')).toBe('/approval-requests/42');
  });

  it('una ruta que el backend descartaría no se manda, y sin ubicación no se inventa', () => {
    expect(pantallaDeOrigen({ pathname: '/a b' })).toBeNull();
    expect(pantallaDeOrigen({ pathname: '/%C3%B1' })).toBeNull();
    expect(pantallaDeOrigen(null)).toBeNull();
    const headers = new Headers();
    setOriginHeaders(headers, null);
    expect(headers.has('x-atlas-flow')).toBe(false);
    expect(headers.get('x-atlas-product')).toBe('motor-portal');
  });

  it('no pisa las cabeceras que ya traiga la petición', () => {
    const headers = new Headers({ 'x-atlas-flow': '/propia', 'x-atlas-product': 'otro' });
    setOriginHeaders(headers, { pathname: '/deployments' });
    expect(headers.get('x-atlas-flow')).toBe('/propia');
    expect(headers.get('x-atlas-product')).toBe('otro');
  });
});
