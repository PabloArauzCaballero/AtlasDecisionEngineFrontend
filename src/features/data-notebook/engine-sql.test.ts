import { describe, expect, it } from 'vitest';
import {
  MAX_FILAS,
  RelacionNoPermitida,
  TECHO_RECUENTO,
  sentenciasDePagina,
  type CatalogoMotor,
} from './engine-sql';

const CATALOGO: CatalogoMotor = new Map([
  ['decisiones.ejecuciones', new Set(['id', 'creado_en', 'desenlace'])],
  ['riesgo.exposicion', new Set(['id'])],
]);

describe('sentenciasDePagina', () => {
  it('compone la página y el recuento de una relación del catálogo', () => {
    const { pagina, recuento } = sentenciasDePagina(
      { relacion: 'decisiones.ejecuciones', page: 2, pageSize: 100 },
      CATALOGO,
    );
    expect(pagina).toBe('SELECT * FROM "decisiones"."ejecuciones" LIMIT 100 OFFSET 100');
    expect(recuento).toBe(
      `SELECT count(*) AS total FROM (SELECT 1 FROM "decisiones"."ejecuciones" LIMIT ${TECHO_RECUENTO}) t`,
    );
  });

  /**
   * La prueba que da sentido al módulo: la forma correcta NO basta. `pg_catalog.pg_authid` es un
   * identificador impecable y guarda las credenciales de la base.
   */
  it('rechaza una relación que el motor no publica, aunque tenga forma válida', () => {
    expect(() =>
      sentenciasDePagina({ relacion: 'pg_catalog.pg_authid', page: 1, pageSize: 10 }, CATALOGO),
    ).toThrow(RelacionNoPermitida);
  });

  it('rechaza cualquier intento de cerrar el identificador y seguir escribiendo', () => {
    for (const relacion of [
      'decisiones.ejecuciones"; DROP TABLE x; --',
      'decisiones.ejecuciones UNION SELECT 1',
      'decisiones"."ejecuciones',
      "decisiones.ejecuciones' OR '1'='1",
      'decisiones.ejecuciones\n--',
    ]) {
      expect(() => sentenciasDePagina({ relacion, page: 1, pageSize: 10 }, CATALOGO)).toThrow(
        RelacionNoPermitida,
      );
    }
  });

  it('ordena sólo por una columna de ESA relación', () => {
    const { pagina } = sentenciasDePagina(
      {
        relacion: 'decisiones.ejecuciones',
        page: 1,
        pageSize: 50,
        orderBy: 'creado_en',
        orderDirection: 'ASC',
      },
      CATALOGO,
    );
    expect(pagina).toBe(
      'SELECT * FROM "decisiones"."ejecuciones" ORDER BY "creado_en" ASC LIMIT 50 OFFSET 0',
    );
  });

  it('rechaza ordenar por una columna que la relación no tiene', () => {
    expect(() =>
      sentenciasDePagina(
        {
          relacion: 'decisiones.ejecuciones',
          page: 1,
          pageSize: 50,
          orderBy: 'creado_en, (SELECT 1)',
        },
        CATALOGO,
      ),
    ).toThrow(RelacionNoPermitida);
  });

  /** La dirección se ELIGE entre dos constantes; lo que llega nunca se escribe. */
  it('cae a DESC ante una dirección que no es ASC', () => {
    const { pagina } = sentenciasDePagina(
      {
        relacion: 'decisiones.ejecuciones',
        page: 1,
        pageSize: 10,
        orderBy: 'id',
        orderDirection: 'ASC; DROP TABLE x' as 'ASC',
      },
      CATALOGO,
    );
    expect(pagina).toContain('ORDER BY "id" DESC');
  });

  it('acota el tamaño de página al techo', () => {
    const { pagina } = sentenciasDePagina(
      { relacion: 'riesgo.exposicion', page: 1, pageSize: 10_000 },
      CATALOGO,
    );
    expect(pagina).toContain(`LIMIT ${MAX_FILAS}`);
  });

  /**
   * `NaN` y `Infinity` llegan de cualquier cálculo que se salga —una resta sobre un total que no
   * llegó— y se habrían escrito tal cual dentro del `LIMIT`.
   */
  it('rechaza números que no son enteros utilizables', () => {
    for (const pageSize of [Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
      expect(() =>
        sentenciasDePagina({ relacion: 'riesgo.exposicion', page: 1, pageSize }, CATALOGO),
      ).toThrow(RelacionNoPermitida);
    }
  });

  it('nunca produce un desplazamiento negativo', () => {
    const { pagina } = sentenciasDePagina(
      { relacion: 'riesgo.exposicion', page: -5, pageSize: 10 },
      CATALOGO,
    );
    expect(pagina).toContain('OFFSET 0');
  });

  /** Un catálogo vacío —el motor no contestó todavía— no puede servir de coladero. */
  it('no consulta nada cuando el catálogo está vacío', () => {
    expect(() =>
      sentenciasDePagina({ relacion: 'decisiones.ejecuciones', page: 1, pageSize: 10 }, new Map()),
    ).toThrow(RelacionNoPermitida);
  });
});
