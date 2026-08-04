/**
 * Ejemplo con el que arranca la pantalla de importación.
 *
 * Dos cosas se enseñan aquí a la vez. La primera es la FORMA que el analizador
 * sabe convertir en un árbol: una cadena `if / else if / else` con su rama por
 * defecto, y cada rama devolviendo las salidas declaradas — cualquier otra cosa
 * se importa como un único nodo de script.
 *
 * La segunda es que los identificadores del contrato NO se inventan: son códigos
 * que ya existen en el catálogo de variables, con su tipo, y los motivos son
 * códigos del catálogo de motivos. Un ejemplo con nombres inventados enseñaría
 * justo el hábito que el importador ahora rechaza, y además abriría la pantalla
 * con media docena de errores encima. El nombre legible va en `name`; el `id` es
 * el del catálogo.
 *
 * `credit_risk_decision` declara sus valores permitidos (PASS/REVIEW/FAIL) en el
 * catálogo, así que el ejemplo escribe esos y no una traducción libre.
 */
export const SAMPLE_SOURCE = `// @atlas-contract
// { "contractVersion": "1",
//   "inputs": [
//     { "id": "age", "name": "Edad", "type": "INTEGER", "required": true },
//     { "id": "bureau_score", "name": "Score de buró", "type": "INTEGER", "required": true },
//     { "id": "monthly_income", "name": "Ingreso mensual", "type": "NUMBER", "required": true }],
//   "outputs": [
//     { "id": "credit_risk_decision", "name": "Decisión", "type": "STRING", "required": true },
//     { "id": "adverse_action_reason_codes", "name": "Motivo", "type": "STRING", "required": true },
//     { "id": "approved_credit_limit", "name": "Límite aprobado", "type": "NUMBER", "required": true }],
//   "primaryOutputId": "credit_risk_decision",
//   "reasonOutputId": "adverse_action_reason_codes" }
if (variables.age < 18) {
  return { credit_risk_decision: 'FAIL', adverse_action_reason_codes: 'AGE_NOT_ELIGIBLE', approved_credit_limit: 0 };
} else if (variables.bureau_score < 550) {
  return { credit_risk_decision: 'FAIL', adverse_action_reason_codes: 'BUREAU_SCORE_TOO_LOW', approved_credit_limit: 0 };
} else if (variables.bureau_score >= 700) {
  return { credit_risk_decision: 'PASS', adverse_action_reason_codes: 'APPROVED_POLICY', approved_credit_limit: variables.monthly_income * 0.35 };
} else {
  return { credit_risk_decision: 'REVIEW', adverse_action_reason_codes: 'SCORE_BAND_BORDERLINE', approved_credit_limit: 0 };
}
`;
