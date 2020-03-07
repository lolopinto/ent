import { Type, DBType, Field, FieldOptions } from "./schema";

abstract class BaseField {
  name: string;
  nullable?: boolean;
  storageKey?: string;
  serverDefault?: any;
  unique?: boolean;
  hideFromGraphQL?: boolean;
  private?: boolean;
  graphqlName?: string;
  index?: boolean;
  foreignKey?: [string, string];
}

export class UUID extends BaseField implements Field {
  type: Type = { dbType: DBType.UUID };
}

export function UUIDType(options: FieldOptions): UUID {
  let result = new UUID();
  for (const key in options) {
    const value = options[key];
    result[key] = value;
  }
  return result;
}

export class Integer extends BaseField implements Field {
  type: Type = { dbType: DBType.Int };
}

export function IntegerType(options: FieldOptions): Integer {
  let result = new Integer();
  for (const key in options) {
    const value = options[key];
    result[key] = value;
  }
  return result;
}

export class Float extends BaseField implements Field {
  type: Type = { dbType: DBType.Float };
}

export function FloatType(options: FieldOptions): Float {
  let result = new Float();
  for (const key in options) {
    const value = options[key];
    result[key] = value;
  }
  return result;
}

export class Boolean extends BaseField implements Field {
  type: Type = { dbType: DBType.Boolean };
}

export function BooleanType(options: FieldOptions): Boolean {
  let result = new Boolean();
  for (const key in options) {
    const value = options[key];
    result[key] = value;
  }
  return result;
}

export interface StringOptions extends FieldOptions {
  minLen?: number;
  maxLen?: number;
  length?: number;
}

export class String extends BaseField implements Field, StringOptions {
  minLen: number;
  maxLen: number;
  length: number;

  type: Type = { dbType: DBType.String };

  private validators: { (str: string): boolean }[] = [];
  private formatters: { (str: string): string }[] = [];

  valid(val: any): boolean {
    // TODO minLen, maxLen, length
    // TODO play with API more and figure out if I want functions ala below
    // or properties ala this
    // both doable but which API is better ?
    // if (this.minLen) {
    //   this.validate(function())
    // }
    for (const validator of this.validators) {
      if (!validator(val)) {
        return false;
      }
    }
    return true;
  }

  format(val: any): any {
    for (const formatter of this.formatters) {
      val = formatter(val);
    }
    return val;
  }

  validate(validator: (str: string) => boolean): String {
    this.validators.push(validator);
    return this;
  }

  formatter(formatter: (str: string) => string): String {
    this.formatters.push(formatter);
    return this;
  }

  match(pattern: string | RegExp): String {
    return this.validate(function(str: string): boolean {
      let r = new RegExp(pattern);
      return r.test(str);
    });
  }

  doesNotMatch(pattern: string | RegExp): String {
    return this.validate(function(str: string): boolean {
      let r = new RegExp(pattern);
      return !r.test(str);
    });
  }

  toLowerCase(): String {
    return this.formatter(function(str: string): string {
      return str.toLowerCase();
    });
  }

  toUpperCase(): String {
    return this.formatter(function(str: string): string {
      return str.toUpperCase();
    });
  }
}

export function StringType(options: StringOptions): String {
  let result = new String();
  for (const key in options) {
    const value = options[key];
    result[key] = value;
  }
  return result;
}

export class Time extends BaseField implements Field {
  type: Type = { dbType: DBType.Time };
}

export function TimeType(options: FieldOptions): Time {
  let result = new Time();
  for (const key in options) {
    const value = options[key];
    result[key] = value;
  }
  return result;
}

// export class JSON extends BaseField implements Field {
//   type: Type = {dbType: DBType.JSON}
// }
