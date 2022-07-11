import { BaseField, ListField } from "./field";
import { FieldOptions, Field, Type, DBType, FieldMap } from "./schema";
import { camelCase } from "camel-case";

export interface StructOptions extends FieldOptions {
  // required.
  // how does that jive with https://github.com/lolopinto/ent/issues/609 though??
  tsType: string;
  fields: FieldMap;
  // if not provided, defaults to tsType
  graphQLType?: string;
  jsonNotJSONB?: boolean;
}

export class StructField extends BaseField implements Field {
  type: Type = {
    dbType: DBType.JSONB,
  };

  constructor(private options: StructOptions) {
    super();
    this.type.subFields = options.fields;
    this.type.type = options.tsType;
    this.type.graphQLType = options.graphQLType || options.tsType;
    if (options.jsonNotJSONB) {
      this.type.dbType = DBType.JSON;
    }
  }

  // right now, we store things in the db in lowerCase format
  // this will lead to issues if field changes.
  // TODO: use storageKey and convert back...

  format(obj: any, nested?: boolean) {
    if (!(obj instanceof Object)) {
      throw new Error("valid was not called");
    }
    let ret: Object = {};
    for (const k in this.options.fields) {
      // TODO more #510
      let dbKey = camelCase(k);
      let val = obj[dbKey];
      // for tests with snake_case
      if (val === undefined && obj[k] !== undefined) {
        val = obj[k];
        dbKey = k;
      }

      if (val === undefined) {
        continue;
      }
      const field = this.options.fields[k];
      if (field.format) {
        // indicate nested so this isn't JSON stringified
        ret[dbKey] = field.format(val, true);
      } else {
        ret[dbKey] = val;
      }
    }
    // don't json.stringify if nested
    if (nested) {
      return ret;
    }
    return JSON.stringify(ret);
  }

  async valid(obj: any): Promise<boolean> {
    if (!(obj instanceof Object)) {
      return false;
    }

    let promises: (boolean | Promise<boolean>)[] = [];
    // TODO probably need to support optional fields...
    let valid = true;
    for (const k in this.options.fields) {
      const field = this.options.fields[k];
      // TODO more #510
      let dbKey = camelCase(k);
      let val = obj[dbKey];
      // for tests with snake_case
      if (val === undefined && obj[k] !== undefined) {
        val = obj[k];
        dbKey = k;
      }

      if (val === undefined || val === null) {
        // nullable, nothing to do here
        if (field.nullable) {
          continue;
        }
        valid = false;
        break;
      }
      if (!field.valid) {
        continue;
      }
      promises.push(field.valid(val));
    }
    for (const k in obj) {
      // extra undefined fields are invalid
      if (this.options.fields[k] === undefined) {
        return false;
      }
    }
    if (!valid) {
      return valid;
    }
    const ret = await Promise.all(promises);
    return ret.every((v) => v);
  }
}

export function StructType(options: StructOptions) {
  let result = new StructField(options);
  return Object.assign(result, options);
}

export function StructListType(options: StructOptions) {
  return new ListField(StructType(options), options);
}
