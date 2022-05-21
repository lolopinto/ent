import { glob } from "glob";
import ts from "typescript";
import {
  readCompilerOptions,
  getTarget,
  createSourceFile,
} from "../tsc/compilerOptions";

async function main() {
  const options = readCompilerOptions(".");
  let files = glob.sync("src/ent/*.ts");
  const target = getTarget(options.target?.toString());

  files.forEach((file) => {
    // go through the file and print everything back if not starting immediately after other position
    let { contents, sourceFile } = createSourceFile(target, file);

    ts.forEachChild(sourceFile, function (node: ts.Node) {
      if (!ts.isClassDeclaration(node) || !node.heritageClauses) {
        return;
      }
      if (!node.heritageClauses) {
        return;
      }
      const klass = node.name?.getFullText(sourceFile).trim();
      if (!klass) {
        return;
      }

      const bases = node.heritageClauses
        .filter((hc) => hc.token === ts.SyntaxKind.ExtendsKeyword)
        .map((hc) =>
          hc.types.map((type) => type.expression.getText(sourceFile)),
        )
        // @ts-ignore why is this missing?
        .flat(1);
      if (bases.length !== 1) {
        return;
      }

      if (bases[0] !== klass + "Base") {
        return;
      }

      const pp = node.members.filter((mm) => {
        const v =
          mm.kind === ts.SyntaxKind.PropertyDeclaration &&
          (mm.name as ts.Identifier).escapedText === "privacyPolicy";
        if (!v) {
          return false;
        }
        const property = mm as ts.PropertyDeclaration;
        return (
          property.initializer?.kind === ts.SyntaxKind.ObjectLiteralExpression
        );
      });
      if (pp.length !== 1) {
        return;
      }
      const property = pp[0] as ts.PropertyDeclaration;
      const initializer = property.initializer as ts.ObjectLiteralExpression;
      console.debug(klass, initializer.properties);
      //      console.debug(pp);
    });
  });
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
