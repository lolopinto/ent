import { StructField } from "./struct_field";
import { FieldOptions, DBType, Type } from "./schema";
import { BaseField, ListField } from "./field";

export declare type StructMap = {
  [key: string]: StructField;
};

// used to know which key in the union is valid.
// maybe there's a better way of doing this eventually
const KEY = "___valid___key___";

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

interface validResult {
  valid: boolean;
  key: string;
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

  format(obj: any) {
    if (!(obj instanceof Object)) {
      throw new Error("valid was not called");
    }
    const k = obj[KEY];
    if (k === undefined) {
      throw new Error(`need to call valid first`);
    }

    const field = this.options.fields[k];
    // always nested for now so pass through
    return field.format(obj, true);
  }

  private async validField(k: string, f: StructField, obj: Object) {
    const valid = await f.valid(obj);
    return {
      valid,
      key: k,
    };
  }

  async valid(obj: any): Promise<boolean> {
    if (!(obj instanceof Object)) {
      return false;
    }
    let promises: Promise<validResult>[] = [];

    for (const k in this.options.fields) {
      const field = this.options.fields[k];
      promises.push(this.validField(k, field, obj));
    }
    let lastKey: string | undefined;
    let validCt = 0;
    const ret = await Promise.all(promises);
    for (const v of ret) {
      if (v.valid) {
        validCt++;
        lastKey = v.key;
      }
    }
    if (lastKey !== undefined) {
      obj[KEY] = lastKey;
    }

    return validCt == 1;
  }
}

export function UnionType(options: UnionOptions) {
  let result = new UnionField(options);
  return Object.assign(result, options);
}

export function UnionListType(options: UnionOptions) {
  return new ListField(UnionType(options), options);
}
