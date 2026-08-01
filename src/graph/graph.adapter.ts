type Row = Record<string, unknown>;

export function snapshotToEditableGraph(snapshot: Row): Row {
  return {
    dependencies: rows(snapshot.variables).map((variable) => ({
      variableVersionId: String(variable.variableVersionId),
      usageType: String(variable.usageType ?? 'INPUT'),
      isRequired: Boolean(variable.required),
      fallbackPolicy: String(variable.fallbackPolicy),
      dependencyPath: String(
        variable.dependencyPath ?? `input.${String(variable.code ?? variable.variableVersionId)}`,
      ),
    })),
    // Intermedias y contrato de salida viajan tal cual: el backend es quien valida su
    // coherencia con el grafo, y recortarlos aquí solo escondería el error hasta publicar.
    intermediates: rows(snapshot.intermediates).map(omitId),
    outputContract: rows(snapshot.outputContract).map(omitId),
    conditions: rows(snapshot.conditions).map(omitId),
    actions: rows(snapshot.actions).map((action) => ({
      code: action.code,
      type: action.type,
      payload: action.payload ?? {},
      terminal: Boolean(action.terminal),
      reasonCodes: rows(action.reasonCodes).map((reason) => ({
        reasonCodeId: String(reason.id),
        priority: Number(reason.priority),
      })),
    })),
    nodes: rows(snapshot.nodes).map((node) => ({
      key: node.key,
      type: node.type,
      label: node.label,
      config: node.config ?? {},
      x: node.x,
      y: node.y,
      order: node.order,
      terminal: Boolean(node.terminal),
      conditions: rows(node.conditions).map((binding) => ({
        conditionCode: binding.code,
        order: binding.order,
        expected: Boolean(binding.expected),
      })),
      actions: rows(node.actions).map((binding) => ({
        actionCode: binding.code,
        order: binding.order,
      })),
      // `contractInputs` y `fieldCode` son ayudas del editor: el backend resuelve la
      // definición ejecutable desde su propio registro y no acepta que se la dicten.
      calculatedFieldCalls: rows(node.calculatedFieldCalls).map((call) => ({
        callKey: call.callKey,
        calculatedFieldVersionId: String(call.calculatedFieldVersionId),
        inputMapping: call.inputMapping ?? {},
        targetKind: call.targetKind,
        targetCode: call.targetCode,
      })),
    })),
    edges: rows(snapshot.edges).map((edge) => ({
      key: edge.key,
      from: edge.from,
      to: edge.to,
      type: edge.type,
      priority: edge.priority,
      default: Boolean(edge.default),
      conditions: rows(edge.conditions).map((binding) => ({
        conditionCode: binding.code,
        order: binding.order,
      })),
    })),
  };
}

function rows(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Row => Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      )
    : [];
}

function omitId(row: Row): Row {
  return Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'id'));
}
