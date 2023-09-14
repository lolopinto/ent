import { BaseField } from "./field";
import { Type, DBType, Field, FieldOptions } from "./schema";

export class ByteaField extends BaseField implements Field {
  type: Type = {
    dbType: DBType.Bytea,
  };

  format(val: any) {
    return val;
  }

  valid(val: any) {
    return val instanceof Buffer;
  }
}

export function ByteaType(options?: FieldOptions) {
  const result = new ByteaField();
  return Object.assign(result, options);
}

export class BinaryTextField extends BaseField implements Field {
  type: Type = {
    dbType: DBType.String,
  };

  format(val: any) {
    return val.toString("base64");
  }

  valid(val: any) {
    return val instanceof Buffer;
  }
}

export function BinaryTextType(options?: FieldOptions) {
  const result = new BinaryTextField();
  return Object.assign(result, options);
}
