import { Type, DBType, Field, FieldOptions } from "./schema";

export abstract class BaseField {
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
  return Object.assign(result, options);
}

export class Integer extends BaseField implements Field {
  type: Type = { dbType: DBType.Int };
}

export function IntegerType(options: FieldOptions): Integer {
  let result = new Integer();
  return Object.assign(result, options);
}

export class Float extends BaseField implements Field {
  type: Type = { dbType: DBType.Float };
}

export function FloatType(options: FieldOptions): Float {
  let result = new Float();
  return Object.assign(result, options);
}

export class Boolean extends BaseField implements Field {
  type: Type = { dbType: DBType.Boolean };
}

export function BooleanType(options: FieldOptions): Boolean {
  let result = new Boolean();
  return Object.assign(result, options);
}

export interface StringOptions extends FieldOptions {
  minLen?: number;
  maxLen?: number;
  length?: number;
}

export class String extends BaseField implements Field, StringOptions {
  minLen: number | undefined;
  maxLen: number | undefined;
  length: number | undefined;

  type: Type = { dbType: DBType.String };

  private validators: { (str: string): boolean }[] = [];
  private formatters: { (str: string): string }[] = [];

  valid(val: any): boolean {
    if (this.minLen) {
      let minLen = this.minLen;
      this.validators.push((val) => val.length >= minLen);
    }

    if (this.maxLen) {
      let maxLen = this.maxLen;
      this.validators.push((val) => val.length <= maxLen);
    }

    if (this.length) {
      let length = this.length;
      this.validators.push((val) => val.length === length);
    }

    // TODO play with API more and figure out if I want functions ala below
    // or properties ala this
    // both doable but which API is better ?
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
    return this.formatter((str) => str.toLowerCase());
  }

  toUpperCase(): String {
    return this.formatter((str) => str.toUpperCase());
  }

  trim(): String {
    return this.formatter((str) => str.trim());
  }

  trimLeft(): String {
    return this.formatter((str) => str.trimLeft());
  }

  trimRiight(): String {
    return this.formatter((str) => str.trimRight());
  }
}

export function StringType(options: StringOptions): String {
  let result = new String();
  return Object.assign(result, options);
}

export class Time extends BaseField implements Field {
  type: Type = { dbType: DBType.Time };
}

export function TimeType(options: FieldOptions): Time {
  let result = new Time();
  return Object.assign(result, options);
}

// export class JSON extends BaseField implements Field {
//   type: Type = {dbType: DBType.JSON}
// }
