import {
  Type,
  DBType,
  Field,
  FieldOptions,
  PolymorphicOptions,
  ForeignKey,
} from "./schema";
import { snakeCase } from "snake-case";
import { DateTime } from "luxon";
import DB, { Dialect } from "../core/db";

export abstract class BaseField {
  name: string;
  nullable?: boolean;
  storageKey?: string;
  serverDefault?: any;
  unique?: boolean;
  hideFromGraphQL?: boolean;
  private?: boolean;
  sensitive?: boolean;
  graphqlName?: string;
  index?: boolean;
  foreignKey?: ForeignKey;

  // this should only be set on id fields. if set on other fields, it's currently ignored
  polymorphic?: boolean | PolymorphicOptions;
  // also adds a _type field
  //  e.g. owner_id -> owner_type
  // other fields

  // fields derived from this one. e.g. polymorphic id fields
  // add a _type field
  // e.g. a polymorphic user_id field adds a user_type field
  derivedFields?: Field[];
  derivedWhenEmbedded?: boolean;

  logValue(val: any): any {
    if (this.sensitive) {
      // for sensitive things, don't log the actual value
      return "*".repeat(`${val}`.length);
    }
    return val;
  }
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
            derivedWhenEmbedded: true,
          }),
        ];
      } else {
        // just a string field...
        this.derivedFields = [
          StringType({
            name,
            hideFromGraphQL: true,
            derivedWhenEmbedded: true,
          }),
        ];
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
  toLowerCase?: boolean;
  toUpperCase?: boolean;
  match?: string | RegExp;
  doesNotMatch?: string | RegExp;
  trim?: boolean;
  trimLeft?: boolean;
  trimRight?: boolean;
}

export class StringField extends BaseField implements Field {
  type: Type = { dbType: DBType.String };
  private validators: { (str: string): boolean }[] = [];
  private formatters: { (str: string): string }[] = [];

  constructor(options: StringOptions) {
    super();
    this.handleOptions(options);
  }

  getOptions(): StringOptions {
    return this.getOptions;
  }

  private handleOptions(options: StringOptions) {
    const noParams = {
      toLowerCase: this.toLowerCase,
      toUpperCase: this.toUpperCase,
      trim: this.trim,
      trimLeft: this.trimLeft,
      trimRight: this.trimRight,
    };

    const params = {
      minLen: this.minLen,
      maxLen: this.maxLen,
      length: this.length,
      match: this.match,
      doesNotMatch: this.doesNotMatch,
    };

    for (const k in params) {
      const v = options[k];
      if (v !== undefined) {
        params[k].apply(this, [v]);
      }
    }
    for (const k in noParams) {
      if (options[k] === true) {
        noParams[k].apply(this);
      }
    }
  }

  minLen(l: number): StringField {
    return this.validate((val) => {
      return val.length >= l;
    });
  }

  maxLen(l: number): StringField {
    return this.validate((val) => val.length <= l);
  }

  length(l: number) {
    return this.validate((val) => val.length === l);
  }

  valid(val: any): boolean {
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
    return this.validate(function (str: string): boolean {
      let r = new RegExp(pattern);
      return r.test(str);
    });
  }

  doesNotMatch(pattern: string | RegExp): StringField {
    return this.validate(function (str: string): boolean {
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
  let result = new StringField(options);
  const options2 = { ...options };
  for (const key in options) {
    // key already exists here e.g. the method toLowerCase
    if (result[key]) {
      delete options2[key];
    }
  }
  //hmm...
  return Object.assign(result, options2);
}

export interface TimestampOptions extends FieldOptions {
  withTimezone?: boolean;
}

export class TimestampField extends BaseField implements Field {
  type: Type = { dbType: DBType.Timestamp };
  withTimezone?: boolean;

  constructor(options: TimestampOptions) {
    super();
    if (options.withTimezone) {
      this.type = {
        dbType: DBType.Timestamptz,
      };
    }
  }

  format(val: Date): any {
    let dt: DateTime;
    if (typeof val === "string") {
      dt = DateTime.fromISO(val);
    } else {
      dt = DateTime.fromJSDate(val);
    }
    if (this.withTimezone) {
      // send ISO down so that if it's saved in different format e.g. csv and then
      // later saved in the db  e.g. with COPY, correct value is saved.
      return dt.toISO();
    }

    // without timezone, make sure to store UTC value...
    return dt.toUTC().toISO();
  }
}

export function TimestampType(options: TimestampOptions): TimestampField {
  let result = new TimestampField(options);
  return Object.assign(result, options);
}

export function TimestamptzType(options: FieldOptions): TimestampField {
  let opts: TimestampOptions = { withTimezone: true, ...options };
  let result = new TimestampField(opts);
  return Object.assign(result, opts);
}

export interface TimeOptions extends FieldOptions {
  withTimezone?: boolean;
  precision?: number;
}

export const leftPad = (val: number): string => {
  if (val >= 0) {
    if (val < 10) {
      return `0${val}`;
    }
    return val.toString();
  }
  if (val > -10) {
    return `-0${val * -1}`;
  }
  return val.toString();
};

export class TimeField extends BaseField implements Field {
  type: Type = { dbType: DBType.Time };
  withTimezone?: boolean;

  constructor(options: TimeOptions) {
    super();
    if (options.withTimezone) {
      this.type = {
        dbType: DBType.Timetz,
      };
    }
  }

  format(val: any): any {
    // allow database handle it
    // https://www.postgresql.org/docs/9.1/datatype-datetime.html#AEN5668
    if (!(val instanceof Date)) {
      return val;
    }
    let offset = "";

    if (this.withTimezone) {
      // for some reason this API is backwards
      let div = (val.getTimezoneOffset() / 60) * -1;

      offset = leftPad(div);
    }
    let hh = leftPad(val.getHours());
    let mm = leftPad(val.getMinutes());
    let ss = leftPad(val.getSeconds());
    let ms = leftPad(val.getMilliseconds());
    if (ms !== "00" && offset) {
      return `${hh}:${mm}:${ss}.${ms}${offset}`;
    } else {
      return `${hh}:${mm}:${ss}`;
    }
  }
}

export function TimeType(options: TimeOptions): TimeField {
  let result = new TimeField(options);
  return Object.assign(result, options);
}

export function TimetzType(options: FieldOptions): TimeField {
  let opts: TimestampOptions = {
    withTimezone: true,
    ...options,
  };
  let result = new TimeField(opts);
  return Object.assign(result, opts);
}

export class DateField extends BaseField implements Field {
  type: Type = { dbType: DBType.Date };

  format(val: any): any {
    if (!(val instanceof Date)) {
      return val;
    }

    let yy = leftPad(val.getFullYear());

    // lol this API
    // for some reason this is 0-index
    let mm = leftPad(val.getMonth() + 1);
    let dd = leftPad(val.getDate());
    let ret = `${yy}-${mm}-${dd}`;

    return ret;
  }
}

export function DateType(options: FieldOptions): DateField {
  let result = new DateField();
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

  convertForGQL(value: string) {
    return snakeCase(value).toUpperCase();
  }

  valid(val: any): boolean {
    // lookup table enum and indicated via presence of foreignKey
    if (!this.values) {
      return true;
    }
    let str = String(val);
    return this.values.some(
      (value) => value === str || this.convertForGQL(value) === str,
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
      if (str === value || str === this.convertForGQL(value)) {
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

export class ListField extends BaseField {
  type: Type;

  constructor(private field: Field, options: FieldOptions) {
    super();
    if (field.type.dbType === DBType.List) {
      throw new Error(`nested lists not currently supported`);
    }
    this.type = {
      dbType: DBType.List,
      listElemType: field.type,
    };
    Object.assign(this, options);
  }

  valid(val: any): boolean {
    // console.debug("val", val);
    // console.debug("field", this.field);
    if (!Array.isArray(val)) {
      return false;
    }
    if (!this.field.valid) {
      return true;
    }
    for (const v of val) {
      if (!this.field.valid(v)) {
        return false;
      }
    }
    return true;
    //    return val.every(this.field.valid);
  }

  format(val: any): any {
    if (!Array.isArray(val)) {
      throw new Error(`need an array to format`);
    }

    if (this.field.format) {
      for (let i = 0; i < val.length; i++) {
        val[i] = this.field.format(val[i]);
      }
      //      val = val.map(this.field.format);
    }

    // postgres supports arrays natively so we
    // structure it in the expected format
    if (DB.getDialect() === Dialect.Postgres) {
      return `{${val.join(",")}}`;
    }
    // For SQLite, we store a JSON string
    return JSON.stringify(val);
  }
}

export function StringListType(options: StringOptions) {
  return new ListField(StringType(options), options);
}

export function IntListType(options: FieldOptions) {
  return new ListField(IntegerType(options), options);
}

export function FloatListType(options: FieldOptions) {
  return new ListField(FloatType(options), options);
}

export function BooleanListType(options: FieldOptions) {
  return new ListField(BooleanType(options), options);
}

export function TimestampListType(options: TimestampOptions) {
  return new ListField(TimestampType(options), options);
}

export function TimestamptzListType(options: TimestampOptions) {
  return new ListField(TimestamptzType(options), options);
}

export function TimeListType(options: TimeOptions) {
  return new ListField(TimeType(options), options);
}

export function TimetzListType(options: TimeOptions) {
  return new ListField(TimetzType(options), options);
}

export function DateListType(options: FieldOptions) {
  return new ListField(DateType(options), options);
}

export function EnumListType(options: EnumOptions) {
  if (options.createEnumType) {
    throw new Error(`createEnumType is currently unsupported in enum list`);
  }
  if (options.foreignKey) {
    throw new Error(`foreignKey is currently unsupported in enum list`);
  }

  // not all of these will make sense in a list...
  // can make it work eventually but involves work we're not currently trying to do
  // developer can try to work around it by calling below on their own.
  // unclear what the behavior is
  return new ListField(EnumType(options), options);
}
