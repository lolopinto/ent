import { StructField } from "./struct_field";
import { FieldOptions, DBType, Type } from "./schema";
import { BaseField, ListField } from "./field";

export declare type StructMap = {
  [key: string]: StructField;
};

export interface UnionOptions extends FieldOptions {
  // required.
  // how does that jive with https://github.com/lolopinto/ent/issues/609 though??
  tsType: string;
  // StructMap enforced in TS here but FieldMap in Type
  // we want keys because of GraphQL oneOf type
  fields: StructMap;
  // if not provided, defaults to tsType
  graphQLType?: string;
  jsonNotJSONB?: boolean;
}

export class UnionField extends BaseField implements FieldOptions {
  type: Type = {
    dbType: DBType.JSONB,
  };
  m: Map<Object, string> = new Map();

  constructor(private options: UnionOptions) {
    super();
    this.type.unionFields = options.fields;
    this.type.type = options.tsType;
    this.type.graphQLType = options.graphQLType || options.tsType;
    // TODO should throw if not nested?
    if (options.jsonNotJSONB) {
      this.type.dbType = DBType.JSON;
    }
  }

  format(obj: any, nested?: boolean) {
    if (!(obj instanceof Object)) {
      throw new Error("valid was not called");
    }
    for (const k in this.options.fields) {
      const field = this.options.fields[k];
      const fmt = field.format(obj, nested);
      if (fmt !== "{}") {
        return fmt;
      }
    }
    // TODO need better logic here
    // maybe add something ignored to the objec that indicates which key?
    // or store in map
    throw new Error(`couldn't format union`);
  }

  async valid(obj: any): Promise<boolean> {
    if (!(obj instanceof Object)) {
      return false;
    }
    let promises: Promise<boolean>[] = [];

    for (const k in this.options.fields) {
      const field = this.options.fields[k];
      promises.push(field.valid(obj));
    }
    const ret = await Promise.all(promises);
    // only 1 should be valid
    return ret.filter((v) => v).length === 1;
  }
}

export function UnionType(options: UnionOptions) {
  let result = new UnionField(options);
  return Object.assign(result, options);
}

export function UnionListType(options: UnionOptions) {
  return new ListField(UnionType(options), options);
}
