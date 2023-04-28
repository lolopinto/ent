import { DBType, Field, GlobalSchema } from "../schema/schema";

let globalSchema: GlobalSchema | undefined;
let globalEnumFields: Map<string, Field> = new Map();

function isEnumField(f: Field) {
  switch (f.type.dbType) {
    case DBType.Enum:
    case DBType.StringEnum:
    case DBType.IntEnum:
      return true;
  }
  return false;
}
export function setGlobalSchema(val: GlobalSchema) {
  globalSchema = val;
  if (val.fields) {
    for (const [k, v] of Object.entries(val.fields)) {
      // TODO need a better check here...

      if (isEnumField(v) && v.type.type) {
        globalEnumFields.set(v.type.type, v);
      }
    }
  }
}

export function clearGlobalSchema() {
  globalSchema = undefined;
  globalEnumFields.clear();
}

// used by tests. no guarantee will always exist
export function __hasGlobalSchema() {
  return globalSchema !== undefined;
}

// used by tests. no guarantee will always exist
export function __getGlobalSchema(): GlobalSchema | undefined {
  return globalSchema;
}

export function __getGlobalEnumFields() {
  return globalEnumFields;
}
