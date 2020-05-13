// TODO options...
import "reflect-metadata";
import { GraphQLScalarType } from "graphql";

type Type = GraphQLScalarType;

export interface gqlFieldOptions {
  name?: string;
  nullable?: boolean;
  description?: string;
  type?: Type; // only scalars allowed for now
}

export interface Func {
  nodeName: string;
  gqlName: string;
  functionName: string;
  args: Field[];
  results: Field[];
  importPath?: string;
}

export interface Field {
  name: string;
  type: string; // TODO
  importPath?: string;
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

  private static customFns: Func[] = [];

  static getCustomFns(): Func[] {
    return this.customFns;
  }

  static clear(): void {
    this.customFns = [];
  }

  private static getResultFromMetadata(
    metadata: metadataIsh,
    options?: gqlFieldOptions,
  ): Field {
    console.log(metadata);
    let type = metadata.name;
    if ((type === "Number" || type === "Object") && !options?.type) {
      throw new Error(
        "type is required when accessor/function/property returns a number",
      );
    }
    if (options?.type) {
      type = options.type.name;
    }

    return {
      name: metadata.paramName || "",
      type,
    };
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
      // console.log("metadata", typeMetadata);
      // console.log("descriptor", descriptor);

      //      console.log(typeMetadata, returnTypeMetadata);
      // property...
      if (returnTypeMetadata) {
        console.log("return type");
        results.push(
          GQLCapture.getResultFromMetadata(returnTypeMetadata, options),
        );
      } else if (typeMetadata) {
        console.log("type");
        results.push(GQLCapture.getResultFromMetadata(typeMetadata, options));
      }

      //console.log("target", target); // User {}
      //console.log("propertyKey", propertyKey); // fullName...
      //      console.log("descriptor", descriptor);
      // [Function: Object] when implied
      // [Function: String] when explicit

      //    console.log("displayName", metadata.displayName);
      // let metadata2 = Reflect.getMetadata(
      //   "design:returntype",
      //   target,
      //   propertyKey,
      // );
      // console.log("return type", metadata2);
      // //  console.log("displayName", metadata2?.displayName);
      // console.log("name", metadata2?.name);
      let params: metadataIsh[] | null = Reflect.getMetadata(
        "design:paramtypes",
        target,
        propertyKey,
      );

      if (params && params.length > 0) {
        console.log("params");
        let parsedArgs =
          GQLCapture.argMap.get(nodeName)?.get(propertyKey) || [];
        if (params.length !== parsedArgs.length) {
          throw new Error("args were not captured correctly");
        }
        parsedArgs.forEach((arg) => {
          let param = params![arg.index];
          console.log("param", param);
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

        //        console.log(args);
      }

      //      Reflect.defineMetadata;
      GQLCapture.customFns.push({
        nodeName: nodeName,
        gqlName: propertyKey,
        functionName: propertyKey,
        args: args,
        results: results,
      });
      // TODO have all I need for simple types
      // testing them and making sure it works
      // and we save this
      // time for some tests...

      //    console.log("metadata2", Reflect.getOwnMetadata("design:type", target, propertyKey));
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

      console.log("arg", name, target, propertyKey, index);
    };
  }
}

export const gqlField = GQLCapture.gqlField;
export const gqlArg = GQLCapture.gqlArg;
