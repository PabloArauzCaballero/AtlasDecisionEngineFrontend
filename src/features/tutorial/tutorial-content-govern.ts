import type { TutorialRegistry } from './tutorial.types';

/** Platform, governance, audit and traceability tools. */
export const governTutorials: TutorialRegistry = {
  '/platform-health': {
    eyebrow: 'Plataforma',
    title: 'Platform Health',
    intro: 'El estado operativo del motor: métricas, servicios y disponibilidad en tiempo real.',
    steps: [
      {
        title: 'Estado general',
        body: 'Las tarjetas resumen las métricas clave y el estado de cada servicio: activo, degradado o caído.',
      },
      {
        title: 'Diagnostica desde aquí',
        body: 'Un servicio degradado o caído explica errores en otras vistas. Empieza siempre tu diagnóstico por esta pantalla.',
      },
    ],
  },
  '/reviews': {
    eyebrow: 'Gobierno',
    title: 'Bandeja de Revisiones',
    intro: 'Concentra las solicitudes de aprobación de Quality, Riesgo y Compliance.',
    steps: [
      {
        title: 'La bandeja',
        body: 'Cada solicitud muestra el artefacto, la versión, el paso actual del flujo y su SLA.',
      },
      {
        title: 'Decidir',
        body: 'Abre una solicitud para revisar sus gates y el diff de cambios, y aprobar o rechazar con justificación auditada.',
      },
    ],
  },
  '/environments': {
    eyebrow: 'Gobierno',
    title: 'Gestión de Ambientes',
    intro: 'Estado, capacidad y versión desplegada en cada entorno operativo.',
    steps: [
      {
        title: 'Leer un ambiente',
        body: 'Cada tarjeta indica el estado, la versión activa, la latencia y el uso de capacidad del entorno.',
      },
      {
        title: 'Ver su historial',
        body: 'Pulsa «Detalles» para cargar los despliegues recientes de ese ambiente.',
      },
    ],
  },
  '/deployments': {
    eyebrow: 'Gobierno',
    title: 'Historial de Despliegues',
    intro: 'El registro auditable de promociones, resultados y rollbacks por ambiente.',
    steps: [
      {
        title: 'El historial',
        body: 'Cada fila registra qué versión se promovió, a qué ambiente, por quién y con qué resultado.',
      },
      {
        title: 'Nuevo despliegue',
        body: 'Con rol Platform Admin, «Nuevo Despliegue» promueve una versión aprobada: DIRECT envía todo el tráfico; CANARY y Champion lo reparten por reglas.',
        tip: 'Solo se pueden desplegar versiones aprobadas y compiladas.',
      },
    ],
  },
  '/executions': {
    eyebrow: 'Auditoría',
    title: 'Buscador de Ejecuciones',
    intro: 'Consulta reproducible de cada solicitud de decisión y su resultado.',
    steps: [
      {
        title: 'Buscar',
        body: 'Filtra por request ID, artefacto, ambiente o rango de fecha para localizar una ejecución concreta.',
      },
      {
        title: 'Abrir el detalle',
        body: 'Cada ejecución conserva entrada, salida, tiempos y la traza completa de nodos, lista para auditoría.',
      },
    ],
  },
  '/audit-events': {
    eyebrow: 'Auditoría',
    title: 'Bitácora de Auditoría',
    intro: 'La cadena inmutable de eventos administrativos y operativos de la plataforma.',
    steps: [
      {
        title: 'Cadena de eventos',
        body: 'Cada evento registra actor, tipo, IP de origen y un hash encadenado con el evento anterior.',
      },
      {
        title: 'Verificar integridad',
        body: 'Los hashes encadenados permiten detectar cualquier alteración del registro sin depender de confianza.',
      },
    ],
  },
  '/objectives': {
    eyebrow: 'Trazabilidad',
    title: 'Objetivos de Negocio',
    intro: 'Conectan metas medibles con las políticas, artefactos y pruebas que las cumplen.',
    steps: [
      {
        title: 'Qué es un objetivo',
        body: 'Define una métrica y una meta (p. ej. reducir el fraude) y agrupa las políticas que la soportan.',
      },
      {
        title: 'Crear un objetivo',
        body: '«Nuevo Objetivo» (rol Risk Analyst o Compliance) define código, métrica, meta y equipo, y opcionalmente sus políticas iniciales.',
      },
      {
        title: 'Trazar de extremo a extremo',
        body: 'Desde el detalle saltas a los artefactos y pruebas vinculados, cerrando la trazabilidad de negocio.',
      },
    ],
  },
  '/coverage-matrix': {
    eyebrow: 'Trazabilidad',
    title: 'Matriz de Cobertura',
    intro: 'Cruza objetivos y artefactos para ver qué metas están respaldadas por evidencia.',
    steps: [
      {
        title: 'Leer la matriz',
        body: 'Cada celda indica si un objetivo tiene artefactos y pruebas que lo cubren.',
      },
      {
        title: 'Detectar huecos',
        body: 'Las celdas vacías marcan objetivos sin respaldo. Prioriza crear o vincular evidencia para cerrarlos.',
      },
    ],
  },
};
