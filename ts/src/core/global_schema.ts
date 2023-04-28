import { DBType, Field, GlobalSchema } from "../schema/schema";

let globalSchema: GlobalSchema | undefined;
let globalSchemaFields: Map<string, Field> = new Map();

function isGlobalSchemaField(f: Field) {
  switch (f.type.dbType) {
    case DBType.Enum:
    case DBType.StringEnum:
    case DBType.IntEnum:
    case DBType.JSON:
    case DBType.JSONB:
      return true;
  }
  return false;
}
export function setGlobalSchema(val: GlobalSchema) {
  globalSchema = val;
  if (val.fields) {
    for (const [k, v] of Object.entries(val.fields)) {
      if (isGlobalSchemaField(v) && v.type.type) {
        globalSchemaFields.set(v.type.type, v);
      }
    }
  }
}

export function clearGlobalSchema() {
  globalSchema = undefined;
  globalSchemaFields.clear();
}

// used by tests. no guarantee will always exist
export function __hasGlobalSchema() {
  return globalSchema !== undefined;
}

// used by tests. no guarantee will always exist
export function __getGlobalSchema(): GlobalSchema | undefined {
  return globalSchema;
}

export function __getGlobalSchemaFields() {
  return globalSchemaFields;
}

export function __getGlobalSchemaField(type: string) {
  return globalSchemaFields.get(type);
}
