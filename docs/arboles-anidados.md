# Una familia de árboles de decisión anidados

Cinco algoritmos de originación de crédito que se invocan entre sí. Existen para
que el **grafo de dependencias** (`/artifacts/{id}/dependency-graph`) tenga algo
real que enseñar en sus dos paneles —«Depende de» y «Referenciado por»— y para
que lo que enseñe se sostenga como política de crédito, no sólo como demo.

Los siembra `docs/seed-arboles-anidados.py`.

## Por qué están partidos así

Anidar un árbol sólo tiene sentido cuando el hijo responde una pregunta que
**vale por separado**: si el hijo no es reutilizable ni auditable por su cuenta,
partirlo es burocracia y el flujo debería ser un solo árbol.

Aquí las tres preguntas son independientes de verdad:

| Árbol                    | La pregunta que responde                    | Por qué vive aparte                                                                                                           |
| ------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `CAPACIDAD_PAGO_CONSUMO` | ¿La cuota cabe en el bolsillo?              | Es aritmética de ingreso y deuda. No sabe nada de historial. La usa también un refinanciamiento.                              |
| `SOLVENCIA_BURO`         | ¿El comportamiento de pago pasado respalda? | Depende del buró y del empleo. La usa cualquier producto con historial, con o sin cuota.                                      |
| `RIESGO_CREDITICIO`      | ¿Qué riesgo tiene este solicitante?         | Decide **cuál de las dos lecturas manda** y publica un veredicto. Es la política de riesgo, y cambia sin tocar los productos. |
| `ORIGINACION_CONSUMO`    | ¿Se otorga este préstamo?                   | Elegibilidad dura (identidad, sanciones, edad) + el veredicto de riesgo.                                                      |
| `LIMITE_TARJETA_CREDITO` | ¿Se otorga esta tarjeta y con qué cupo?     | Otro producto, otras reglas duras, **el mismo motor de riesgo**.                                                              |

## El árbol que llena los dos paneles

```
        ORIGINACION_CONSUMO        LIMITE_TARJETA_CREDITO
                    \                    /
                     \                  /
                      RIESGO_CREDITICIO          ← los dos paneles, poblados
                       /              \
                      /                \
        CAPACIDAD_PAGO_CONSUMO      SOLVENCIA_BURO
```

`RIESGO_CREDITICIO` es el objetivo de la demostración: **2 dependencias y 2
dependientes**. Las hojas dejan vacío el panel izquierdo y las raíces el derecho,
que también hay que poder ver —un estado vacío honesto vale tanto como uno lleno.

Profundidad total: 3 niveles. El motor admite hasta `NESTED_TREE_MAX_DEPTH`
(por defecto 5) y responde `NESTED_TREE_MAX_DEPTH_EXCEEDED` al pasarse.

## La decisión de diseño que hace que el anidado funcione

Una referencia vive en un nodo **RESULT** y un RESULT es **terminal**: cuando el
padre invoca al hijo, la respuesta del hijo _es_ la respuesta del padre en esa
rama. No hay post-proceso.

Eso obliga a algo que resulta ser lo correcto: **los tres niveles publican el
mismo contrato de tres campos** —nivel, motivo, recomendación— y cada padre
republica el del hijo bajo sus propios códigos.

| Nivel    | nivel                                               | motivo                                  | recomendación                                         |
| -------- | --------------------------------------------------- | --------------------------------------- | ----------------------------------------------------- |
| Hojas    | `nivel_riesgo_capacidad` / `nivel_riesgo_solvencia` | `motivo_capacidad` / `motivo_solvencia` | `recomendacion_capacidad` / `recomendacion_solvencia` |
| Riesgo   | `riesgo_nivel`                                      | `riesgo_motivo`                         | `riesgo_recomendacion`                                |
| Producto | —                                                   | `motivo_originacion` / `motivo_tarjeta` | `decision_originacion` / `decision_tarjeta`           |

El motivo viaja hacia arriba sin reescribirse: la razón que el cliente recibe al
final la escribió el árbol que de verdad tomó la decisión, tres niveles abajo.

`CAPACIDAD_PAGO_CONSUMO` publica además `dti_resultante`, que **ningún padre
mapea**. Es diagnóstico: queda en la traza para el analista y no ensucia el
contrato de quien la consume.

## Cómo decide `RIESGO_CREDITICIO` a quién preguntar

```
monto / ingreso_mensual >= 5  ?
   sí → CAPACIDAD_PAGO_CONSUMO     (exposición material: manda si la cuota cabe)
   no → SOLVENCIA_BURO             (ticket pequeño: la cuota siempre cabe;
                                    lo que discrimina es el historial)
```

No es un reparto arbitrario: es la práctica de _affordability assessment_ para
tickets grandes frente a _behavioural scoring_ para tickets chicos. Y es lo que
hace que el panel «Depende de» muestre **dos hijos distintos** en lugar de dos
llamadas al mismo.

## El mapeo de entradas, y el literal que importa

`LIMITE_TARJETA_CREDITO` no tiene `monto` ni `plazo_meses` —una tarjeta no se
amortiza—, pero `RIESGO_CREDITICIO` sí los pide. El vínculo los resuelve:

```jsonc
{ "childVariableCode": "monto",       "source": "VARIABLE", "path": "cupo_solicitado" },
{ "childVariableCode": "plazo_meses", "source": "LITERAL",  "value": 12 }
```

Ese `12` es un supuesto de política declarado —un cupo se evalúa como si se
amortizara en doce meses— y queda escrito en el vínculo, donde se audita, en vez
de escondido dentro del árbol de riesgo.

## Sembrarla

Requiere el motor en marcha y una `MANAGEMENT_API_KEY` con rol `RISK_ANALYST` o
`FRAUD_ANALYST`. Es idempotente: lo que ya existe se omite (409).

```powershell
$env:MANAGEMENT_API_KEY = "<tu-key>"
$env:DECISION_ENGINE_URL = "http://127.0.0.1:3000"   # opcional
$env:TENANT_ID = "1"                                  # opcional
python docs/seed-arboles-anidados.py
```

El script hace el recorrido completo y de abajo hacia arriba, porque el motor
exige que el hijo esté **compilado** antes de que nadie lo referencie
(`CHILD_VERSION_NOT_COMPILED`):

1. variables de catálogo → `POST /v1/variables`
2. artefactos → `POST /v1/artifacts`
3. grafo de cada hoja → `PUT /v1/artifact-versions/{id}/graph` con `if-match`
4. `validate` + `compile` de las hojas
5. grafo de `RIESGO_CREDITICIO`, sus dos referencias, `validate` + `compile`
6. lo mismo para las dos raíces

Al terminar imprime el enlace directo al grafo de dependencias de
`RIESGO_CREDITICIO`, que es la vista con los dos paneles llenos.

### Si algo falla

El script imprime el cuerpo del error del motor tal cual. Los dos puntos de
fricción conocidos:

- **`outputContract`**: si el motor lo rechaza, el script reintenta el `PUT` sin
  él y lo dice. El grafo queda sembrado; el contrato de salida se completa en el
  editor.
- **`path` del `inputMapping`**: se envía el código pelado (`ingreso_mensual`),
  igual que `docs/referenciar-algoritmo.py`. Si tu motor espera `input.<código>`,
  cámbialo en `MAPEO_DIRECTO`.

## Verlo sin el motor

`e2e/nested-trees.spec.ts` monta esta misma familia contra un motor simulado
(`e2e/support/nested-trees-backend.ts`) y comprueba que los dos paneles se
pintan poblados y que los enlaces navegan al artefacto correcto:

```bash
yarn playwright test e2e/nested-trees.spec.ts
```
