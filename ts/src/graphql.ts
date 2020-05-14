import "reflect-metadata";
import { GraphQLScalarType } from "graphql";

type Type = GraphQLScalarType;

export interface gqlFieldOptions {
  name?: string;
  nullable?: boolean;
  description?: string;
  type?: Type; // only scalars allowed for now
}

export interface CustomField {
  nodeName: string;
  gqlName: string;
  functionName: string; // accessorName (not necessarily a function)
  // need enum type for accessor/function/etc so we can build generated code
  args: Field[];
  results: Field[];
  importPath?: string;
}

export interface CustomArg {
  nodeName: string;
  className: string; // TODO both the same right now...
}

export interface Field {
  name: string;
  type: string; // TODO
  importPath?: string;
  needsResolving?: boolean; // unknown type that we need to resolve eventually
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
  private static customArgs: CustomArg[] = [];

  static getCustomFields(): CustomField[] {
    return this.customFields;
  }

  static getCustomArgs(): CustomArg[] {
    return this.customArgs;
  }

  static clear(): void {
    this.customFields = [];
    this.customArgs = [];
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
    if (options?.type) {
      type = options.type.name;
    }
    if (GQLCapture.knownDisAllowedNames.has(type)) {
      throw new Error(
        `${type} isn't a valid type for accessor/function/property`,
      );
    }

    let result: Field = {
      name: metadata.paramName || "",
      type,
    };
    // unknown type. we need to flag that this field needs to eventually be resolved
    if (!GQLCapture.knownAllowedNames.has(type)) {
      result.needsResolving = true;
    }
    return result;
  }

  static gqlField(options?: gqlFieldOptions): any {
    return function(
      target,
      propertyKey: string,
      descriptor: PropertyDescriptor,
    ): void {
      if (!GQLCapture.isEnabled()) {
        return;
      }

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
        //        console.log("return type");
        results.push(
          GQLCapture.getResultFromMetadata(returnTypeMetadata, options),
        );
      } else if (typeMetadata) {
        // console.log("type");
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
        gqlName: propertyKey,
        functionName: propertyKey,
        args: args,
        results: results,
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
      let className = target.name as string;
      let nodeName = options?.name || className;

      GQLCapture.customArgs.push({
        className,
        nodeName,
      });
    };
  }
}

export const gqlField = GQLCapture.gqlField;
export const gqlArg = GQLCapture.gqlArg;
export const gqlArgType = GQLCapture.gqlArgType;
