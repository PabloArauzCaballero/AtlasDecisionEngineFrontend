import { describe, expect, it } from 'vitest';
import { enlaceSeguro, parseMarkdown } from './markdown';

describe('minimotor de Markdown', () => {
  it('entiende encabezados, párrafos y reglas', () => {
    const bloques = parseMarkdown('# Título\n\nUn párrafo.\n\n---');
    expect(bloques.map((bloque) => bloque.type)).toEqual(['heading', 'paragraph', 'rule']);
    expect(bloques[0]).toMatchObject({ level: 1 });
  });

  it('junta los puntos consecutivos en UNA lista', () => {
    const [lista] = parseMarkdown('- uno\n- dos\n- tres');
    expect(lista).toMatchObject({ type: 'list', ordered: false });
    expect(lista.type === 'list' && lista.items).toHaveLength(3);
  });

  it('distingue lista numerada de viñetas', () => {
    const bloques = parseMarkdown('1. uno\n2. dos\n\n- otra');
    expect(bloques.map((b) => b.type === 'list' && b.ordered)).toEqual([true, false]);
  });

  it('lee énfasis y código en línea', () => {
    const [parrafo] = parseMarkdown('**fuerte** y *suave* con `codigo`');
    expect(parrafo.type === 'paragraph' && parrafo.children.map((hijo) => hijo.type)).toEqual([
      'strong',
      'text',
      'em',
      'text',
      'code',
    ]);
  });

  it('conserva el bloque de código tal cual, sin interpretar lo de dentro', () => {
    const [codigo] = parseMarkdown('```python\ndf.head()  # **no** es negrita\n```');
    expect(codigo).toMatchObject({
      type: 'code',
      language: 'python',
      value: 'df.head()  # **no** es negrita',
    });
  });

  it('un bloque de código sin cerrar llega hasta el final', () => {
    const [codigo] = parseMarkdown('```\nmientras escribo');
    expect(codigo).toMatchObject({ type: 'code', value: 'mientras escribo' });
  });

  /**
   * La prueba que justifica que este archivo exista.
   *
   * `[pulsa](javascript:…)` es la forma clásica de meter ejecución en algo que parecía un
   * comentario. No se convierte en enlace y NO se borra: se enseña el texto entero, destino
   * incluido, porque quien lea la celda tiene que poder ver lo que alguien intentó.
   */
  it('no convierte en enlace un destino que no es un enlace', () => {
    const [parrafo] = parseMarkdown('[pulsa](javascript:alert(1))');
    const hijos = parrafo.type === 'paragraph' ? parrafo.children : [];

    // Ni un solo nodo de enlace: es la propiedad que importa.
    expect(hijos.some((hijo) => hijo.type === 'link')).toBe(false);
    // Y el texto se conserva ENTERO. Sale partido en varios nodos porque el paréntesis del
    // `alert(1)` corta la coincidencia, pero al pintarse se lee igual que se escribió — que es lo
    // que hace visible el intento en vez de tragárselo.
    expect(hijos.map((hijo) => (hijo.type === 'text' ? hijo.value : '')).join('')).toBe(
      '[pulsa](javascript:alert(1))',
    );
  });

  it('admite web, correo, ancla y ruta interna; rechaza el resto', () => {
    expect(enlaceSeguro('https://atlas.test')).toBe(true);
    expect(enlaceSeguro('mailto:alguien@atlas.test')).toBe(true);
    expect(enlaceSeguro('/workers/data-notebook')).toBe(true);
    expect(enlaceSeguro('#resultados')).toBe(true);
    expect(enlaceSeguro('javascript:alert(1)')).toBe(false);
    expect(enlaceSeguro('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(enlaceSeguro('  JavaScript:alert(1)')).toBe(false);
  });

  it('un enlace válido conserva rótulo y destino', () => {
    const [parrafo] = parseMarkdown('ver [la vista](/sql-console) para más');
    expect(parrafo.type === 'paragraph' && parrafo.children[1]).toMatchObject({
      type: 'link',
      href: '/sql-console',
    });
  });

  it('el texto vacío no produce bloques', () => {
    expect(parseMarkdown('   \n\n  ')).toEqual([]);
  });
});
