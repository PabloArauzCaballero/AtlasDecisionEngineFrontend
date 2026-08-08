# Contrato pendiente: petición de información sobre un caso

Estado: **el portal ya lo consume; el motor todavía no lo expone.**

El analista de riesgo puede consultar el expediente completo de un caso de
revisión manual, pero no puede cambiar ninguna regla
(`docs/usuarios-roles-y-permisos.md` §3). Lo único que sí necesita escribir es
pedir el dato que le falta —al backend central, al cliente o a un equipo
interno—, y eso es lo que define este contrato.

Mientras el endpoint no exista, el portal distingue el 404 de «el caso no
existe» y lo explica en pantalla (`src/features/manual-review/information-request.ts`),
en vez de mostrar un «no encontrado» crudo. La vista está completa y no hay que
tocarla cuando el motor lo publique.

## Petición

```http
POST /v1/manual-reviews/{caseId}/information-requests
Content-Type: application/json
```

```jsonc
{
  "source": "CORE_BACKEND", // CORE_BACKEND | CUSTOMER | INTERNAL
  "question": "Hace falta el histórico de movimientos de los últimos 6 meses…",
}
```

| Campo      | Tipo   | Obligatorio | Reglas                                              |
| ---------- | ------ | ----------- | --------------------------------------------------- |
| `source`   | enum   | sí          | Uno de los tres valores. Otro valor → 422.          |
| `question` | string | sí          | Mínimo 10 caracteres útiles; el portal ya lo exige. |

Los tres orígenes salen de `INFORMATION_SOURCES` en el portal. **Si el motor
añade uno, hay que añadirlo también ahí**: una lista que sólo crece de un lado
deja al analista sin poder pedir lo que el backend ya admite.

## Respuesta esperada

`201 Created` con la solicitud registrada. El portal sólo usa hoy el hecho de
que la llamada tenga éxito —muestra un aviso y relee el caso—, así que el cuerpo
puede crecer sin romperlo. Lo mínimo razonable:

```jsonc
{
  "id": "…",
  "caseId": "…",
  "source": "CORE_BACKEND",
  "question": "…",
  "status": "PENDING",
  "createdAt": "…",
}
```

## Errores que el portal ya distingue

| Código | Significado para el portal                                                                                           |
| ------ | -------------------------------------------------------------------------------------------------------------------- |
| `404`  | El endpoint no está desplegado **o** el caso no existe. Se explica que falta el endpoint, porque hoy es lo probable. |
| `403`  | «Tu rol no puede pedir información sobre este caso.»                                                                 |
| `422`  | Se muestra el mensaje del motor tal cual.                                                                            |

Cuando el endpoint exista, el 404 volverá a significar sólo «el caso no existe»
y conviene ajustar ese mensaje en `information-request.ts`.

## Autorización

Los roles que el portal habilita son `RISK_ANALYST`, `FRAUD_ANALYST` y
`OPERATIONS` (`CASE_CONSULT_ROLES` en `src/auth/business-rules.ts`), los mismos
que abren el caso. **El motor debe revalidarlo con sus propios `@Roles`**:
deshabilitar un botón no es un control de acceso, y un cliente HTTP directo se
lo salta entero.

## Lo que este repositorio NO puede hacer

Implementar el endpoint: vive en el Decision Engine, otro repositorio. Aquí sólo
está la mitad cliente del contrato —el formulario, la validación previa, el
manejo de cada error y esta especificación—, y está terminada.
