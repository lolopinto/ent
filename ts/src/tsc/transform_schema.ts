import ts from "typescript";
import * as fs from "fs";
import path from "path";
import {
  getClassInfo,
  getImportInfo,
  getPreText,
  transformRelative,
} from "../tsc/ast";
import { TransformFile } from "./transform";
import { Data } from "../core/base";

interface traverseInfo {
  rawString: string;
  removeImports: string[];
  newImports: string[];
}

function traverseClass(
  fileContents: string,
  sourceFile: ts.SourceFile,
  node: ts.ClassDeclaration,
  transformSchema: (s: string) => string,
): traverseInfo | undefined {
  const ci = getTransformClassInfo(
    fileContents,
    sourceFile,
    node,
    transformSchema,
  );
  if (!ci) {
    return;
  }

  let klassContents = `${ci.comment}const ${ci.name} = new ${transformSchema(
    ci.class,
  )}({\n`;
  let removeImports: string[] = [];
  if (ci.implementsSchema) {
    removeImports.push("Schema");
  }
  removeImports.push(ci.class);
  let newImports: string[] = [transformSchema(ci.class)];

  for (let member of node.members) {
    const fInfo = getClassElementInfo(fileContents, member, sourceFile);
    if (!fInfo) {
      return;
    }
    klassContents += `${fInfo.comment}${fInfo.key}:${fInfo.value},\n`;
    if (fInfo.type) {
      removeImports.push(fInfo.type);
    }
  }

  klassContents += "\n})";
  if (ci.export && ci.default) {
    klassContents += `\n export default ${ci.name};`;
  } else if (ci.export) {
    klassContents = "export " + klassContents;
  }
  //  console.debug(klassContents);

  return {
    rawString: klassContents,
    removeImports: removeImports,
    newImports,
  };
}

interface classInfo {
  class: string;
  comment: string;
  name: string;
  export?: boolean;
  default?: boolean;
  implementsSchema?: boolean;
}

function getTransformClassInfo(
  fileContents: string,
  sourceFile: ts.SourceFile,
  node: ts.ClassDeclaration,
  transformSchema: (s: string) => string,
): classInfo | undefined {
  const generic = getClassInfo(fileContents, sourceFile, node);
  if (!generic) {
    return;
  }

  let className = generic.name;
  if (!className?.endsWith("Schema")) {
    className += "Schema";
  }
  let implementsSchema = generic.implements?.some((v) => v == "Schema");
  let classExtends = generic.extends;
  // nothing transformed here, so nothing to do here
  if (classExtends && classExtends === transformSchema(classExtends)) {
    return undefined;
  }

  if (!className || !node.heritageClauses || !classExtends) {
    return undefined;
  }

  let ci: classInfo = {
    ...generic,
    name: className,
    class: classExtends,
    implementsSchema,
  };

  return ci;
}

interface propertyInfo {
  key: string;
  value: string;
  comment: string;
  type?: string;
}

// intentionally doesn't parse decorators since we don't need it
function getClassElementInfo(
  fileContents: string,
  member: ts.ClassElement,
  sourceFile: ts.SourceFile,
): propertyInfo | undefined {
  if (isFieldElement(fileContents, member, sourceFile)) {
    return getFieldElementInfo(fileContents, member, sourceFile);
  }
  if (member.kind === ts.SyntaxKind.Constructor) {
    return getConstructorElementInfo(fileContents, member, sourceFile);
  }
  if (member.kind !== ts.SyntaxKind.PropertyDeclaration) {
    return;
  }
  // other properties
  const property = member as ts.PropertyDeclaration;
  if (!property.initializer) {
    return;
  }
  const token = property.name as ts.Identifier;

  return {
    key: token.escapedText.toString(),
    value: property.initializer?.getFullText(sourceFile),
    comment: getPreText(fileContents, member, sourceFile),
    type: getType(property, sourceFile),
  };
}

function getType(
  property: ts.PropertyDeclaration,
  sourceFile: ts.SourceFile,
): string {
  let propertytype = property.type?.getText(sourceFile) || "";
  let ends = ["| null", "[]"];
  for (const end of ends) {
    if (propertytype.endsWith(end)) {
      propertytype = propertytype.slice(0, -1 * end.length);
    }
  }
  return propertytype;
}

function getFieldElementInfo(
  fileContents: string,
  member: ts.ClassElement,
  sourceFile: ts.SourceFile,
): propertyInfo | undefined {
  let fieldMap = "";

  // need to change to fields: {code: StringType()};
  const property = member as ts.PropertyDeclaration;
  const initializer = property.initializer as ts.ArrayLiteralExpression;

  fieldMap += "{";
  for (const element of initializer.elements) {
    const parsed = parseFieldElement(element, sourceFile, fileContents);
    if (parsed === null) {
      return;
    }
    const { callEx, name, nameComment, properties, suffix } = parsed;

    let property = "";
    const fieldComment = getPreText(fileContents, element, sourceFile).trim();
    if (fieldComment) {
      property += "\n" + fieldComment + "\n";
    }
    if (nameComment) {
      property += nameComment + "\n";
    }

    // e.g. UUIDType, StringType etc
    let call = callEx.expression.getText(sourceFile);
    let fnCall = "";
    if (properties.length) {
      fnCall = `{${properties.join(",")}}`;
    }
    property += `${name}:${call}(${fnCall})${suffix || ""},`;

    fieldMap += property;
  }
  fieldMap += "}";

  return {
    key: "fields",
    value: fieldMap,
    comment: getPreText(fileContents, member, sourceFile),
    type: getType(property, sourceFile),
  };
}

function getConstructorElementInfo(
  fileContents: string,
  member: ts.ClassElement,
  sourceFile: ts.SourceFile,
): propertyInfo | undefined {
  const c = member as ts.ConstructorDeclaration;
  //remove {}
  let fullText = c.body?.getFullText(sourceFile) || "";
  fullText = fullText.trim().slice(1, -1).trim();

  // convert something like
  /*
  constructor() {
    super();
    this.addPatterns(
      new Feedback(),
      new DayOfWeek(),
      new Feedback(),
      new DayOfWeek(),
    );
  }
    */
  // into this.addPatterns(new Feedback(),new DayOfWeek(),new Feedback(),new DayOfWeek(),)
  const lines = fullText
    .split("\n")
    .map((line) => line.trim())
    .join("")
    .split(";")
    .filter((f) => f != "super()" && f != "");
  // at this point there should be only line for what we handle
  if (lines.length != 1) {
    return;
  }
  const line = lines[0];
  const addPatterns = "this.addPatterns(";
  if (!line.startsWith(addPatterns)) {
    return;
  }

  return {
    key: "patterns",
    // remove this.addPatterns at the front, remove trailing ) at the end
    // if there's a trailing comma, it'll be handled by prettier
    value: `[${line.slice(addPatterns.length, -1)}]`,
    comment: "",
  };
}

function isFieldElement(
  fileContents: string,
  member: ts.ClassElement,
  sourceFile: ts.SourceFile,
): boolean {
  if (member.kind !== ts.SyntaxKind.PropertyDeclaration) {
    return false;
  }
  const property = member as ts.PropertyDeclaration;
  const token = property.name as ts.Identifier;
  if (token.escapedText !== "fields") {
    return false;
  }

  const propertytype = property.type?.getText(sourceFile);
  if (propertytype !== "Field[]") {
    return false;
  }

  if (property.initializer?.kind !== ts.SyntaxKind.ArrayLiteralExpression) {
    throwErr(fileContents, member, "invalid array type");
    return false;
  }

  return true;
}

interface ParsedFieldElement {
  // parsedCallExpression
  callEx: ts.CallExpression;
  // name of field
  name: string;
  // any comment associated with just the name
  nameComment?: string;
  // other properties (and their comments) e.g. nullable: true
  properties: string[];
  // e.g. trim().toLowerCase()
  suffix?: string;
}

// if there's an error transforming any of the schemas, we should stop...
function throwErr(fileContents: string, node: ts.Node, error: string) {
  console.error(error);
  throw new Error(
    `error transforming this field ${fileContents.substring(
      node.getFullStart(),
      node.getEnd(),
    )}`,
  );
}

function parseFieldElement(
  element: ts.Expression,
  sourceFile: ts.SourceFile,
  fileContents: string,
  nested?: boolean,
): ParsedFieldElement | null {
  if (
    element.kind !== ts.SyntaxKind.CallExpression &&
    element.kind !== ts.SyntaxKind.PropertyAccessExpression
  ) {
    throwErr(
      fileContents,
      element,
      `skipped unknown (non-call|non-property) expression ${element.kind}`,
    );
    return null;
  }

  if (element.kind === ts.SyntaxKind.PropertyAccessExpression) {
    const ret = parseFieldElement(
      (element as ts.PropertyAccessExpression).expression,
      sourceFile,
      fileContents,
      true,
    );
    if (ret !== null) {
      if (!nested) {
        ret.suffix = fileContents.substring(
          ret.callEx.getEnd(),
          element.getEnd(),
        );
      }
      return ret;
    }
  }
  let callEx = element as ts.CallExpression;
  if (callEx.arguments.length !== 1) {
    // have a situation like:     StringType({ name: "canonicalName" }).trim().toLowerCase(),
    // need to keep calling this until we find what we want and then get the suffix we should just add to the end of the transformed code
    if (callEx.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
      const ret = parseFieldElement(
        (callEx.expression as ts.PropertyAccessExpression).expression,
        sourceFile,
        fileContents,
        true,
      );
      if (ret !== null) {
        if (!nested) {
          ret.suffix = fileContents.substring(
            ret.callEx.getEnd(),
            callEx.getEnd(),
          );
        }
        return ret;
      }
    }

    throwErr(
      fileContents,
      element,
      "callExpression with arguments not of length 1",
    );
  }

  let arg = callEx.arguments[0];
  if (arg.kind !== ts.SyntaxKind.ObjectLiteralExpression) {
    // this and the check above for PropertyAccessExpression are to handle things like
    // FooType({
    /// ...
    // }).function(blah)
    const ret = parseFieldElement(
      callEx.expression,
      sourceFile,
      fileContents,
      true,
    );
    if (ret !== null) {
      if (!nested) {
        ret.suffix = fileContents.substring(
          ret.callEx.getEnd(),
          callEx.getEnd(),
        );
      }
      return ret;
    }
    throwErr(
      fileContents,
      element,
      `not objectLiteralExpression. kind ${arg.kind}`,
    );
    return null;
  }

  let expr = arg as ts.ObjectLiteralExpression;
  let name = "";
  let propertyComment: string | undefined;
  let properties: string[] = [];

  for (const p of expr.properties) {
    const p2 = p as ts.PropertyAssignment;

    // found name property
    if ((p2.name as ts.Identifier).escapedText === "name") {
      name = p2.initializer.getText(sourceFile);
      // check for any comment associated with name: "fooo"
      propertyComment = getPreText(fileContents, p, sourceFile).trim();
    } else {
      properties.push(p.getFullText(sourceFile));
    }
  }

  if (!name) {
    throwErr(fileContents, element, `couldn't find name property`);
    return null;
  }
  // remove quotes
  name = name.slice(1, -1);

  return {
    callEx,
    name,
    properties,
    nameComment: propertyComment,
  };
}

// find which of these importPaths is being used and use that to replace
function findSchemaImportPath(sourceFile: ts.SourceFile) {
  const paths: Data = {
    "@snowtop/ent": true,
    "@snowtop/ent/schema": true,
    "@snowtop/ent/schema/": true,
  };

  // @ts-ignore
  const importStatements: ts.ImportDeclaration[] = sourceFile.statements.filter(
    (stmt) => ts.isImportDeclaration(stmt),
  );

  for (const imp of importStatements) {
    const impInfo = getImportInfo(imp, sourceFile);
    if (!impInfo) {
      continue;
    }
    if (paths[impInfo.importPath] !== undefined) {
      return impInfo.importPath;
    }
  }
}

export class TransformSchema implements TransformFile {
  // we only end up doing this once because we change the schema representation
  // so safe to run this multiple times

  constructor(
    private relativeImports: boolean,
    private oldBaseClass?: string,
    private newSchemaClass?: string,
    private transformPath?: string,
  ) {}

  glob = "src/schema/*.ts";

  private transformSchema(className: string) {
    if (className === "BaseEntSchema" || className === "BaseEntSchemaWithTZ") {
      return className.substring(4);
    }

    if (className === this.oldBaseClass && this.newSchemaClass) {
      return this.newSchemaClass;
    }

    return className;
  }

  traverseChild(
    sourceFile: ts.SourceFile,
    contents: string,
    file: string,
    node: ts.Node,
  ) {
    if (!ts.isClassDeclaration(node)) {
      return { node };
    }

    // TODO address implicit schema doesn't work here...
    const ret = traverseClass(
      contents,
      sourceFile,
      node,
      this.transformSchema.bind(this),
    );
    if (ret === undefined) {
      return;
    }

    let imports = new Map<string, string[]>();

    const imp = findSchemaImportPath(sourceFile);
    if (imp) {
      if (this.transformPath) {
        imports.set(imp, []);
      } else {
        imports.set(imp, ret.newImports);
      }
    }
    if (this.transformPath) {
      // add new imports to this path
      imports.set(
        transformRelative(file, this.transformPath, this.relativeImports),
        ret.newImports,
      );
    }

    return {
      traversed: true,
      rawString: ret.rawString,
      removeImports: ret.removeImports,
      imports: imports,
    };
  }

  fileToWrite(file: string) {
    return "src/schema/" + path.basename(file).slice(0, -3) + "_schema.ts";
  }

  postProcess(file: string) {
    fs.rmSync(file);
  }

  prettierGlob = "src/schema/*.ts";
}
