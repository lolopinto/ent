import "reflect-metadata";
import { GraphQLScalarType } from "graphql";

interface ClassType<T = any> {
  new (...args: any[]): T;
}

// scalars or classes
type Type = GraphQLScalarType | ClassType;

type ReturnType = Type | Array<Type>;

type ReturnTypeFunc = (returns?: void) => ReturnType;

// TODO lists/ nullables (list nullables) /etc
export interface gqlFieldOptions {
  name?: string;
  nullable?: boolean | NullableListOptions;
  description?: string;
  type?: Type | Array<Type>; // types or lists of types
}

export enum CustomFieldType {
  Accessor = "ACCESSOR",
  Field = "FIELD", // or property
  Function = "FUNCTION",
  AsyncFunction = "ASYNC_FUNCTION", // do we care about this?
}

export interface CustomField {
  nodeName: string;
  gqlName: string;
  functionName: string; // accessorName (not necessarily a function)
  // need enum type for accessor/function/etc so we can build generated code
  args: Field[];
  results: Field[];
  importPath?: string;
  fieldType: CustomFieldType;
  description?: string;
}

export interface CustomArg {
  nodeName: string;
  className: string; // TODO both the same right now...
}

type NullableListOptions = "contents" | "contentsAndList";

export interface Field {
  name: string;
  type: string; // TODO
  importPath?: string;
  needsResolving?: boolean; // unknown type that we need to resolve eventually

  // if a list and nullable
  // list itself is nullable
  // if a list and items are nullable, list is not nullable but list contains nullable items
  // if a list and both are nullable, both contents and list itself nullable
  nullable?: boolean | NullableListOptions;
  list?: boolean;
}

interface arg {
  name: string;
  index: number;
  options?: gqlFieldOptions;
}

interface metadataIsh {
  name: string; // the type
  paramName?: string;
}

export class GQLCapture {
  private static enabled = false;

  static enable(enabled: boolean) {
    this.enabled = enabled;
  }

  static isEnabled(): boolean {
    return this.enabled;
  }

  private static customFields: CustomField[] = [];
  private static customArgs: Map<string, CustomArg> = new Map();

  static getCustomFields(): CustomField[] {
    return this.customFields;
  }

  static getCustomArgs(): Map<string, CustomArg> {
    return this.customArgs;
  }

  static clear(): void {
    this.customFields = [];
    this.customArgs.clear();
  }

  private static knownAllowedNames: Map<string, boolean> = new Map([
    ["Date", true],
    ["Boolean", true],
    ["Number", true],
    ["String", true],
    // TODO not right to have this and Number
    ["Int", true],
    ["Float", true],
  ]);

  private static knownDisAllowedNames: Map<string, boolean> = new Map([
    ["Function", true],
    ["Object", true],
    ["Array", true],
    ["Promise", true],
  ]);

  private static getResultFromMetadata(
    metadata: metadataIsh,
    options?: gqlFieldOptions,
  ): Field {
    let type = metadata.name;
    if ((type === "Number" || type === "Object") && !options?.type) {
      throw new Error(
        "type is required when accessor/function/property returns a number",
      );
    }

    const isArray = (type: Type | Array<Type>): type is Array<Type> => {
      if (typeof type === "function") {
        return false;
      }
      return (type as Array<Type>).length !== undefined;
    };
    let list: boolean | undefined;

    if (options?.type) {
      if (isArray(options.type)) {
        list = true;
        console.log(options);
        type = options.type[0].name;
      } else {
        type = options.type.name;
      }
    }
    if (GQLCapture.knownDisAllowedNames.has(type)) {
      throw new Error(
        `${type} isn't a valid type for accessor/function/property`,
      );
    }

    let result: Field = {
      name: metadata.paramName || "",
      type,
      nullable: options?.nullable,
      list: list,
    };
    // unknown type. we need to flag that this field needs to eventually be resolved
    if (!GQLCapture.knownAllowedNames.has(type)) {
      result.needsResolving = true;
    }
    return result;
  }

  private static isType(
    typeOrOptions?: ReturnTypeFunc | gqlFieldOptions,
  ): typeOrOptions is ReturnTypeFunc {
    if (typeof typeOrOptions === "function") {
      return true;
    }
    if (typeOrOptions?.description !== undefined) {
      return true;
    }
    return false;
  }

  static gqlField(): any;
  static gqlField(type?: ReturnTypeFunc, options?: gqlFieldOptions): any;
  static gqlField(options?: gqlFieldOptions): any;
  static gqlField(
    typeOrOptions?: ReturnTypeFunc | gqlFieldOptions,
    maybeOptions?: gqlFieldOptions,
  ): any {
    return function(
      target,
      propertyKey: string,
      descriptor: PropertyDescriptor,
    ): void {
      if (!GQLCapture.isEnabled()) {
        return;
      }
      let typ: ReturnTypeFunc | undefined;
      let options: gqlFieldOptions | undefined;
      if (typeOrOptions !== undefined) {
        if (GQLCapture.isType(typeOrOptions)) {
          options = maybeOptions || {};
          typ = typeOrOptions;
        } else {
          options = typeOrOptions || {};
        }
      }
      if (typ) {
        let foo = typ();
        console.log(typeof typ);
        console.log("foo", foo);
        // console.log(typ.constructor);
        // console.log(typ.constructor.name);

        console.log(typ.name);
        console.log("ss", Reflect.getMetadata("design:type", typ));
        console.log("tt", Reflect.getMetadata("design:returntype", typ));
      }
      //    console.log(typ?.name, options);
      //      console.log(target, propertyKey, descriptor);
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
      console.log(typeMetadata, returnTypeMetadata);

      if (returnTypeMetadata) {
        console.log(returnTypeMetadata);
        // function...
        if (returnTypeMetadata.name === "Promise") {
          fieldType = CustomFieldType.AsyncFunction;
        } else {
          fieldType = CustomFieldType.Function;
        }
        //console.log("return type", returnTypeMetadata.name);

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

        //        console.log("type");
        results.push(GQLCapture.getResultFromMetadata(typeMetadata, options));
      }

      let params: metadataIsh[] | null = Reflect.getMetadata(
        "design:paramtypes",
        target,
        propertyKey,
      );

      if (params && params.length > 0) {
        let parsedArgs =
          GQLCapture.argMap.get(nodeName)?.get(propertyKey) || [];
        if (params.length !== parsedArgs.length) {
          // console.log(params, parsedArgs);
          throw new Error("args were not captured correctly");
        }
        parsedArgs.forEach((arg) => {
          let param = params![arg.index];
          //          console.log("param", param);
          let paramName = arg.name;
          let field = GQLCapture.getResultFromMetadata(
            {
              name: param.name,
              paramName,
            },
            arg.options,
          );

          // TODO this may not be the right order...
          args.push(field);
        });
        // TODO this is deterministically (so far) coming in reverse order so reverse (for now)
        args = args.reverse();
      }

      //      console.log(nodeName, propertyKey, results);
      GQLCapture.customFields.push({
        nodeName: nodeName,
        gqlName: options?.name || propertyKey,
        functionName: propertyKey,
        args: args,
        results: results,
        fieldType: fieldType!,
        description: options?.description,
      });
    };
  }

  // User -> add -> [{name, options}, {}, {}]
  private static argMap: Map<string, Map<string, arg[]>> = new Map();

  // TODO custom args because for example name doesn't make sense here.
  static gqlArg(name: string, options?: gqlFieldOptions): any {
    return function(
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
      });

      //      console.log("arg", name, target, propertyKey, index);
    };
  }

  // TODO provide different options
  static gqlArgType(options?: gqlFieldOptions): any {
    return function(
      target: Function,
      _propertyKey: string,
      _descriptor: PropertyDescriptor,
    ): void {
      if (!GQLCapture.isEnabled()) {
        return;
      }
      let className = target.name as string;
      let nodeName = options?.name || className;

      GQLCapture.customArgs.set(className, {
        className,
        nodeName,
      });
    };
  }

  static resolve(objects: string[]): void {
    let baseEnts = new Map<string, boolean>();
    objects.map((object) => baseEnts.set(object, true));

    GQLCapture.customFields.forEach((field) => {
      // we have a check earlier that *should* make this path impossible
      field.args.forEach((arg) => {
        if (arg.needsResolving) {
          throw new Error(
            `arg ${arg.name} of field ${field.functionName} needs resolving. should not be possible`,
          );
        }
      });
      // fields are not because we can return existing ents and we want to run the capturing
      // in parallel with the codegen gathering step so we resolve at the end to make
      // sure there's no dangling objects
      // TODO when we have other objects, we may need to change the logic here
      // but i don't think it applies
      field.results.forEach((result) => {
        if (result.needsResolving) {
          if (baseEnts.get(result.type)) {
            result.needsResolving = false;
          } else {
            throw new Error(
              `field ${field.functionName} references ${result.type} which isn't a graphql object`,
            );
          }
        }
      });
    });
  }
}

export const gqlField = GQLCapture.gqlField;
export const gqlArg = GQLCapture.gqlArg;
export const gqlArgType = GQLCapture.gqlArgType;
