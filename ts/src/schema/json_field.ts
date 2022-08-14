import { FieldOptions, Type, Field, DBType, ImportType } from "./schema";
import { BaseField, ListField } from "./field";

export interface JSONOptions extends FieldOptions {
  validator?: (val: any) => boolean;
  // instead of using a validator, can use a TypeScript type (preferably an interface)
  // to ensure that the types match
  importType?: ImportType;
}

interface allJSONOptions extends JSONOptions {
  jsonAsList?: boolean;
}

export class JSONField extends BaseField implements Field {
  type: Type = {
    dbType: DBType.JSON,
  };

  constructor(jsonb: boolean, private options?: allJSONOptions) {
    super();
    if (jsonb) {
      this.type.dbType = DBType.JSONB;
    }
    if (options?.importType) {
      this.type.importType = options.importType;
    }
    if (options?.jsonAsList) {
      this.type.listElemType = {
        dbType: DBType.JSONB,
      };
    }
  }

  format(val: any) {
    return JSON.stringify(val);
  }

  valid(val: any): boolean {
    if (this.options?.validator) {
      return this.options.validator(val);
    }
    return true;
  }
}

export function JSONType(options?: JSONOptions): JSONField {
  let result = new JSONField(false, options);
  return Object.assign(result, options);
}

export function JSONBType(options?: JSONOptions): JSONField {
  let result = new JSONField(true, options);
  return Object.assign(result, options);
}

/**
 * @deprecated use JSONBTypeAsList
 */
export function JSONBListType(options?: JSONOptions) {
  return new ListField(JSONBType(options), options);
}

/**
 * @deprecated use JSONTypeAsList
 */
export function JSONListType(options?: JSONOptions) {
  return new ListField(JSONType(options), options);
}

export function JSONBTypeAsList(options?: JSONOptions) {
  let result = new JSONField(true, {
    ...options,
    jsonAsList: true,
  });
  return Object.assign(result, options);
}

export function JSONTypeAsList(options?: JSONOptions) {
  let result = new JSONField(false, {
    ...options,
    jsonAsList: true,
  });
  return Object.assign(result, options);
}
