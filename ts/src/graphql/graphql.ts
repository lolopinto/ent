import {
  GraphQLEnumType,
  GraphQLScalarType,
  isEnumType,
  isScalarType,
} from "graphql";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { Data } from "../core/base.js";
import type { FieldMap } from "../schema/index.js";
import {
  processFields,
  ProcessedField as ParsedProcessedField,
} from "../parse_schema/parse.js";
import { ImportPath } from "../schema/schema.js";

const nodeRequire = createRequire(import.meta.url);

async function importModule(specifier: string) {
  try {
    if (specifier.startsWith(".")) {
      return await import(new URL(specifier, import.meta.url).href);
    }
    if (specifier.startsWith("/")) {
      return await import(pathToFileURL(specifier).href);
    }
    return await import(specifier);
  } catch (err) {
    return nodeRequire(specifier);
  }
}

interface ClassType<T = any> {
  new (...args: any[]): T;
}

declare type StringToStringMap = {
  [key: string]: string;
};

interface CustomFieldInput {
  graphQLName?: string;
  name?: string;
  functionName?: string;
  args?: Field[];
  results?: Field[];
  fieldType: CustomFieldTypeInput;
  description?: string;
}

interface CustomTopLevelInput {
  class?: string; // for inline fields, it's empty
  graphQLName?: string;
  name?: string;
  functionName?: string;
  edgeName?: string;
  args?: Field[];
  results?: Field[];
  extraImports?: ImportPath[];
  functionContents?: string;
  fieldType: CustomFieldTypeInput;
  description?: string;
  nullable?: boolean;
  list?: boolean;
  connection?: boolean;
  resultType?: string;
}

type CustomFieldInputMap = {
  [key: string]: CustomFieldInput[];
};

type CustomTypeInputMap = {
  [key: string]: CustomTypeInput;
};

interface CustomObjectInput {
  name: string;
  graphQLName?: string;
  fields?: CustomFieldInput[];
}

export interface CustomGraphQLInput {
  fields?: CustomFieldInputMap;
  inputs?: CustomObjectInput[];
  objects?: CustomObjectInput[];
  args?: CustomObjectInput[];
  queries?: CustomTopLevelInput[];
  mutations?: CustomTopLevelInput[];
  customTypes?: CustomTypeInputMap;
}

export interface CustomTypeInput {
  type: string;
  // note that this should be an absolute path or an absolute path starting from src
  importPath: string;
  tsType?: string;
  // note that this should be an absolute path or an absolute path starting from src
  tsImportPath?: string;
  enumMap?: StringToStringMap;
  // create a struct type here...
  structFields?: FieldMap;

  // if enumMap or structField
  // are we creating an inputType or output type
  // determines where file is located and for the struct type, determines if GraphQLInputObjectType or GraphQLObjectType
  inputType?: boolean;
  [x: string]: any;
}

export type CustomType = Omit<CustomTypeInput, "structFields"> & {
  structFields?: ParsedProcessedField[];
};

// scalars or classes
// string for GraphQL name in situation where we can't load the object
// e.g. User, Contact etc
// CustomType for types that are not in "graphql" and we need to know where to load it from...
type Type =
  | GraphQLScalarType
  | GraphQLEnumType
  | ClassType
  | string
  | CustomTypeInput;

// node in a connection
export type GraphQLConnection<T> = { node: T };

interface gqlFieldOptionsBase {
  name?: string;
  nullable?: boolean | NullableListOptions;
  description?: string;
  type?: Type | Array<Type> | GraphQLConnection<Type>; // types or lists of types
}

interface gqlFieldArg extends Omit<gqlFieldOptionsBase, "name"> {
  isContextArg?: boolean;
  name: string;
}

export interface gqlFieldOptions extends gqlFieldOptionsBase {
  class: string;

  args?: gqlFieldArg[];
  async?: boolean;

  // required for @gqlField
  type: NonNullable<gqlFieldOptionsBase["type"]>;
}

export interface gqlObjectOptions {
  name?: string;
  description?: string;
}

export interface gqlObjectWithInterfaceOptions extends gqlObjectOptions {
  interfaces?: string[];
}

export interface gqlObjectWithUnionOptions extends gqlObjectOptions {
  unionTypes: string[];
}

type gqlMutationOptions = Omit<gqlFieldOptions, "nullable" | "type"> & {
  type?: gqlFieldOptionsBase["type"];
};

// nullable allowed in query. why was it previously not allowed??
type gqlQueryOptions = gqlFieldOptions;

export enum CustomFieldType {
  Accessor = "ACCESSOR",
  Field = "FIELD",
  Function = "FUNCTION",
  AsyncFunction = "ASYNC_FUNCTION",
}

export type CustomFieldTypeInput =
  | "ACCESSOR"
  | "FIELD"
  | "FUNCTION"
  | "ASYNC_FUNCTION";

interface CustomFieldImpl {
  nodeName: string;
  gqlName: string;
  functionName: string; // accessorName (not necessarily a function)
  // need enum type for accessor/function/etc so we can build generated code
  importPath?: string;
  fieldType: CustomFieldType;
  description?: string;
}

export interface CustomField extends CustomFieldImpl {
  args: Field[];
  results: Field[];
  extraImports?: ImportPath[]; // defined on server
  functionContents?: string; // used in dynamic
  // used by graphql connections e.g. if you a field `foo_connection`, you can specify the edge name here as `foo` so the generated
  // connection is RootToFooConnectionType instead of RootToFooConnectionConnectionType
  // mostly API bloat though but all of this can be changed eventually.
  edgeName?: string;
}

export interface CustomMutation extends CustomField {}
export interface CustomQuery extends CustomField {}

export interface ProcessedCustomField extends CustomFieldImpl {
  args: ProcessedField[];
  results: ProcessedField[];
}

export type ProcessCustomFieldMap = {
  [key: string]: ProcessedCustomField[];
};

export interface CustomObject {
  nodeName: string;
  className: string; // TODO both of these 2 the same right now
  description?: string;
  interfaces?: string[];
  unionTypes?: string[];
}

type NullableListOptions = "contents" | "contentsAndList";

interface FieldImpl {
  type: string; // TODO
  tsType?: string; // TODO make this required...
  importPath?: string;
  needsResolving?: boolean; // unknown type that we need to resolve eventually
  list?: boolean;
  connection?: boolean;
  name: string;
}

export interface Field extends FieldImpl {
  // if a list and nullable
  // list itself is nullable
  // if a list and items are nullable, list is not nullable but list contains nullable items
  // if a list and both are nullable, both contents and list itself nullable
  nullable?: boolean | NullableListOptions;
  isContextArg?: boolean;
}

export interface ProcessedField extends FieldImpl {
  nullable?: NullableResult;
  isContextArg?: boolean;
}

enum NullableResult {
  CONTENTS = "contents",
  CONTENTS_AND_LIST = "contentsAndList",
  ITEM = "true", // nullable = true
}

export const knownAllowedNames: Map<string, string> = new Map([
  ["Date", "Date"],
  ["Boolean", "boolean"],
  ["Number", "number"],
  ["String", "string"],
  // TODO not right to have this and Number
  ["Int", "number"],
  ["Float", "number"],
  ["ID", "ID"],
  ["JSON", "any"],
  ["Node", "Ent"],
]);

export const knownDisAllowedNames: Map<string, boolean> = new Map([
  ["Function", true],
  ["Object", true],
  ["Array", true],
  ["Promise", true],
]);

export const knownInterfaces: Map<string, boolean> = new Map([
  ["Node", true],
  ["Edge", true],
  ["Connection", true],
]);

const isArray = (type: Type | Array<Type>): type is Array<Type> => {
  if (typeof type === "function") {
    return false;
  }
  return (type as Array<Type>).push !== undefined;
};

const isConnection = (
  type: Type | Array<Type> | GraphQLConnection<Type>,
): type is GraphQLConnection<Type> => {
  if (typeof type !== "object") {
    return false;
  }
  return (type as GraphQLConnection<Type>).node !== undefined;
};

const isString = (type: Type | Array<Type>): type is string => {
  if ((type as string).lastIndexOf !== undefined) {
    return true;
  }
  return false;
};

export const isCustomType = (type: Type): type is CustomTypeInput => {
  return (type as CustomTypeInput).importPath !== undefined;
};

const isGraphQLScalarType = (type: Type): type is GraphQLScalarType => {
  return isScalarType(type as GraphQLScalarType);
};

const isGraphQLEnumType = (type: Type): type is GraphQLEnumType => {
  return isEnumType(type as GraphQLEnumType);
};

export const addCustomType = async (
  type: CustomTypeInput,
  gqlCapture: typeof GQLCapture,
) => {
  // TODO these should return ReadOnly objects...
  const customTypes = gqlCapture.getCustomTypes();
  const hadExisting = customTypes.has(type.type);
  const customType = customTypes.get(type.type);

  if (!hadExisting) {
    // Register immediately so sync callers see the type.
    customTypes.set(type.type, { ...type });
  } else if (customType && customType === type) {
    return;
  }

  const addType = async (type: CustomTypeInput) => {
    // @ts-expect-error
    const typ2: CustomType = { ...type };
    if (type.structFields) {
      typ2.structFields = await processFields(type.structFields);
    }
    customTypes.set(type.type, typ2);
  };

  if (type.enumMap || type.structFields) {
    await addType(type);
  }
  if (type.importPath) {
    try {
      const r = await importModule(type.importPath);
      const ct = r[type.type] ?? r.default?.[type.type];
      // this gets us the information needed for scalars
      if (ct && isGraphQLScalarType(ct)) {
        type.scalarInfo = {
          description: ct.description,
          name: ct.name,
        };
        if (ct.specifiedByURL) {
          type.scalarInfo.specifiedByUrl = ct.specifiedByURL;
        }
      }
    } catch (e) {
      if (type.secondaryImportPath) {
        await addCustomType(
          {
            ...type,
            importPath: type.secondaryImportPath,
          },
          gqlCapture,
        );
      }
      return;
    }
  }

  if (hadExisting) {
    const currentType = customTypes.get(type.type);
    if (JSON.stringify(currentType) !== JSON.stringify(type)) {
      throw new Error(`cannot add multiple custom types of name ${type.type}`);
    }
    return;
  }
  await addType(type);
};

interface typeInfo {
  list?: boolean | undefined;
  scalarType?: boolean;
  enumType?: boolean;
  connection?: boolean | undefined;
  type: string;
  tsType?: string;
}

const getType = (
  typ: Type | Array<Type> | GraphQLConnection<Type>,
  result: typeInfo,
): undefined => {
  if (isConnection(typ)) {
    result.connection = true;
    return getType(typ.node, result);
  }

  if (isArray(typ)) {
    result.list = true;
    return getType(typ[0], result);
  }

  if (isString(typ)) {
    if (typ.lastIndexOf("]") !== -1) {
      result.list = true;
      result.type = typ.substr(1, typ.length - 2);
    } else {
      result.type = typ;
    }
    return;
  }
  if (isCustomType(typ)) {
    result.type = typ.type;
    result.tsType = typ.tsType;
    // TODO???
    addCustomType(typ, GQLCapture);
    return;
  }
  // GraphQLScalarType or GraphQLEnumType or ClassType
  result.scalarType = isGraphQLScalarType(typ);
  result.enumType = isGraphQLEnumType(typ);
  result.type = typ.name;
  return;
};

export class GQLCapture {
  private static enabled = false;

  static enable(enabled: boolean) {
    this.enabled = enabled;
  }

  static isEnabled(): boolean {
    return this.enabled;
  }

  // map from class name to fields
  private static customFields: Map<string, CustomField[]> = new Map();
  private static customQueries: CustomQuery[] = [];
  private static customMutations: CustomMutation[] = [];
  private static customArgs: Map<string, CustomObject> = new Map();
  private static customInputObjects: Map<string, CustomObject> = new Map();
  private static customObjects: Map<string, CustomObject> = new Map();
  private static customInterfaces: Map<string, CustomObject> = new Map();
  private static customUnions: Map<string, CustomObject> = new Map();
  private static customTypes: Map<string, CustomType> = new Map();

  static clear(): void {
    this.customFields.clear();
    this.customQueries = [];
    this.customMutations = [];
    this.customArgs.clear();
    this.customInputObjects.clear();
    this.customObjects.clear();
    this.customInterfaces.clear();
    this.customUnions.clear();
    this.customTypes.clear();
  }

  static getCustomFields(): Map<string, CustomField[]> {
    return this.customFields;
  }

  static getCustomMutations(): CustomMutation[] {
    return this.customMutations;
  }

  static getCustomQueries(): CustomQuery[] {
    return this.customQueries;
  }

  static getCustomArgs(): Map<string, CustomObject> {
    return this.customArgs;
  }

  static getCustomInputObjects(): Map<string, CustomObject> {
    return this.customInputObjects;
  }

  static getCustomObjects(): Map<string, CustomObject> {
    return this.customObjects;
  }

  static getCustomInterfaces(): Map<string, CustomObject> {
    return this.customInterfaces;
  }

  static getCustomUnions(): Map<string, CustomObject> {
    return this.customUnions;
  }

  static getCustomTypes(): Map<string, CustomType> {
    return this.customTypes;
  }

  private static getNullableArg(fd: Field): ProcessedField {
    let res: ProcessedField = fd as ProcessedField;
    if (fd.nullable === undefined) {
      return res;
    }
    if (fd.nullable === false) {
      delete res.nullable;
      return res;
    }
    if (fd.nullable === "contents") {
      res.nullable = NullableResult.CONTENTS;
    } else if (fd.nullable === "contentsAndList") {
      res.nullable = NullableResult.CONTENTS_AND_LIST;
    } else {
      res.nullable = NullableResult.ITEM;
    }
    return res;
  }

  static getProcessedCustomFields(): ProcessCustomFieldMap {
    let result: Data = {};
    for (const [key, value] of this.customFields) {
      result[key] = this.getProcessedCustomFieldsImpl(value);
    }
    return result;
  }

  static getProcessedCustomMutations(): ProcessedCustomField[] {
    return this.getProcessedCustomFieldsImpl(this.customMutations);
  }

  static getProcessedCustomQueries(): ProcessedCustomField[] {
    return this.getProcessedCustomFieldsImpl(this.customQueries);
  }

  private static getProcessedCustomFieldsImpl(
    customFields: CustomField[],
  ): ProcessedCustomField[] {
    return customFields.map((field) => {
      let res: ProcessedCustomField = field as ProcessedCustomField;
      res.args = field.args.map((arg) => {
        return this.getNullableArg(arg);
      });
      res.results = field.results.map((result) => {
        return this.getNullableArg(result);
      });
      return res;
    });
  }

  private static getField(field: gqlFieldOptionsBase | gqlFieldArg): Field {
    let list: boolean | undefined;
    let scalarType = false;
    let connection: boolean | undefined;
    let type = "";
    let enumType = false;
    let typeInfoResult: typeInfo | undefined;

    if (field?.type) {
      typeInfoResult = { type: "" };
      getType(field.type, typeInfoResult);
      list = typeInfoResult.list;
      scalarType = typeInfoResult.scalarType || false;
      enumType = typeInfoResult.enumType || false;
      connection = typeInfoResult.connection;
      type = typeInfoResult.type;
    }

    if (!type) {
      throw new Error(`type is required for accessor/function/property`);
    }
    if (knownDisAllowedNames.has(type)) {
      throw new Error(
        `${type} isn't a valid type for accessor/function/property`,
      );
    }

    let result: Field = {
      name: field?.name || "",
      type: type,
      tsType:
        typeInfoResult?.tsType ||
        knownAllowedNames.get(type) ||
        this.customTypes.get(type)?.tsType,
      nullable: field?.nullable,
      list: list,
      connection: connection,
      // @ts-ignore
      isContextArg: field?.isContextArg,
    };

    // unknown type. we need to flag that this field needs to eventually be resolved
    if (!knownAllowedNames.has(type)) {
      // we do this so that we know how to import them later
      // would be nice not to need that. seems like we should be able to do it by checking the imports for the page
      if (scalarType) {
        throw new Error(
          `custom scalar type ${type} is not supported this way. use CustomType syntax. see \`gqlFileUpload\` as an example`,
        );
      }
      if (enumType) {
        throw new Error(
          `custom enum type ${type} is not supported this way. use CustomType syntax. see \`gqlFileUpload\` as an example`,
        );
      }
      result.needsResolving = true;
    }
    return result;
  }

  static gqlField(options: gqlFieldOptions): any {
    return function (
      _target: any,
      ctx:
        | ClassMethodDecoratorContext
        | ClassFieldDecoratorContext
        | ClassGetterDecoratorContext,
    ) {
      if (
        !GQLCapture.isEnabled() ||
        (ctx.kind !== "method" &&
          ctx.kind !== "field" &&
          ctx.kind !== "getter") ||
        ctx.static ||
        ctx.private
      ) {
        return;
      }

      let customField = GQLCapture.getCustomField(ctx, options);
      if (!customField) {
        return;
      }
      const connections = customField.results.filter(
        (result) => result.connection,
      );
      if (connections.length > 1) {
        throw new Error(`if using a connection, need to only return one item`);
      }
      if (connections.length === 1) {
        const conn = connections[0];
        if (conn.list) {
          throw new Error("GraphQLConnection result cannot be a list");
        }
        if (conn.nullable) {
          throw new Error("GraphQLConnection result cannot be nullable");
        }
        if (conn.isContextArg) {
          throw new Error("GraphQLConnection result cannot be contextArg");
        }

        if (customField.fieldType === CustomFieldType.AsyncFunction) {
          throw new Error(
            `async function not currently supported for GraphQLConnection`,
          );
        }
      }
      let list = GQLCapture.customFields.get(customField.nodeName);
      if (list === undefined) {
        list = [];
      }
      list.push(customField);
      GQLCapture.customFields.set(customField.nodeName, list);
    };
  }

  private static getCustomField(
    ctx:
      | ClassMethodDecoratorContext
      | ClassFieldDecoratorContext
      | ClassGetterDecoratorContext,
    options: gqlFieldOptions | gqlMutationOptions | gqlQueryOptions,
    allowNoReturnType?: boolean,
  ): CustomField {
    let fieldType: CustomFieldType;

    let args: Field[] = [];
    let results: Field[] = [];

    switch (ctx.kind) {
      case "method":
        fieldType = CustomFieldType.Function;
        if (options.async) {
          fieldType = CustomFieldType.AsyncFunction;
        }
        break;

      case "field":
        fieldType = CustomFieldType.Field;
        break;

      case "getter":
        fieldType = CustomFieldType.Accessor;
        break;
    }

    if (!allowNoReturnType && !options.type) {
      throw new Error(`type is required for ${fieldType}`);
    }
    if (options.type) {
      // override name property passed down so we return '' as name
      results.push(GQLCapture.getField({ ...options, name: "" }));
    }

    if (options.args?.length) {
      options.args.forEach((arg) => {
        args.push(GQLCapture.getField(arg));
      });
    }

    return {
      nodeName: options.class,
      gqlName: options?.name || ctx.name.toString(),
      functionName: ctx.name.toString(),
      args: args,
      results: results,
      fieldType: fieldType!,
      description: options?.description,
    };
  }

  static gqlContextType(): gqlFieldArg {
    return {
      name: "context",
      isContextArg: true,
      type: "Context",
    };
  }

  static gqlArgType(options?: gqlObjectOptions): any {
    return function (target: any, ctx: ClassDecoratorContext): void {
      return GQLCapture.customGQLObject(ctx, GQLCapture.customArgs, options);
    };
  }

  static gqlInputObjectType(options?: gqlObjectOptions): any {
    return function (target: any, ctx: ClassDecoratorContext): void {
      return GQLCapture.customGQLObject(
        ctx,
        GQLCapture.customInputObjects,
        options,
      );
    };
  }

  static gqlObjectType(options?: gqlObjectWithInterfaceOptions): any {
    return function (target: any, ctx: ClassDecoratorContext): void {
      return GQLCapture.customGQLObject(ctx, GQLCapture.customObjects, options);
    };
  }

  static gqlUnionType(options: gqlObjectWithUnionOptions): any {
    return function (target: any, ctx: ClassDecoratorContext): void {
      return GQLCapture.customGQLObject(ctx, GQLCapture.customUnions, options);
    };
  }

  static gqlInterfaceType(options?: gqlObjectOptions): any {
    return function (target: any, ctx: ClassDecoratorContext): void {
      return GQLCapture.customGQLObject(
        ctx,
        GQLCapture.customInterfaces,
        options,
      );
    };
  }

  private static customGQLObject(
    ctx: ClassDecoratorContext,
    map: Map<string, CustomObject>,
    options?: gqlObjectWithInterfaceOptions | gqlObjectWithUnionOptions,
  ) {
    if (!GQLCapture.isEnabled() || ctx.kind !== "class" || !ctx.name) {
      return;
    }

    let className = ctx.name.toString();
    let nodeName = options?.name || className;

    map.set(className, {
      className,
      nodeName,
      description: options?.description,
      // @ts-ignore
      interfaces: options?.interfaces,
      // @ts-ignore
      unionTypes: options?.unionTypes,
    });
  }

  // we want to specify args if any, name, response if any
  static gqlQuery(options: gqlQueryOptions): any {
    return function (target: Function, ctx: ClassMethodDecoratorContext): void {
      if (!GQLCapture.isEnabled()) {
        return;
      }

      GQLCapture.customQueries.push(GQLCapture.getCustomField(ctx, options));
    };
  }

  static gqlMutation(options: gqlMutationOptions): any {
    return function (target: Function, ctx: ClassMethodDecoratorContext): void {
      if (!GQLCapture.isEnabled()) {
        return;
      }

      GQLCapture.customMutations.push(
        GQLCapture.getCustomField(ctx, options, true),
      );
    };
  }

  static gqlConnection(type: Type): any {
    return {
      node: type,
    };
  }

  static resolve(objects: string[]): void {
    let baseObjects = new Map<string, boolean>();
    objects.forEach((object) => baseObjects.set(object, true));

    this.customObjects.forEach((obj, key) => {
      baseObjects.set(key, true);

      obj.interfaces?.forEach((interfaceName) => {
        const inter = this.customInterfaces.get(interfaceName);
        if (inter) {
          const fields = this.customFields.get(inter.nodeName);
          if (fields) {
            // check for duplicate fields
            // if field is already defined no need to add it
            let objFields = this.customFields.get(obj.nodeName);
            if (!objFields) {
              objFields = [];
            }
            let map = new Map();
            for (const f of objFields) {
              map.set(f.gqlName, f);
            }
            for (const field of fields) {
              const newField = {
                ...field,
                nodeName: obj.nodeName,
              };
              if (map.has(field.gqlName)) {
                const existing = map.get(field.gqlName)!;
                if (JSON.stringify(existing) !== JSON.stringify(newField)) {
                  throw new Error(
                    `object ${obj.nodeName} has duplicate field ${field.gqlName} with different definition`,
                  );
                }
                continue;
              }
              objFields.push(newField);
            }
            this.customFields.set(obj.nodeName, objFields);
          }
        } else if (!knownInterfaces.has(interfaceName)) {
          throw new Error(
            `object ${key} references unknown interface ${interfaceName}`,
          );
        }
      });
    });

    let baseArgs = new Map<string, boolean>();
    this.customArgs.forEach((_val, key) => baseArgs.set(key, true));
    this.customInputObjects.forEach((_val, key) => baseArgs.set(key, true));
    // add all objects as arg types because it can include enums
    // depend on graphql to throw error if it's not a valid input type
    objects.map((object) => baseArgs.set(object, true));
    baseArgs.set("Context", true);
    this.customTypes.forEach((_val, key) => baseArgs.set(key, true));

    this.customUnions.forEach((val, key) => {
      if (this.customFields.has(key)) {
        throw new Error(`union ${key} has custom fields which is not allowed`);
      }

      val.unionTypes?.forEach((typ) => {
        if (!baseObjects.has(typ)) {
          throw new Error(
            `union ${key} references ${typ} which isn't a graphql object`,
          );
        }
      });
    });

    const resolveFields = (fields: CustomField[]) => {
      fields.forEach((field) => {
        // we have a check earlier that *should* make this path impossible
        field.args.forEach((arg) => {
          if (arg.needsResolving) {
            if (baseArgs.has(arg.type) || this.customTypes.has(arg.type)) {
              arg.needsResolving = false;
            } else {
              throw new Error(
                `arg ${arg.name} of field ${field.functionName} with type ${arg.type} needs resolving. should not be possible`,
              );
            }
          }
        });
        // fields are not because we can return existing ents and we want to run the capturing
        // in parallel with the codegen gathering step so we resolve at the end to make
        // sure there's no dangling objects
        // TODO when we have other objects, we may need to change the logic here
        // but i don't think it applies
        field.results.forEach((result) => {
          if (result.needsResolving) {
            if (
              baseObjects.has(result.type) ||
              // allow custom input objects to be returned
              // depend on GraphQL type complaining if we try and reference an input from a non-input object
              this.customInputObjects.has(result.type) ||
              this.customUnions.has(result.type) ||
              this.customInterfaces.has(result.type) ||
              this.customTypes.has(result.type)
            ) {
              result.needsResolving = false;
            } else {
              throw new Error(
                `field ${field.functionName} references ${result.type} which isn't a graphql object`,
              );
            }
          }
        });
      });
    };
    GQLCapture.customFields.forEach((customFields) =>
      resolveFields(customFields),
    );
    resolveFields(GQLCapture.customQueries);
    resolveFields(GQLCapture.customMutations);
  }
}

// why is this a static class lol?
// TODO make all these just plain functions
export const gqlField = GQLCapture.gqlField;

export const gqlArgType = GQLCapture.gqlArgType;
export const gqlInputObjectType = GQLCapture.gqlInputObjectType;
export const gqlObjectType = GQLCapture.gqlObjectType;
export const gqlInterfaceType = GQLCapture.gqlInterfaceType;
export const gqlUnionType = GQLCapture.gqlUnionType;
export const gqlQuery = GQLCapture.gqlQuery;
export const gqlMutation = GQLCapture.gqlMutation;
export const gqlContextType = GQLCapture.gqlContextType;
export const gqlConnection = GQLCapture.gqlConnection;

// this requires the developer to npm-install "graphql-upload on their own"
const gqlFileUpload: CustomTypeInput = {
  type: "GraphQLUpload",
  importPath: "graphql-upload/GraphQLUpload.mjs",
  tsType: "FileUpload",
  tsImportPath: "graphql-upload/processRequest.mjs",
};

export { gqlFileUpload };
