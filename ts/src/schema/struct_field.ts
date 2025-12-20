import { BaseField, ListField } from "./field";
import {
  FieldOptions,
  Field,
  Type,
  DBType,
  FieldMap,
  getStorageKey,
} from "./schema";
import {
  __getGlobalSchemaField,
  __getGlobalSchemaFields,
} from "../core/global_schema";
import { log } from "../core/logger";
import { toFieldName } from "../names/names";

interface structFieldOptions extends FieldOptions {
  // required.
  // how does that jive with https://github.com/lolopinto/ent/issues/609 though??
  tsType: string;
  fields: FieldMap;
  // if not provided, defaults to tsType
  graphQLType?: string;
  jsonNotJSONB?: boolean;
}

interface structFieldListOptions extends structFieldOptions {
  validateUniqueKey?: string;
}

interface GlobalStructOptions extends FieldOptions {
  globalType: string;
}

export type StructOptions =
  | structFieldOptions
  | GlobalStructOptions
  | structFieldListOptions;

export class StructField extends BaseField implements Field {
  type: Type = {
    dbType: DBType.JSONB,
  };

  private validateUniqueKey?: string | undefined;
  private checkUniqueKey: boolean;

  constructor(
    private options: StructOptions,
    private jsonAsList?: boolean,
  ) {
    super();
    this.type.subFields = options.fields;
    this.type.type = options.tsType;
    this.type.graphQLType = options.graphQLType || options.tsType;
    this.type.globalType = this.options.globalType;
    if (options.jsonNotJSONB) {
      this.type.dbType = DBType.JSON;
    }
    if (jsonAsList) {
      this.type.listElemType = {
        dbType: DBType.JSONB,
      };
    }
    if (options.validateUniqueKey) {
      this.validateUniqueKey = options.validateUniqueKey;
      this.checkUniqueKey = true;
    }
  }

  formatImpl(obj: any, nested?: boolean) {
    if (!(obj instanceof Object)) {
      throw new Error("valid was not called");
    }
    let ret: Object = {};

    const processField = (k: string, field: Field) => {
      // check two values
      // store in dbKey format

      // check both fieldName and dbKey and store in dbKey for
      // serialization to db
      // we should only have if it in fieldName format for non-tests
      // but checking for backwards compatibility and to make
      // sure we don't break anything
      let dbKey = getStorageKey(field, k);
      let fieldName = toFieldName(k);
      let val = obj[fieldName];

      if (val === undefined && obj[dbKey] !== undefined) {
        val = obj[dbKey];
      }

      if (val === undefined) {
        return;
      }
      if (field.format) {
        // indicate nested so this isn't JSON stringified
        ret[dbKey] = field.format(val, true);
      } else {
        ret[dbKey] = val;
      }
    };

    for (const k in this.options.fields) {
      const field = this.options.fields[k];

      processField(k, field);

      if (field.getDerivedFields) {
        const derivedFields = field.getDerivedFields(k);
        for (const k in derivedFields) {
          processField(k, derivedFields[k]);
        }
      }
    }
    // don't json.stringify if nested or list
    if (nested) {
      return ret;
    }
    return JSON.stringify(ret);
  }

  format(obj: any, nested?: boolean) {
    if (this.type.globalType) {
      const f = __getGlobalSchemaField(this.type.globalType);
      if (f && f.format) {
        if (
          JSON.stringify(this.type.listElemType) !==
          JSON.stringify(f?.type.listElemType)
        ) {
          if (this.jsonAsList) {
            // handle as nested
            // @ts-ignore
            const formatted = obj.map((v: any) => f.format(v, true));
            if (nested) {
              return formatted;
            } else {
              return JSON.stringify(formatted);
            }
          } else {
            const formatted = f.format([obj], true);
            if (nested) {
              return formatted[0];
            } else {
              return JSON.stringify(formatted[0]);
            }
          }
        }

        // TODO handle format code
        // ola 1/20/24 don't know what this TODO means lol
        return f.format(obj, nested);
      }
    }
    if (Array.isArray(obj) && this.jsonAsList) {
      const ret = obj.map((v) => this.formatImpl(v, true));
      if (nested) {
        return ret;
      }
      return JSON.stringify(ret);
    }
    return this.formatImpl(obj, nested);
  }

  private formatInputImpl(obj: any) {
    if (!(obj instanceof Object)) {
      return obj;
    }
    let ret: Object = {};

    const processField = (k: string, field: Field) => {
      const fieldName = toFieldName(k);
      const dbKey = getStorageKey(field, k);
      let val = obj[fieldName];

      if (val === undefined && obj[dbKey] !== undefined) {
        val = obj[dbKey];
      }

      if (val === undefined) {
        return;
      }
      if (field.format) {
        if (field instanceof StructField) {
          val = field.formatInput(val);
        } else {
          val = field.format(val, true);
        }
      }
      ret[fieldName] = val;
    };

    for (const k in this.options.fields) {
      const field = this.options.fields[k];

      processField(k, field);

      if (field.getDerivedFields) {
        const derivedFields = field.getDerivedFields(k);
        for (const k in derivedFields) {
          processField(k, derivedFields[k]);
        }
      }
    }
    return ret;
  }

  formatInput(obj: any) {
    if (this.type.globalType) {
      const f = __getGlobalSchemaField(this.type.globalType);
      if (f instanceof StructField) {
        return f.formatInput(obj);
      }
      if (f && f.format) {
        return f.format(obj, true);
      }
    }
    if (Array.isArray(obj) && this.jsonAsList) {
      return obj.map((v) => this.formatInputImpl(v));
    }
    return this.formatInputImpl(obj);
  }

  private async validImpl(obj: any) {
    if (!(obj instanceof Object)) {
      return false;
    }

    let promises: (boolean | Promise<boolean>)[] = [];

    const processField = (
      k: string,
      dbKey: string,
      field: Field,
    ): boolean | undefined => {
      let fieldName = toFieldName(k);
      let val = obj[fieldName];

      let uniqueKeyField = false;
      if (
        this.validateUniqueKey !== undefined &&
        (fieldName === this.validateUniqueKey ||
          k === this.validateUniqueKey ||
          dbKey === this.validateUniqueKey)
      ) {
        // this.validateUniqueKey = camelKey;
        uniqueKeyField = true;
      }

      if (uniqueKeyField && this.checkUniqueKey) {
        this.validateUniqueKey = fieldName;
      }

      if (val === undefined && obj[dbKey] !== undefined) {
        if (uniqueKeyField && this.checkUniqueKey) {
          this.validateUniqueKey = dbKey;
        }
        val = obj[dbKey];
      }
      // we've processed this once and no need to process this again
      if (uniqueKeyField && this.checkUniqueKey) {
        this.checkUniqueKey = false;
      }
      if (val === undefined || val === null) {
        // nullable, nothing to do here
        if (field.nullable) {
          return;
        }
        valid = false;
        return false;
      }
      if (!field.valid) {
        return;
      }
      promises.push(field.valid(val));
    };
    // TODO probably need to support optional fields...
    let valid = true;
    for (const k in this.options.fields) {
      const field = this.options.fields[k];
      let dbKey = getStorageKey(field, k);

      if (processField(k, dbKey, field) === false) {
        valid = false;
      }

      if (field.getDerivedFields) {
        const derivedFields = field.getDerivedFields(k);
        for (const k in derivedFields) {
          const derivedField = derivedFields[k];
          let dbKey = getStorageKey(derivedField, k);
          if (processField(k, dbKey, derivedField) === false) {
            valid = false;
          }
        }
      }
    }
    if (!valid) {
      return valid;
    }
    const ret = await Promise.all(promises);
    return ret.every((v) => v);
  }

  async valid(obj: any): Promise<boolean> {
    if (this.type.globalType) {
      const f = __getGlobalSchemaField(this.type.globalType);
      // list and global type is not valid.
      if (f) {
        if (f.valid) {
          if (
            JSON.stringify(this.type.listElemType) !==
            JSON.stringify(f?.type.listElemType)
          ) {
            if (this.jsonAsList) {
              if (!Array.isArray(obj)) {
                return false;
              }
              // @ts-ignore
              const valid = await Promise.all(obj.map((v) => f.valid(v)));
              return valid.every((b) => b);
            } else {
              return f.valid([obj]);
            }
          }

          return f.valid(obj);
        }
        return true;
      } else {
        log(
          "error",
          `globalType ${this.type.globalType} not found in global schema`,
        );
        return false;
      }
    }
    if (this.jsonAsList) {
      if (!Array.isArray(obj)) {
        return false;
      }
      // hmm shared instance across tests means this is needed.
      // are there other places that have an issue like this???
      this.checkUniqueKey = true;
      const unique = new Set();
      const valid = await Promise.all(
        obj.map(async (v) => {
          const valid = await this.validImpl(v);
          if (!valid) {
            return false;
          }
          if (this.validateUniqueKey) {
            let value = v[this.validateUniqueKey];
            if (unique.has(value)) {
              return false;
            }
            unique.add(value);
          }
          return true;
        }),
      );
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

export function StructTypeAsList(options: StructOptions) {
  let result = new StructField(options, true);
  return Object.assign(result, options);
}
