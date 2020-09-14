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

export class UUIDField extends BaseField implements Field {
  type: Type = { dbType: DBType.UUID };
}

export function UUIDType(options: FieldOptions): UUIDField {
  let result = new UUIDField();
  return Object.assign(result, options);
}

export class IntegerField extends BaseField implements Field {
  type: Type = { dbType: DBType.Int };
}

export function IntegerType(options: FieldOptions): IntegerField {
  let result = new IntegerField();
  return Object.assign(result, options);
}

export class FloatField extends BaseField implements Field {
  type: Type = { dbType: DBType.Float };
}

export function FloatType(options: FieldOptions): FloatField {
  let result = new FloatField();
  return Object.assign(result, options);
}

export class BooleanField extends BaseField implements Field {
  type: Type = { dbType: DBType.Boolean };
}

export function BooleanType(options: FieldOptions): BooleanField {
  let result = new BooleanField();
  return Object.assign(result, options);
}

export interface StringOptions extends FieldOptions {
  minLen?: number;
  maxLen?: number;
  length?: number;
}

export class StringField extends BaseField implements Field, StringOptions {
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

  validate(validator: (str: string) => boolean): StringField {
    this.validators.push(validator);
    return this;
  }

  formatter(formatter: (str: string) => string): StringField {
    this.formatters.push(formatter);
    return this;
  }

  match(pattern: string | RegExp): StringField {
    return this.validate(function(str: string): boolean {
      let r = new RegExp(pattern);
      return r.test(str);
    });
  }

  doesNotMatch(pattern: string | RegExp): StringField {
    return this.validate(function(str: string): boolean {
      let r = new RegExp(pattern);
      return !r.test(str);
    });
  }

  toLowerCase(): StringField {
    return this.formatter((str) => str.toLowerCase());
  }

  toUpperCase(): StringField {
    return this.formatter((str) => str.toUpperCase());
  }

  trim(): StringField {
    return this.formatter((str) => str.trim());
  }

  trimLeft(): StringField {
    return this.formatter((str) => str.trimLeft());
  }

  trimRight(): StringField {
    return this.formatter((str) => str.trimRight());
  }
}

export function StringType(options: StringOptions): StringField {
  let result = new StringField();
  return Object.assign(result, options);
}

export class TimeField extends BaseField implements Field {
  type: Type = { dbType: DBType.Time };
}

export function TimeType(options: FieldOptions): TimeField {
  let result = new TimeField();
  return Object.assign(result, options);
}

// export class JSON extends BaseField implements Field {
//   type: Type = {dbType: DBType.JSON}
// }

export interface EnumOptions extends FieldOptions {
  values: string[];
  //  by default the type is the name as the field
  // it's recommended to scope the enum names in scenarios where it makes sense

  // if no values how to specify foreign key enum info....

  tsType?: string;
  graphQLType?: string;

  createEnumType?: boolean;
}

export class EnumField extends BaseField implements Field {
  type: Type;
  private values: string[];

  constructor(options: EnumOptions) {
    super();
    this.type = {
      // if createEnumType boolean, we create postgres enum otherwise we use a string for it
      dbType: options.createEnumType ? DBType.Enum : DBType.StringEnum,
      values: options.values,
      type: options.tsType || options.name,
      graphQLType: options.graphQLType || options.name,
    };
    this.values = options.values;
  }

  valid(val: any): boolean {
    let str = String(val);
    return this.values.some(
      (value) => value === str || value.toUpperCase() === str,
    );
  }

  format(val: any): any {
    let str = String(val);

    for (let i = 0; i < this.values.length; i++) {
      let value = this.values[i];
      // store the format that maps to the given value in the db instead of saving the upper case value
      if (str === value || str.toLowerCase() === value.toLowerCase()) {
        return value;
      }
    }

    // whelp, just return what's passed
    return val;
  }
}

export function EnumType(options: EnumOptions): EnumField {
  let result = new EnumField(options);
  return Object.assign(result, options);
}
