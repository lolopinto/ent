import { ListField } from ".";
import { BaseField } from "./field";
import { FieldOptions, Field, Type, DBType, FieldMap } from "./schema";

export interface StructOptions extends FieldOptions {}

export class StructField extends BaseField implements Field {
  // TODO JSON option...
  type: Type = {
    dbType: DBType.JSONB,
    // TODO fields that need to be created in go-land
  };

  constructor(private fields: FieldMap) {
    super();
    this.type.subFields = fields;
  }

  format(obj: any, nested?: boolean) {
    if (!(obj instanceof Object)) {
      throw new Error("valid was not called");
    }
    let ret: Object = {};
    for (const k in this.fields) {
      const val = obj[k];
      if (val === undefined) {
        continue;
      }
      const field = this.fields[k];
      if (field.format) {
        // indicate nested so this isn't JSON stringified
        ret[k] = field.format(val, true);
      } else {
        ret[k] = val;
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
    for (const k in this.fields) {
      const field = this.fields[k];
      const val = obj[k];

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
}

export function StructType(fields: FieldMap, options?: FieldOptions) {
  let result = new StructField(fields);
  return Object.assign(result, options);
}
