import "reflect-metadata";
import { GraphQLScalarType } from "graphql";

interface ClassType<T = any> {
  new (...args: any[]): T;
}

export interface CustomType {
  type: string;
  importPath: string;
  tsType?: string;
  tsImportPath?: string;
}

// scalars or classes
// string for GraphQL name in situation where we can't load the object
// e.g. User, Contact etc
// CustomType for types that are not in "graphql" and we need to know where to load it from...
type Type = GraphQLScalarType | ClassType | string | CustomType;

// node in a connection
export type GraphQLConnection<T> = { node: T };

export interface gqlFieldOptions {
  name?: string;
  nullable?: boolean | NullableListOptions;
  description?: string;
  type?: Type | Array<Type> | GraphQLConnection<Type>; // types or lists of types
}

interface fieldOptions extends gqlFieldOptions {
  // implies no return type...
  allowFunctionType?: boolean;
}

export interface gqlObjectOptions {
  name?: string;
  description?: string;
}

type gqlTopLevelOptions = Exclude<gqlFieldOptions, "nullable">;
// export interface gqlTopLevelOptions
//   name?: string;
//   type?: Type | Array<Type>;
//   description?: string;
// }

export enum CustomFieldType {
  Accessor = "ACCESSOR",
  Field = "FIELD", // or property
  Function = "FUNCTION",
  AsyncFunction = "ASYNC_FUNCTION", // do we care about this?
}

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
}

export interface CustomMutation extends CustomField {}
export interface CustomQuery extends CustomField {}

export interface ProcessedCustomField extends CustomFieldImpl {
  args: ProcessedField[];
  results: ProcessedField[];
}

export type ProcessCustomFieldMap = {
  [key: string]: ProcessedCustomField;
};

export interface CustomObject {
  nodeName: string;
  className: string; // TODO both of these 2 the same right now
  description?: string;
}

// export interface CustomArg {
//   nodeName: string;
//   className: string; // TODO both the same right now...
// }

// export interface CustomInputObject {
//   nodeName: string;
//   className: string; // TODO both the same right now
// }

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

interface arg {
  name: string;
  index: number;
  options?: gqlFieldOptions;
  isContextArg?: boolean;
}

interface metadataIsh {
  name: string; // the type
  paramName?: string;
  isContextArg?: boolean;
}

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
  private static customTypes: Map<string, CustomType> = new Map();

  static clear(): void {
    this.customFields.clear();
    this.customQueries = [];
    this.customMutations = [];
    this.customArgs.clear();
    this.customInputObjects.clear();
    this.customObjects.clear();
    this.customTypes.clear();
    this.argMap.clear();
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

  static getCustomTypes(): Map<string, CustomType> {
    return this.customTypes;
  }

  private static getNullableArg(fd: Field): ProcessedField {
    let res: ProcessedField = fd as ProcessedField;
    if (fd.nullable === undefined) {
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
    let result = {};
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

  private static knownAllowedNames: Map<string, string> = new Map([
    ["Date", "Date"],
    ["Boolean", "boolean"],
    ["Number", "number"],
    ["String", "string"],
    // TODO not right to have this and Number
    ["Int", "number"],
    ["Float", "number"],
    ["ID", "ID"],
  ]);

  private static knownDisAllowedNames: Map<string, boolean> = new Map([
    ["Function", true],
    ["Object", true],
    ["Array", true],
    ["Promise", true],
  ]);

  private static getResultFromMetadata(
    metadata: metadataIsh,
    options?: fieldOptions,
  ): Field {
    let type = metadata.name;
    if ((type === "Number" || type === "Object") && !options?.type) {
      throw new Error(
        `type is required when accessor/function/property returns a ${type}`,
      );
    }

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

    const isCustomType = (type: Type): type is CustomType => {
      return (type as CustomType).importPath !== undefined;
    };

    const isGraphQLScalarType = (type: Type): type is GraphQLScalarType => {
      return (type as GraphQLScalarType).serialize !== undefined;
    };

    const addCustomType = (type: CustomType) => {
      const customType = this.customTypes.get(type.type);

      if (customType && customType !== type) {
        throw new Error(
          `cannot add multiple custom types of name ${type.type}`,
        );
      }

      this.customTypes.set(type.type, type);
    };

    interface typeInfo {
      list?: boolean | undefined;
      scalarType?: boolean;
      connection?: boolean | undefined;
      type: string;
    }

    const getType = (
      typ: Type | Array<Type> | GraphQLConnection<Type>,
      result: typeInfo,
    ) => {
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
        addCustomType(typ);
        return;
      }
      // GraphQLScalarType or ClassType
      result.scalarType = isGraphQLScalarType(typ);
      result.type = typ.name;
      return;
    };

    let list: boolean | undefined;
    let scalarType = false;
    let connection: boolean | undefined;

    if (options?.type) {
      let r: typeInfo = { type: "" };
      getType(options.type, r);
      list = r.list;
      scalarType = r.scalarType || false;
      connection = r.connection;
      type = r.type;
    }

    if (GQLCapture.knownDisAllowedNames.has(type)) {
      throw new Error(
        `${type} isn't a valid type for accessor/function/property`,
      );
    }

    let result: Field = {
      name: metadata.paramName || "",
      type,
      tsType:
        this.knownAllowedNames.get(type) || this.customTypes.get(type)?.tsType,
      nullable: options?.nullable,
      list: list,
      connection: connection,
      isContextArg: metadata.isContextArg,
    };
    // unknown type. we need to flag that this field needs to eventually be resolved
    if (!GQLCapture.knownAllowedNames.has(type)) {
      if (scalarType) {
        throw new Error(
          `custom scalar type ${type} is not supported this way. use CustomType syntax. see \`gqlFileUpload\` as an example`,
        );
      }
      result.needsResolving = true;
    }
    return result;
  }

  static gqlField(options?: gqlFieldOptions): any {
    return function (
      target,
      propertyKey: string,
      descriptor: PropertyDescriptor,
    ): void {
      if (!GQLCapture.isEnabled()) {
        return;
      }

      let customField = GQLCapture.getCustomField(
        target,
        propertyKey,
        descriptor,
        options,
      );
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
    target,
    propertyKey: string,
    descriptor: PropertyDescriptor,
    options?: fieldOptions,
  ): CustomField {
    let fieldType: CustomFieldType;
    let nodeName = target.constructor.name as string;

    let args: Field[] = [];
    let results: Field[] = [];

    let typeMetadata: metadataIsh | null = Reflect.getMetadata(
      "design:type",
      target,
      propertyKey,
    );
    let returnTypeMetadata: metadataIsh | null = Reflect.getMetadata(
      "design:returntype",
      target,
      propertyKey,
    );

    if (returnTypeMetadata) {
      // function...
      if (returnTypeMetadata.name === "Promise") {
        fieldType = CustomFieldType.AsyncFunction;
      } else {
        fieldType = CustomFieldType.Function;
      }

      results.push(
        GQLCapture.getResultFromMetadata(returnTypeMetadata, options),
      );
    } else if (typeMetadata) {
      if (descriptor && descriptor.get) {
        fieldType = CustomFieldType.Accessor;
      } else if (descriptor && descriptor.value) {
        // could be implicit async
        fieldType = CustomFieldType.Function;
      } else {
        fieldType = CustomFieldType.Field;
      }

      if (
        !(
          options?.allowFunctionType &&
          fieldType === CustomFieldType.Function &&
          typeMetadata.name === "Function"
        )
      ) {
        results.push(GQLCapture.getResultFromMetadata(typeMetadata, options));
      }
    }

    let params: metadataIsh[] | null = Reflect.getMetadata(
      "design:paramtypes",
      target,
      propertyKey,
    );

    if (params && params.length > 0) {
      let parsedArgs = GQLCapture.argMap.get(nodeName)?.get(propertyKey) || [];
      if (params.length !== parsedArgs.length) {
        throw new Error(
          `args were not captured correctly, ${params.length}, ${parsedArgs.length}`,
        );
      }
      parsedArgs.forEach((arg) => {
        let param = params![arg.index];
        let paramName = arg.name;
        let field = GQLCapture.getResultFromMetadata(
          {
            name: param.name,
            paramName,
            isContextArg: arg.isContextArg,
          },
          arg.options,
        );

        // TODO this may not be the right order...
        args.push(field);
      });
      // TODO this is deterministically (so far) coming in reverse order so reverse (for now)
      args = args.reverse();
    }

    return {
      nodeName: nodeName,
      gqlName: options?.name || propertyKey,
      functionName: propertyKey,
      args: args,
      results: results,
      fieldType: fieldType!,
      description: options?.description,
    };
  }

  // User -> add -> [{name, options}, {}, {}]
  private static argMap: Map<string, Map<string, arg[]>> = new Map();

  private static argImpl(
    name: string,
    isContextArg?: boolean,
    options?: gqlFieldOptions,
  ): any {
    return function (
      target,
      propertyKey: string,
      index: number, // not PropertyKeyDescriptor?
    ): void {
      if (!GQLCapture.isEnabled()) {
        return;
      }

      let nodeName = target.constructor.name as string;
      let m = GQLCapture.argMap.get(nodeName);
      if (!m) {
        m = new Map();
        GQLCapture.argMap.set(nodeName, m);
      }
      let propertyMap = m.get(propertyKey);
      if (!propertyMap) {
        propertyMap = [];
        m.set(propertyKey, propertyMap);
      }
      propertyMap.push({
        name: name,
        index: index,
        options: options,
        isContextArg,
      });

      //      console.log("arg", name, target, propertyKey, index);
    };
  }

  // TODO custom args because for example name doesn't make sense here.
  static gqlArg(name: string, options?: gqlFieldOptions): any {
    return GQLCapture.argImpl(name, undefined, options);
  }

  static gqlContextType(): any {
    // hardcoded?
    return GQLCapture.argImpl("context", true, { type: "Context" });
  }

  static gqlArgType(options?: gqlObjectOptions): any {
    return function (
      target: Function,
      _propertyKey: string,
      _descriptor: PropertyDescriptor,
    ): void {
      return GQLCapture.customGQLObject(target, GQLCapture.customArgs, options);
    };
  }

  static gqlInputObjectType(options?: gqlObjectOptions): any {
    return function (
      target: Function,
      _propertyKey: string,
      _descriptor: PropertyDescriptor,
    ): void {
      return GQLCapture.customGQLObject(
        target,
        GQLCapture.customInputObjects,
        options,
      );
    };
  }

  static gqlObjectType(options?: gqlObjectOptions): any {
    return function (
      target: Function,
      _propertyKey: string,
      _descriptor: PropertyDescriptor,
    ): void {
      return GQLCapture.customGQLObject(
        target,
        GQLCapture.customObjects,
        options,
      );
    };
  }

  private static customGQLObject(
    target: Function,
    map: Map<string, CustomObject>,
    options?: gqlObjectOptions,
  ) {
    if (!GQLCapture.isEnabled()) {
      return;
    }

    let className = target.name as string;
    let nodeName = options?.name || className;

    map.set(className, {
      className,
      nodeName,
      description: options?.description,
    });
  }

  // TODO query and mutation
  // we want to specify args if any, name, response if any
  static gqlQuery(options?: gqlTopLevelOptions): any {
    return function (
      target: Function,
      propertyKey: string,
      descriptor: PropertyDescriptor,
    ): void {
      if (!GQLCapture.isEnabled()) {
        return;
      }

      GQLCapture.customQueries.push(
        GQLCapture.getCustomField(target, propertyKey, descriptor, options),
      );
    };
  }
  // we want to specify inputs (required), name, response
  // input is via gqlArg
  // should it be gqlInputArg?
  static gqlMutation(options?: gqlTopLevelOptions): any {
    return function (
      target: Function,
      propertyKey: string,
      descriptor: PropertyDescriptor,
    ): void {
      if (!GQLCapture.isEnabled()) {
        return;
      }

      GQLCapture.customMutations.push(
        GQLCapture.getCustomField(target, propertyKey, descriptor, {
          ...options,
          allowFunctionType: true,
        }),
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
    objects.map((object) => baseObjects.set(object, true));
    this.customObjects.forEach((_val, key) => baseObjects.set(key, true));

    let baseArgs = new Map<string, boolean>();
    this.customArgs.forEach((_val, key) => baseArgs.set(key, true));
    this.customInputObjects.forEach((_val, key) => baseArgs.set(key, true));
    baseArgs.set("Context", true);
    this.customTypes.forEach((_val, key) => baseArgs.set(key, true));

    const resolveFields = (fields: CustomField[]) => {
      fields.forEach((field) => {
        // we have a check earlier that *should* make this path impossible
        field.args.forEach((arg) => {
          if (arg.needsResolving) {
            if (baseArgs.has(arg.type)) {
              arg.needsResolving = false;
            } else {
              throw new Error(
                `arg ${arg.name} of field ${field.functionName} needs resolving. should not be possible`,
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
            if (baseObjects.has(result.type)) {
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
export const gqlArg = GQLCapture.gqlArg;
export const gqlArgType = GQLCapture.gqlArgType;
export const gqlInputObjectType = GQLCapture.gqlInputObjectType;
export const gqlObjectType = GQLCapture.gqlObjectType;
export const gqlQuery = GQLCapture.gqlQuery;
export const gqlMutation = GQLCapture.gqlMutation;
export const gqlContextType = GQLCapture.gqlContextType;
export const gqlConnection = GQLCapture.gqlConnection;

// this requires the developer to npm-install "graphql-upload on their own"
const gqlFileUpload: CustomType = {
  type: "GraphQLUpload",
  importPath: "graphql-upload",
  tsType: "FileUpload",
  tsImportPath: "graphql-upload",
};

export { gqlFileUpload };
