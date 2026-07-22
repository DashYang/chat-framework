export function createDiagnostic({
  severity = "error",
  code = "BUILD_FAILED",
  message,
  path = "",
  line,
  column,
  entityId,
  field
}) {
  const diagnostic = { severity, code, message: String(message || "Unknown build error") };
  if (path) diagnostic.path = String(path);
  if (Number.isInteger(line)) diagnostic.line = line;
  if (Number.isInteger(column)) diagnostic.column = column;
  if (entityId) diagnostic.entityId = String(entityId);
  if (field) diagnostic.field = String(field);
  return diagnostic;
}

export function diagnosticFromError(error, context = {}) {
  const message = error instanceof Error ? error.message : String(error);
  const markedLine = Number.isInteger(error?.mark?.line) ? error.mark.line + 1 : undefined;
  const markedColumn = Number.isInteger(error?.mark?.column) ? error.mark.column + 1 : undefined;
  return createDiagnostic({
    severity: "error",
    code: error?.code || context.code || "BUILD_FAILED",
    message,
    path: error?.path || context.path || "",
    line: error?.line ?? markedLine,
    column: error?.column ?? markedColumn,
    entityId: error?.entityId,
    field: error?.field
  });
}

export class BuildFailure extends Error {
  constructor(diagnostics) {
    const list = Array.isArray(diagnostics) ? diagnostics : [];
    super(list[0]?.message || "Build failed");
    this.name = "BuildFailure";
    this.diagnostics = list;
  }
}

export function requireBuildResult(result) {
  if (!result || !result.html || result.diagnostics?.some((item) => item.severity === "error")) {
    throw new BuildFailure(result?.diagnostics || []);
  }
  return result;
}
