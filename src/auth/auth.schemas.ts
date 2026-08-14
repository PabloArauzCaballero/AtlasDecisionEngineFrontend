import { z } from 'zod';

/**
 * El contrato de sesión: estricto en lo que se USA, tolerante en lo que no.
 *
 * Antes exigía las trece propiedades. Como `parseResponse` convierte cualquier
 * desajuste en `RESPONSE_CONTRACT_MISMATCH`, y `restoreSession` trata ese fallo
 * como sesión inválida, bastaba con que el proveedor de identidad dejase de
 * enviar UN campo que el portal ni siquiera lee —`permissions`, `jobTitle`, el
 * `tokenType` en minúscula— para que NADIE pudiera entrar, con un mensaje que
 * además culpaba al backend de devolver algo inesperado. Un campo que no se
 * consume no puede tener autoridad para dejar fuera a toda la organización.
 *
 * El criterio, entonces: obligatorio sólo lo que rompería una vista si faltara
 * (identidad, correo, roles y el token). Lo demás se declara con su tipo y con
 * un valor por omisión, así que un contrato más pobre degrada en vez de cerrar
 * la puerta. Lo que el motor decida de verdad —qué puede hacer esta persona— lo
 * sigue revalidando él en cada operación.
 */

/**
 * Lista de texto que tolera ausencia y nulo, pero no un tipo distinto.
 *
 * Es `.transform()` y no `.default()` porque en Zod 3 un valor por omisión sólo
 * cubre `undefined`: con `.default([])`, un `"legacyRoles": null` explícito —que
 * es lo que manda un backend con la columna vacía— atravesaba el esquema tal
 * cual y llegaba como `null` a `hasAnyRole`, que espera un arreglo. Lo cazó la
 * prueba de este mismo archivo.
 */
const stringList = z
  .array(z.string())
  .nullish()
  .transform((value) => value ?? []);

/** Texto opcional que el portal muestra cuando existe. */
const optionalText = z
  .string()
  .nullish()
  .transform((value) => value ?? null);

/**
 * Señal de seguridad de tres estados: sí, no, y «este motor no informa».
 *
 * Sin valor por omisión a propósito. Con `.default(false)`, un motor que no
 * publique `mfaEnabled` haría que el portal afirmase que NADIE tiene segundo
 * factor y avisara a toda la plantilla de algo que no sabe.
 */
const reportedFlag = z.boolean().nullish();

export const identityUserSchema = z.object({
  // Lo que sostiene la sesión: sin esto no hay a quién atribuir nada.
  id: z.string().min(1),
  tenantId: z.string().min(1),
  email: z.string().email(),
  // El armazón pinta `name ?? fullName`; basta con que llegue uno.
  name: z
    .string()
    .nullish()
    .transform((value) => value ?? ''),
  fullName: z
    .string()
    .nullish()
    .transform((value) => value ?? ''),
  status: z
    .string()
    .nullish()
    .transform((value) => value ?? 'ACTIVE'),
  userCode: optionalText,
  department: optionalText,
  jobTitle: optionalText,
  /*
   * Estos dos SÍ se leen ahora (ver `SessionSecurityNotice`). Siguen siendo
   * opcionales: un motor que no los mande no debe impedir el acceso, sólo deja
   * de poder avisar.
   */
  mustChangePassword: reportedFlag,
  mfaEnabled: reportedFlag,
  roles: stringList,
  legacyRoles: stringList,
  permissions: stringList,
});

/**
 * El primer paso del acceso NO siempre devuelve una sesión.
 *
 * Cuando el proveedor exige segundo factor, la contraseña correcta produce un desafío: un token
 * opaco y el aviso de que el PIN va camino del correo. No es un error —la credencial era buena— y
 * tratarlo como tal era justamente lo que dejaba fuera del portal a las cuentas protegidas.
 */
export const pinChallengeSchema = z.object({
  pinChallengeRequired: z.literal(true),
  challengeToken: z.string().min(1),
  expiresInMinutes: z.number(),
});

export const sessionPayloadSchema = z.object({
  accessToken: z.string().min(1),
  /*
   * Se acepta cualquier capitalización y se normaliza. `z.literal('Bearer')`
   * convertía un `"bearer"` en minúscula —perfectamente válido según el RFC
   * 6750, que declara el esquema insensible a mayúsculas— en un bloqueo total
   * de acceso por un campo que el cliente ni siquiera envía de vuelta.
   */
  tokenType: z
    .string()
    .nullish()
    .default('Bearer')
    .transform(() => 'Bearer' as const),
  /** Informativo: la caducidad real se lee del propio JWT (`token.ts`). */
  expiresIn: z.union([z.string(), z.number()]).nullish().default(''),
  user: identityUserSchema,
});

/**
 * Los dos desenlaces posibles de entregar la contraseña. El desafío va primero en la unión porque
 * es el que se reconoce por una marca propia (`pinChallengeRequired`); una sesión no la lleva, y un
 * desafío no lleva `accessToken` ni `user`, así que ninguno puede pasar por el otro.
 */
export const loginOutcomeSchema = z.union([pinChallengeSchema, sessionPayloadSchema]);
