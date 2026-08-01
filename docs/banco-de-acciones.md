# Banco de acciones — estado actual y lo que falta en el motor

Verificado contra el motor local el 2026-07-28.

## Lo que el portal entrega hoy

`/actions` es un banco global: se abre sin elegir algoritmo y reúne las acciones
de **todas** las versiones. Por cada acción muestra qué implica, qué lee, qué
escribe, qué motivos emite, en qué algoritmos existe y qué pasos la ejecutan.
Desde cualquier fila se aplica a un algoritmo destino, que es lo que la convierte
en un repertorio reutilizable y no en un anexo de una versión.

## Por qué es una vista y no un recurso

En el motor las acciones **no son un recurso**. Viven dentro del grafo:

```prisma
model DecisionRuleAction {
  artifactVersionId   BigInt
  actionCode          String
  actionType          String
  payloadTemplateJson Json
  isTerminal          Boolean
  @@unique([artifactVersionId, actionCode])   // <- por versión, no global
}
```

Comprobado: `/v1/actions`, `/v1/decision-actions`,
`/v1/artifact-versions/:id/actions` y `/v1/views/pickers/actions` devuelven 404.
No hay módulo `actions` en `src/modules`. Las variables y los reason codes sí son
globales (`/v1/variables`, `/v1/reason-codes`); las acciones no.

Consecuencias que el banco hace visibles:

1. **Divergencia.** El mismo `actionCode` puede tener definiciones distintas en
   dos algoritmos y nada lo impide. La columna «Coherencia» marca `DIVERGE`.
2. **Reutilizar es copiar.** Aplicar una acción a otro algoritmo duplica la fila
   en `decision_rule_action`. A partir de ahí las dos copias evolucionan por
   separado.
3. **Corregir no se propaga.** Arreglar una acción mal definida obliga a repetir
   el cambio en cada algoritmo que la tenga.
4. **Coste de lectura.** El banco necesita el grafo completo de cada versión. Con
   3 versiones y 87 acciones son ~106 KB; con cientos de versiones deja de servir.

## Lo que haría falta en el motor

Que las acciones sigan el modelo que ya usan las variables: definición global +
versión inmutable, y el grafo referenciando una versión concreta.

```prisma
model DecisionActionDefinition {
  id            BigInt
  tenantId      BigInt
  actionCode    String   // único por tenant
  actionType    String
  businessDescription String
  ownerTeam     String
  versions      DecisionActionVersion[]
  @@unique([tenantId, actionCode])
}

model DecisionActionVersion {
  id                  BigInt
  definitionId        BigInt
  versionNumber       Int
  payloadTemplateJson Json
  isTerminal          Boolean
  status              String   // DRAFT | ACTIVE | DEPRECATED
  @@unique([definitionId, versionNumber])
}
```

Y `decision_rule_action` pasa a ser la vinculación:
`artifactVersionId + actionVersionId` (como `decision_variable_dependency` hace
con las variables), conservando `@@unique([artifactVersionId, actionCode])` para
no romper las referencias por código que ya usan los nodos.

Endpoints mínimos, con las mismas convenciones que `/v1/reason-codes`:

| Método | Ruta                         | Para qué                                                |
| ------ | ---------------------------- | ------------------------------------------------------- |
| `GET`  | `/v1/actions`                | Listado paginado con filtros `type`, `search`, `status` |
| `POST` | `/v1/actions`                | Alta con `initialVersion`, igual que `/v1/variables`    |
| `GET`  | `/v1/actions/:code`          | Detalle con todas sus versiones                         |
| `POST` | `/v1/actions/:code/versions` | Nueva versión (las publicadas son inmutables)           |
| `GET`  | `/v1/actions/:code/usages`   | Qué artefactos y pasos la ejecutan                      |
| `GET`  | `/v1/views/pickers/actions`  | Forma ligera: `code`, `type`, `latestVersionId`         |

Migración: por cada `decision_rule_action` existente, crear la definición si no
existe y una versión por cada huella distinta del payload. Las huellas que
colisionen bajo el mismo código son exactamente las divergencias que el banco ya
lista hoy, así que la lista de conflictos a resolver a mano se puede sacar antes
de migrar.

## «Importar código»: los motivos ya se emiten (2026-07-31)

**Corregido en el motor.** El analizador ahora sí genera acciones: cuando el
literal que escribe una rama coincide con un reason code **del catálogo del
tenant**, se genera una acción `EMIT_REASON` y, delante del resultado, un nodo
`ACTION` que la ejecuta (el motor sólo ejecuta acciones en nodos `ACTION`):

```
CHECK_1 --sí--> REASON_1 (EMIT_AGE_NOT_ELIGIBLE) --> RESULT_1
```

- El contrato admite `reasonOutputId` para declarar qué salida lleva el motivo
  (`"reasonOutputId": "motivo"`); sin él se busca la coincidencia en cualquier
  salida de texto.
- **No se inventan motivos:** un literal que nadie declaró en el catálogo se
  queda exactamente como estaba, y el panel de esta vista lo sigue señalando.
- **No se copian acciones:** la acción generada referencia el reason code que ya
  existe (`reasonCodeId`), no crea uno nuevo por importación. Si alguien
  desactiva el motivo entre analizar y guardar, el guardado falla con
  `CODE_IMPORT_REASON_CODE_MISSING` en vez de escribir un grafo roto.
- Evidencia: `AtlasDecisionEngine/test/code-import-reasons.spec.ts` recorre
  código → árbol → grafo válido → ejecución y exige que el motivo salga en
  `reasons` con su mensaje público.

Sigue pendiente lo estructural de la sección anterior: las acciones como
**recurso global versionado** (hoy siguen viviendo por versión de artefacto), que
es lo que evitaría la divergencia entre copias.

### Cómo era antes

`generatedGraph` traía `dependencies, nodes, edges, conditions` y ningún
`actions`; cada rama se convertía en un nodo `RESULT` con asignaciones literales:

```json
{
  "mode": "MAPPING",
  "assignments": [
    { "outputCode": "decision", "source": "LITERAL", "value": "RECHAZADO" },
    { "outputCode": "motivo", "source": "LITERAL", "value": "AGE_NOT_ELIGIBLE" }
  ]
}
```

Es decir: un motivo de negocio entraba al grafo como una cadena suelta, aunque el
catálogo ya tuviera ese reason code declarado, y sobre el resultado no se podía
filtrar por motivo, ni explicarlo al cliente, ni auditarlo.

Los tres puntos que faltaban —(1) emitir `EMIT_REASON` al reconocer el literal,
(2) declarar el motivo con `reasonOutputId`, (3) incluir `actions` en
`generatedGraph` y escribirlas reutilizando el catálogo— están hechos; el detalle,
arriba.
