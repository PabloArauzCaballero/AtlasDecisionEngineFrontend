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
