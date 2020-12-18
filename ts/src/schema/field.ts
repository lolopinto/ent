import {
  Type,
  DBType,
  Field,
  FieldOptions,
  PolymorphicOptions,
} from "./schema";

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

  // this should only be set on id fields. if set on other fields, it's currently ignored
  polymorphic?: boolean | PolymorphicOptions;
  // also adds a _type field
  //  e.g. owner_id -> owner_type
  // other fields

  // fields derived from this one. e.g. polymorphic id fields
  // add a _type field
  // e.g. a polymorphic user_id field adds a user_type field
  derivedFields?: Field[];
}

export class UUIDField extends BaseField implements Field {
  type: Type = { dbType: DBType.UUID };

  constructor(options: FieldOptions) {
    super();

    const polymorphic = options.polymorphic;
    if (polymorphic) {
      let name = "";
      if (options.name.endsWith("_id")) {
        let idx = options.name.indexOf("_id");
        name = options.name.substring(0, idx) + "_type";
      } else if (options.name.endsWith("ID")) {
        let idx = options.name.indexOf("ID");
        name = options.name.substring(0, idx) + "Type";
      } else {
        throw new Error(`unsupported id polymorhpic type ${options.name}`);
      }

      // polymorphic field automatically hidden from GraphQL
      // can be made visible with custom fields if user wants to change this behavior
      // can't be foreignKey so need to make other changes to the field
      // intentionally not made private as it doesn't seem like it needs to be hidden
      if (typeof polymorphic === "object" && polymorphic.types) {
        // an enum with types validated here
        this.derivedFields = [
          EnumType({
            name,
            values: polymorphic.types,
            hideFromGraphQL: true,
          }),
        ];
      } else {
        // just a string field...
        this.derivedFields = [StringType({ name, hideFromGraphQL: true })];
      }
    }
  }
}

export function UUIDType(options: FieldOptions): UUIDField {
  let result = new UUIDField(options);
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
  // required when not a reference to a lookup table
  // when using a lookup table enum, we should use all caps because we don't have the values to translate back
  values?: string[];
  //  by default the type is the name as the field
  // it's recommended to scope the enum names in scenarios where it makes sense

  tsType?: string;
  graphQLType?: string;

  createEnumType?: boolean;
}

export class EnumField extends BaseField implements Field {
  type: Type;
  private values?: string[];

  constructor(options: EnumOptions) {
    super();
    this.type = {
      // if createEnumType boolean, we create postgres enum otherwise we use a string for it
      dbType: options.createEnumType ? DBType.Enum : DBType.StringEnum,
      values: options.values,
      type: options.tsType || options.name,
      graphQLType: options.graphQLType || options.name,
    };
    if (!options.foreignKey) {
      if (!options.values) {
        throw new Error(
          "values required if not look up table enum. Look-up table enum indicated by foreignKey field",
        );
      }
      if (!options.values.length) {
        throw new Error("need at least one value in enum type");
      }
    } else {
      if (options.values) {
        throw new Error(
          "cannot specify values and foreign key for lookup table enum type",
        );
      }
      if (options.createEnumType) {
        throw new Error(
          "cannot specify createEnumType without specifying values",
        );
      }
      if (options.tsType) {
        throw new Error("cannot specify tsType without specifying values");
      }
      if (options.graphQLType) {
        throw new Error("cannot specify graphQLType without specifying values");
      }
    }
    this.values = options.values;
  }

  valid(val: any): boolean {
    // lookup table enum and indicated via presence of foreignKey
    if (!this.values) {
      return true;
    }
    let str = String(val);
    return this.values.some(
      (value) => value === str || value.toUpperCase() === str,
    );
  }

  format(val: any): any {
    // TODO need to format correctly for graphql purposes...
    // how to best get the values in the db...
    if (!this.values) {
      return val;
    }
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
