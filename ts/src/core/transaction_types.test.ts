import path from "path";
import ts from "typescript";

test("transaction metadata accepts custom viewers with strict function types", () => {
  const fixture = path.join(__dirname, "../testutils/transaction_types.ts");
  const program = ts.createProgram([fixture], {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
  });
  const source = program.getSourceFile(fixture)!;
  const diagnostics = program.getSemanticDiagnostics(source);
  expect(
    diagnostics.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    ),
  ).toEqual([]);
});

test("conditional changeset preparation preserves custom viewer types", () => {
  const file = path.join(__dirname, "../action/orchestrator.ts");
  const program = ts.createProgram([file], {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
  });
  const source = program.getSourceFile(file)!;
  const orchestrator = source.statements.find(
    (statement): statement is ts.ClassDeclaration =>
      ts.isClassDeclaration(statement) &&
      statement.name?.text === "Orchestrator",
  )!;
  const method = orchestrator.members.find(
    (member) => member.name?.getText(source) === "buildPlusChangeset",
  )!;
  expect(method).toBeDefined();
  const diagnostics = program
    .getSemanticDiagnostics(source)
    .filter(
      (diagnostic) =>
        diagnostic.start !== undefined &&
        diagnostic.start >= method.getStart(source) &&
        diagnostic.start < method.end,
    );
  expect(
    diagnostics.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    ),
  ).toEqual([]);
});
