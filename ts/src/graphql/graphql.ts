// TODO delete
import "reflect-metadata";
import { GraphQLScalarType } from "graphql";
import { Data } from "../core/base";

interface ClassType<T = any> {
  new (...args: any[]): T;
}

declare type StringToStringMap = {
  [key: string]: string;
};

export interface CustomType {
  type: string;
  importPath: string;
  tsType?: string;
  tsImportPath?: string;
  enumMap?: StringToStringMap;
  inputType?: boolean;
  [x: string]: any;
}

// scalars or classes
// string for GraphQL name in situation where we can't load the object
// e.g. User, Contact etc
// CustomType for types that are not in "graphql" and we need to know where to load it from...
type Type = GraphQLScalarType | ClassType | string | CustomType;

// node in a connection
export type GraphQLConnection<T> = { node: T };

// TODO replace and deprecate
export interface gqlFieldOptions {
  name?: string;
  nullable?: boolean | NullableListOptions;
  description?: string;
  type?: Type | Array<Type> | GraphQLConnection<Type>; // types or lists of types
}

interface gqlFieldOptions2Basics {
  name?: string;
  nullable?: boolean | NullableListOptions;
  description?: string;
  // TODO this is probably required now...
  type?: Type | Array<Type> | GraphQLConnection<Type>; // types or lists of types
}

interface gqlFieldArg extends gqlFieldOptions2Basics {
  isContextArg?: boolean;
}

export interface gqlFieldOptions2 extends gqlFieldOptions2Basics {
  nodeName: string;

  args?: gqlFieldOptions2Basics[];
  result?: Field;
  // defaults to Function if not provided
  // fieldType?: CustomFieldType;
  async?: boolean;
}

interface fieldOptions extends gqlFieldOptions {
  // implies no return type...
  allowFunctionType?: boolean;
}

export interface gqlObjectOptions {
  name?: string;
  description?: string;
}

type gqlTopLevelOptions = Exclude<gqlFieldOptions2, "nullable" | "type"> & {
  args?: gqlFieldArg[];
};

// export interface gqlTopLevelOptions
//   name?: string;
//   type?: Type | Array<Type>;
//   description?: string;
// }

export enum CustomFieldType {
  Accessor = "ACCESSOR",
  Field = "FIELD",
  Function = "FUNCTION",
  AsyncFunction = "ASYNC_FUNCTION",
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
  extraImports?: any[]; // defined on server
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

export const knownAllowedNames: Map<string, string> = new Map([
  ["Date", "Date"],
  ["Boolean", "boolean"],
  ["Number", "number"],
  ["String", "string"],
  // TODO not right to have this and Number
  ["Int", "number"],
  ["Float", "number"],
  ["ID", "ID"],
]);

export const knownDisAllowedNames: Map<string, boolean> = new Map([
  ["Function", true],
  ["Object", true],
  ["Array", true],
  ["Promise", true],
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

export const isCustomType = (type: Type): type is CustomType => {
  return (type as CustomType).importPath !== undefined;
};

const isGraphQLScalarType = (type: Type): type is GraphQLScalarType => {
  return (type as GraphQLScalarType).serialize !== undefined;
};

export const addCustomType = (
  type: CustomType,
  gqlCapture: typeof GQLCapture,
) => {
  // TODO these should return ReadOnly objects...
  const customTypes = gqlCapture.getCustomTypes();
  const customType = customTypes.get(type.type);

  if (customType && customType === type) {
    return;
  }

  if (type.enumMap) {
    customTypes.set(type.type, type);
    return;
  }
  try {
    const r = require(type.importPath);
    const ct = r[type.type];
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
      addCustomType(
        {
          ...type,
          importPath: type.secondaryImportPath,
        },
        gqlCapture,
      );
    }
    return;
  }

  if (customType) {
    if (JSON.stringify(customType) !== JSON.stringify(type)) {
      throw new Error(`cannot add multiple custom types of name ${type.type}`);
    }
    return;
  }
  customTypes.set(type.type, type);
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
    // TODO???
    addCustomType(typ, GQLCapture);
    return;
  }
  // GraphQLScalarType or ClassType
  result.scalarType = isGraphQLScalarType(typ);
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

    if (knownDisAllowedNames.has(type)) {
      throw new Error(
        `${type} isn't a valid type for accessor/function/property`,
      );
    }

    let result: Field = {
      name: metadata.paramName || "",
      type,
      tsType: knownAllowedNames.get(type) || this.customTypes.get(type)?.tsType,
      nullable: options?.nullable,
      list: list,
      connection: connection,
      isContextArg: metadata.isContextArg,
    };
    // unknown type. we need to flag that this field needs to eventually be resolved
    if (!knownAllowedNames.has(type)) {
      if (scalarType) {
        throw new Error(
          `custom scalar type ${type} is not supported this way. use CustomType syntax. see \`gqlFileUpload\` as an example`,
        );
      }
      result.needsResolving = true;
    }
    return result;
  }

  // TODO rename
  private static getResultFromMetadata2(
    // target: Function,
    // metadata: metadataIsh,
    // options?: gqlFieldOptions2,
    // field?: Field,
    field: gqlFieldOptions2Basics | gqlFieldArg,
  ): Field {
    // let type = metadata.name;
    // if ((type === "Number" || type === "Object") && !options?.type) {
    //   throw new Error(
    //     `type is required when accessor/function/property returns a ${type}`,
    //   );
    // }

    let list: boolean | undefined;
    let scalarType = false;
    let connection: boolean | undefined;
    let type = "";

    if (field?.type) {
      let r: typeInfo = { type: "" };
      getType(field.type, r);
      list = r.list;
      scalarType = r.scalarType || false;
      connection = r.connection;
      type = r.type;
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
      tsType: knownAllowedNames.get(type) || this.customTypes.get(type)?.tsType,
      nullable: field?.nullable,
      list: list,
      connection: connection,
      // @ts-ignore
      isContextArg: field?.isContextArg,
    };

    // unknown type. we need to flag that this field needs to eventually be resolved
    if (!knownAllowedNames.has(type)) {
      if (scalarType) {
        throw new Error(
          `custom scalar type ${type} is not supported this way. use CustomType syntax. see \`gqlFileUpload\` as an example`,
        );
      }
      result.needsResolving = true;
    }
    return result;
  }

  // ToDO this doesn't work...
  static gqlObjectWithFields() {
    return function (val, ctx: ClassDecoratorContext) {
      if (!GQLCapture.isEnabled() || ctx.kind !== "class") {
        return;
      }
      ctx.addInitializer(function () {
        // console.log("initializer");
      });
      // console.log("gsfsf", val.prototype, ctx);

      // let typeMetadata: metadataIsh | null = Reflect.getMetadata(
      //   "design:type",
      //   val.prototype,
      //   "username",
      //   // "method",
      //   // ctx.name,
      // );

      // let returnTypeMetadata: metadataIsh | null = Reflect.getMetadata(
      //   "design:returntype",
      //   val.prototype,
      //   "username",
      //   // "method",
      //   // ctx.name,
      // );
      // console.log(val, val.prototype);
    };
  }
  static gqlField(options: gqlFieldOptions2): any {
    // hah, arguments change in 2.0
    return function (
      target: any,
      ctx:
        | ClassMethodDecoratorContext
        | ClassFieldDecoratorContext
        | ClassGetterDecoratorContext,
    ) {
      // console.log(ctx.kind);
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

      // ok, have to specify the type info
      // CANNOT get the name of the class without some magic or instantiating...

      // console.log(target, ctx.access.get(target));
      // for (const k in target) {
      //   console.log("prop", k, target[k]);
      // }

      ctx.addInitializer(function () {
        console.log("function initializer");
        // @ts-ignore
        if (!this.collectedMethodKeys) {
          // @ts-ignore
          this.collectedMethodKeys = new Set();
        }
        // @ts-ignore
        this.collectedMethodKeys.add(ctx.name);

        // this in here is the class instance
        console.log(this);
        console.log(target, ctx.access.get(this));
      });

      // console.log(
      //   originalMethod,
      //   "propertyKey",
      //   propertyKey,
      //   "descriptior",
      //   descriptor,
      // );

      // this isn't helpful because we don't have access to ars...
      // return function (this: any, ...args: any[]) {
      //   console.log("gqlField", originalMethod, ctx, args);
      //   return originalMethod.call(this, args);
      // };

      // console.log(
      //   "enabled",
      //   // originalMethod.arguments,
      //   // typeof originalMethod,
      //   // ctx.name,
      //   // ctx.kind,
      //   // typeMetadata,
      //   // returnTypeMetadata,
      // );
      let customField = GQLCapture.getCustomField2(
        ctx,
        options,
        // propertyKey,
        // descriptor,
        // options,
      );
      // console.log(customField);
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
    target: any,
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

  private static getCustomField2(
    ctx:
      | ClassMethodDecoratorContext
      | ClassFieldDecoratorContext
      | ClassGetterDecoratorContext,
    options: gqlFieldOptions2,
    allowNoReturnType?: boolean,
    // propertyKey: string,
    // descriptor: PropertyDescriptor,
    // options?: fieldOptions,
  ): CustomField {
    let fieldType: CustomFieldType;
    // let nodeName = target.constructor.name as string;

    let args: Field[] = [];
    let results: Field[] = [];

    // let typeMetadata: metadataIsh | null = Reflect.getMetadata(
    //   "design:type",
    //   target,
    //   propertyKey,
    // );
    // let returnTypeMetadata: metadataIsh | null = Reflect.getMetadata(
    //   "design:returntype",
    //   target,
    //   propertyKey,
    // );

    // TODO other types
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

    if (options.type) {
      // override name property passed down so we return '' as name
      results.push(GQLCapture.getResultFromMetadata2({ ...options, name: "" }));
    }

    // if (returnTypeMetadata) {
    //   // function...
    //   if (returnTypeMetadata.name === "Promise") {
    //     fieldType = CustomFieldType.AsyncFunction;
    //   } else {
    //     fieldType = CustomFieldType.Function;
    //   }

    //   results.push(
    //     GQLCapture.getResultFromMetadata(returnTypeMetadata, options),
    //   );
    // } else if (typeMetadata) {
    //   if (descriptor && descriptor.get) {
    //     fieldType = CustomFieldType.Accessor;
    //   } else if (descriptor && descriptor.value) {
    //     // could be implicit async
    //     fieldType = CustomFieldType.Function;
    //   } else {
    //     fieldType = CustomFieldType.Field;
    //   }

    //   if (
    //     !(
    //       options?.allowFunctionType &&
    //       fieldType === CustomFieldType.Function &&
    //       typeMetadata.name === "Function"
    //     )
    //   ) {
    //     results.push(GQLCapture.getResultFromMetadata(typeMetadata, options));
    //   }
    // }

    // let params: metadataIsh[] | null = Reflect.getMetadata(
    //   "design:paramtypes",
    //   target,
    //   propertyKey,
    // );

    if (options.args && options.args.length) {
      options.args.forEach((arg) => {
        args.push(GQLCapture.getResultFromMetadata2(arg));
      });
    }
    // no args for now
    // if (params && params.length > 0) {
    //   let parsedArgs = GQLCapture.argMap.get(nodeName)?.get(propertyKey) || [];
    //   if (params.length !== parsedArgs.length) {
    //     throw new Error(
    //       `args were not captured correctly, ${params.length}, ${parsedArgs.length}`,
    //     );
    //   }
    //   parsedArgs.forEach((arg) => {
    //     let param = params![arg.index];
    //     let paramName = arg.name;
    //     let field = GQLCapture.getResultFromMetadata(
    //       {
    //         name: param.name,
    //         paramName,
    //         isContextArg: arg.isContextArg,
    //       },
    //       arg.options,
    //     );

    //     // TODO this may not be the right order...
    //     args.push(field);
    //   });
    // TODO this is deterministically (so far) coming in reverse order so reverse (for now)
    // args = args.reverse();
    // }

    return {
      nodeName: options.nodeName,
      gqlName: options?.name || ctx.name.toString(),
      functionName: ctx.name.toString(),
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
      target: any,
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

  static gqlObjectType(options?: gqlObjectOptions): any {
    return function (target: any, ctx: ClassDecoratorContext): void {
      return GQLCapture.customGQLObject(ctx, GQLCapture.customObjects, options);
    };
  }

  private static customGQLObject(
    ctx: ClassDecoratorContext,
    map: Map<string, CustomObject>,
    options?: gqlObjectOptions,
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
    });
  }

  // TODO query and mutation
  // we want to specify args if any, name, response if any
  static gqlQuery(options: gqlTopLevelOptions): any {
    return function (target: Function, ctx: ClassMethodDecoratorContext): void {
      if (!GQLCapture.isEnabled()) {
        return;
      }

      GQLCapture.customQueries.push(GQLCapture.getCustomField2(ctx, options));
    };
  }
  // we want to specify inputs (required), name, response
  // input is via gqlArg
  // should it be gqlInputArg?

  // type optional for this one
  // but not gqlField...
  static gqlMutation(options: gqlTopLevelOptions): any {
    return function (target: Function, ctx: ClassMethodDecoratorContext): void {
      if (!GQLCapture.isEnabled()) {
        return;
      }

      // TODO allowFunctionType: true...
      GQLCapture.customMutations.push(
        GQLCapture.getCustomField2(ctx, options, true),
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

    // TODO this should be aware of knownCustomTypes
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

// TODO kill
export const gqlArg = GQLCapture.gqlArg;

export const gqlArgType = GQLCapture.gqlArgType;
export const gqlInputObjectType = GQLCapture.gqlInputObjectType;
export const gqlObjectType = GQLCapture.gqlObjectType;
export const gqlQuery = GQLCapture.gqlQuery;
export const gqlMutation = GQLCapture.gqlMutation;
export const gqlContextType = GQLCapture.gqlContextType;
export const gqlConnection = GQLCapture.gqlConnection;
export const gqlObjectWithFields = GQLCapture.gqlObjectWithFields;

// this requires the developer to npm-install "graphql-upload on their own"
const gqlFileUpload: CustomType = {
  type: "GraphQLUpload",
  importPath: "graphql-upload",
  tsType: "FileUpload",
  tsImportPath: "graphql-upload",
};

export { gqlFileUpload };
