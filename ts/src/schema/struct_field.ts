import { camelCase } from "camel-case";
import { snakeCase } from "snake-case";
import { BaseField, ListField } from "./field";
import {
  FieldOptions,
  Field,
  Type,
  DBType,
  FieldMap,
  getStorageKey,
} from "./schema";

export interface StructOptions extends FieldOptions {
  // required.
  // how does that jive with https://github.com/lolopinto/ent/issues/609 though??
  tsType: string;
  fields: FieldMap;
  // if not provided, defaults to tsType
  graphQLType?: string;
  jsonNotJSONB?: boolean;
}

interface allStructOptions extends StructOptions {
  jsonAsList?: boolean;
}

export class StructField extends BaseField implements Field {
  type: Type = {
    dbType: DBType.JSONB,
  };

  constructor(private options: allStructOptions) {
    super();
    this.type.subFields = options.fields;
    this.type.type = options.tsType;
    this.type.graphQLType = options.graphQLType || options.tsType;
    if (options.jsonNotJSONB) {
      this.type.dbType = DBType.JSON;
    }
    if (options?.jsonAsList) {
      this.type.listElemType = {
        dbType: DBType.JSONB,
      };
    }
  }

  formatImpl(obj: any, nested?: boolean) {
    if (!(obj instanceof Object)) {
      throw new Error("valid was not called");
    }
    let ret: Object = {};
    for (const k in this.options.fields) {
      const field = this.options.fields[k];

      // check two values

      // wait, two different things

      // getStoragetKey and getCamelCase()
      // for weird graphql case and for typescript format...

      // store in dbKey format

      // TODO more #510
      let dbKey = getStorageKey(field, k);
      let camelKey = camelCase(k);
      let val = obj[camelKey];

      if (val === undefined && obj[dbKey] !== undefined) {
        val = obj[dbKey];
      }

      if (val === undefined) {
        continue;
      }
      if (field.format) {
        // indicate nested so this isn't JSON stringified
        ret[dbKey] = field.format(val, true);
      } else {
        ret[dbKey] = val;
      }
    }
    // don't json.stringify if nested or list
    if (nested) {
      return ret;
    }
    return JSON.stringify(ret);
  }

  format(obj: any, nested?: boolean) {
    if (Array.isArray(obj) && this.options.jsonAsList) {
      const ret = obj.map((v) => this.formatImpl(v, true));
      if (nested) {
        return ret;
      }
      return JSON.stringify(ret);
    }
    return this.formatImpl(obj, nested);
  }

  private async validImpl(obj: any) {
    if (!(obj instanceof Object)) {
      return false;
    }

    let promises: (boolean | Promise<boolean>)[] = [];
    // TODO probably need to support optional fields...
    let valid = true;
    for (const k in this.options.fields) {
      const field = this.options.fields[k];
      // TODO more #510
      let dbKey = getStorageKey(field, k);
      let camelKey = camelCase(k);
      let val = obj[camelKey];

      if (val === undefined && obj[dbKey] !== undefined) {
        val = obj[dbKey];
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
    if (!valid) {
      return valid;
    }
    const ret = await Promise.all(promises);
    return ret.every((v) => v);
  }

  async valid(obj: any): Promise<boolean> {
    if (this.options.jsonAsList) {
      if (!Array.isArray(obj)) {
        return false;
      }
      const valid = await Promise.all(obj.map((v) => this.validImpl(v)));
      return valid.every((b) => b);
    }
    if (!(obj instanceof Object)) {
      return false;
    }

    return this.validImpl(obj);
  }
}

export function StructType(options: StructOptions) {
  let result = new StructField(options);
  return Object.assign(result, options);
}

/**
 * @deprecated use StructTypeAsList
 */
export function StructListType(options: StructOptions) {
  return new ListField(StructType(options), options);
}

export function StructTypeAsList(options: allStructOptions) {
  let result = new StructField({
    ...options,
    jsonAsList: true,
  });
  return Object.assign(result, options);
}
