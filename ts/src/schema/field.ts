import { DateTime } from "luxon";
import { isPromise } from "util/types";
import { validate } from "uuid";
import { Ent, WriteOperation } from "../core/base";
import { Builder } from "../action/action";
import DB, { Dialect } from "../core/db";
import {
  DBType,
  Field,
  FieldMap,
  FieldOptions,
  ForeignKey,
  PolymorphicOptions,
  Type,
} from "./schema";
import { __getGlobalSchemaField } from "../core/global_schema";
import { log } from "../core/logger";
import { toFieldName } from "../names/names";

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
  //  derivedFields?(name: string): FieldMap;
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

  constructor(private options?: FieldOptions) {
    super();

    if (
      options?.fieldEdge?.enforceSchema &&
      !options.fieldEdge.getLoaderInfoFromSchema
    ) {
      throw new Error(
        `cannot enforceSchema if getLoaderInfoFromSchema wasn't passed in`,
      );
    }
  }

  getDerivedFields(fieldName: string): FieldMap {
    const polymorphic = this.options?.polymorphic;
    if (polymorphic) {
      let name = "";
      if (fieldName.endsWith("_id")) {
        let idx = fieldName.indexOf("_id");
        name = fieldName.substring(0, idx) + "_type";
      } else if (fieldName.endsWith("ID")) {
        let idx = fieldName.indexOf("ID");
        name = fieldName.substring(0, idx) + "Type";
      } else {
        throw new Error(`unsupported id polymorhpic type ${fieldName}`);
      }

      let types: string[] | undefined;
      let serverDefault: any = undefined;
      if (typeof polymorphic === "object") {
        serverDefault = polymorphic.serverDefault;
        types = polymorphic.types;
      }

      // polymorphic field automatically hidden from GraphQL
      // can be made visible with custom fields if user wants to change this behavior
      // can't be foreignKey so need to make other changes to the field
      // intentionally not made private as it doesn't seem like it needs to be hidden

      return {
        [name]: PolymorphicStringType({
          types: types,
          hideFromGraphQL: true,
          derivedWhenEmbedded: true,
          nullable: this.options?.nullable,
          parentFieldToValidate: fieldName,
          serverDefault: serverDefault,
        }),
      };
    }
    return {};
  }

  private isBuilder(val: Builder<Ent> | any): val is Builder<Ent> {
    return (val as Builder<Ent>).placeholderID !== undefined;
  }

  async valid(val: any) {
    if (typeof val === "string" && !validate(val)) {
      return false;
    }
    if (!this.options?.fieldEdge?.enforceSchema) {
      return true;
    }

    const getLoaderInfo = this.options.fieldEdge.getLoaderInfoFromSchema!;
    const loaderInfo = getLoaderInfo(this.options.fieldEdge.schema);
    if (!loaderInfo) {
      throw new Error(
        `couldn't get loaderInfo for ${this.options.fieldEdge.schema}`,
      );
    }
    if (this.isBuilder(val)) {
      // if builder, the nodeType of the builder and the nodeType of the loaderInfo should match
      return val.nodeType === loaderInfo.nodeType;
    }
    // TODO we need context here to make sure that we hit local cache

    const row = await loaderInfo.loaderFactory.createLoader().load(val);
    return row !== null;
  }
}

export function UUIDType(options?: FieldOptions): UUIDField {
  let result = new UUIDField(options);
  return Object.assign(result, options);
}

export interface IntegerOptions extends NumberOptions<number> {}

export interface NumberOptions<T> extends FieldOptions {
  min?: T;
  max?: T;
}

export class NumberField<T> extends BaseField {
  // to be overriden as needed
  type: Type = { dbType: DBType.Int };

  private validators: { (str: number): boolean }[] = [];
  private options: NumberOptions<T> = {};

  constructor(options?: NumberOptions<T>) {
    super();
    // for legacy callers
    this.handleOptions(options || this.options);
  }

  getOptions(): NumberOptions<T> {
    return this.options;
  }

  private handleOptions(options: NumberOptions<T>) {
    const params = {
      min: this.min,
      max: this.max,
    };

    for (const k in params) {
      const v = options[k];
      if (v !== undefined) {
        params[k].apply(this, [v]);
      }
    }
    this.options = options;
  }

  min(l: T): this {
    // @ts-ignore Operator '>=' cannot be applied to types 'number' and 'T'.
    return this.validate((val) => val >= l);
  }

  max(l: T): this {
    // @ts-ignore Operator '<=' cannot be applied to types 'number' and 'T'.
    return this.validate((val) => val <= l);
  }

  valid(val: any): boolean {
    for (const validator of this.validators) {
      if (!validator(val)) {
        return false;
      }
    }
    return true;
  }

  validate(validator: (str: number) => boolean): this {
    this.validators.push(validator);
    return this;
  }
}

export class IntegerField extends NumberField<number> implements Field {
  type: Type = { dbType: DBType.Int };
}

export function IntegerType(options?: IntegerOptions): IntegerField {
  let result = new IntegerField(options);
  return Object.assign(result, options);
}

export class BigIntegerField extends NumberField<BigInt> implements Field {
  type: Type = { dbType: DBType.BigInt };
}

export function BigIntegerType(
  options?: NumberOptions<BigInt>,
): BigIntegerField {
  let result = new BigIntegerField(options);
  return Object.assign(result, options);
}

export class FloatField extends NumberField<number> implements Field {
  type: Type = { dbType: DBType.Float };
}

export function FloatType(options?: NumberOptions<number>): FloatField {
  let result = new FloatField(options);
  return Object.assign(result, options);
}

export class BooleanField extends BaseField implements Field {
  type: Type = { dbType: DBType.Boolean };
}

export function BooleanType(options?: FieldOptions): BooleanField {
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
  private options: StringOptions = {};

  constructor(options?: StringOptions) {
    super();
    // for legacy callers
    this.handleOptions(options || {});
  }

  getOptions(): StringOptions {
    return this.options;
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
    this.options = options;
  }

  minLen(l: number): this {
    return this.validate((val) => {
      return val.length >= l;
    });
  }

  maxLen(l: number): this {
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

  validate(validator: (str: string) => boolean): this {
    this.validators.push(validator);
    return this;
  }

  formatter(formatter: (str: string) => string): this {
    this.formatters.push(formatter);
    return this;
  }

  match(pattern: string | RegExp): this {
    return this.validate(function (str: string): boolean {
      let r = new RegExp(pattern);
      return r.test(str);
    });
  }

  doesNotMatch(pattern: string | RegExp): this {
    return this.validate(function (str: string): boolean {
      let r = new RegExp(pattern);
      return !r.test(str);
    });
  }

  toLowerCase(): this {
    return this.formatter((str) => str.toLowerCase());
  }

  toUpperCase(): this {
    return this.formatter((str) => str.toUpperCase());
  }

  trim(): this {
    return this.formatter((str) => str.trim());
  }

  trimLeft(): this {
    return this.formatter((str) => str.trimLeft());
  }

  trimRight(): this {
    return this.formatter((str) => str.trimRight());
  }
}

interface PolymorphicStringOptions extends StringOptions {
  parentFieldToValidate: string;
  // restrict to just these types...
  types?: string[];
}

export class PolymorphicStringField extends StringField {
  private fieldNameValues: string[] | undefined;
  constructor(private opts: PolymorphicStringOptions) {
    super(opts);
    if (opts.types) {
      this.fieldNameValues = opts.types.map((v) => toFieldName(v));
    }
  }

  validateWithFullData(val: any, b: Builder<any>): boolean {
    const input = b.getInput();
    const inputKey =
      b.orchestrator.__getOptions().fieldInfo[this.opts.parentFieldToValidate]
        .inputKey;

    const v = input[inputKey];

    if (val === null) {
      // if this is being set to null, ok if v is also null
      return v === null;
    }
    // if this is not being set, ok if v is not being set
    if (val === undefined && b.operation === WriteOperation.Insert) {
      return v === undefined;
    }
    return true;
  }

  valid(val: any): boolean {
    if (!this.fieldNameValues) {
      return true;
    }

    let str = toFieldName(String(val));
    // allow different cases because it could be coming from different clients who don't have strong typing
    return this.fieldNameValues.some((value) => value === str);
  }

  format(val: any) {
    if (!this.fieldNameValues) {
      return val;
    }

    const converted = toFieldName(String(val));

    for (const v of this.fieldNameValues) {
      if (v === val) {
        return val;
      }
      if (converted === v) {
        return converted;
      }
    }
    return val;
  }
}

function PolymorphicStringType(opts: PolymorphicStringOptions) {
  let result = new PolymorphicStringField(opts);
  return Object.assign(result, opts);
}

export function StringType(options?: StringOptions): StringField {
  let result = new StringField(options);
  const options2 = { ...options };
  for (const key in options) {
    // key already exists here e.g. the method toLowerCase
    if (result[key]) {
      delete options2[key];
    }
  }
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

export function TimestampType(options?: TimestampOptions): TimestampField {
  let result = new TimestampField({ ...options });
  return Object.assign(result, options);
}

export function TimestamptzType(options?: FieldOptions): TimestampField {
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

  constructor(options?: TimeOptions) {
    super();
    if (options?.withTimezone) {
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

export function TimeType(options?: TimeOptions): TimeField {
  let result = new TimeField(options);
  return Object.assign(result, options);
}

export function TimetzType(options?: FieldOptions): TimeField {
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
    if (typeof val === "string") {
      return val;
    }
    val = new Date(val);

    let yy = leftPad(val.getFullYear());

    // lol this API
    // for some reason this is 0-index
    let mm = leftPad(val.getMonth() + 1);
    let dd = leftPad(val.getDate());
    let ret = `${yy}-${mm}-${dd}`;

    return ret;
  }
}

export function DateType(options?: FieldOptions): DateField {
  let result = new DateField();
  return Object.assign(result, options);
}

declare type StringEnumMap = {
  [key: string]: string;
};

/**
 * @deprecated use StringEnumOptions
 */
export interface EnumOptions extends FieldOptions {
  // required when not a reference to a lookup table
  // when using a lookup table enum, we should use all caps because we don't have the values to translate back
  values?: string[];
  // used when we're migrating from old -> new values and want to reuse the values but the values may not be the best keys so this is preferred
  // instead of values.
  // GRAPHQL will take the key and use it as the value here instead o
  map?: StringEnumMap;

  // by default the type is the name as the field
  // it's recommended to scope the enum names in scenarios where it makes sense
  tsType?: string;
  graphQLType?: string;

  createEnumType?: boolean;

  // if set to true, we don't add an `UNKNOWN` or `Unknown` type to deal with invalid|deprecated|old types
  // coming from the db.
  // GraphQL is strict about old values so we are adding this
  disableUnknownType?: boolean;

  // used to flag that this is referencing a global shared enum type.
  globalType?: string;
}

/**
 * @deprecated Use StringEnumField
 */
export class EnumField extends BaseField implements Field {
  type: Type;
  private values?: string[];
  private map?: StringEnumMap;

  constructor(options: StringEnumOptions) {
    super();
    this.type = {
      // if createEnumType boolean, we create postgres enum otherwise we use a string for it
      dbType: options.createEnumType ? DBType.Enum : DBType.StringEnum,
      values: options.values,
      enumMap: options.map,
      type: options.tsType,
      graphQLType: options.graphQLType,
      disableUnknownType: options.disableUnknownType,
      globalType: options.globalType,
    };
    if (!options.foreignKey) {
      if (!options.values && !options.map && !options.globalType) {
        throw new Error(
          "values, map or globalType required if not look up table enum. Look-up table enum indicated by foreignKey field",
        );
      }
      if (options.values) {
        if (!options.values.length) {
          throw new Error("need at least one value in enum type");
        }
      }
      if (options.map) {
        let count = 0;
        for (const _ in options.map) {
          count++;
          break;
        }
        if (!count) {
          throw new Error("need at least one entry in enum map");
        }
      }
    } else {
      if (options.values || options.map || options.globalType) {
        throw new Error(
          "cannot specify values, map or globalType and foreign key for lookup table enum type",
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
    this.map = options.map;
  }

  async valid(val: any): Promise<boolean> {
    if (this.type.globalType) {
      const f = __getGlobalSchemaField(this.type.globalType);
      if (f) {
        if (f.valid) {
          return f.valid(val);
        }
        return true;
      } else {
        log(
          "error",
          `globalType ${this.type.globalType} not found in global schema`,
        );
        return false;
      }
    }

    // lookup table enum and indicated via presence of foreignKey
    if (!this.values && !this.map) {
      return true;
    }
    if (this.values) {
      let str = String(val);
      return this.values.some((value) => value === str);
    }

    for (const k in this.map) {
      const v = this.map[k];
      if (v === val) {
        return true;
      }
    }
    return false;
  }

  format(val: any): any {
    if (this.type.globalType) {
      const f = __getGlobalSchemaField(this.type.globalType);
      if (f && f.format) {
        return f.format(val);
      }
      return val;
    }
    return val;
  }
}

export class StringEnumField extends EnumField {}

export interface PolymorphicStringEnumOptions extends EnumOptions {
  parentFieldToValidate: string;
}

export interface StringEnumOptions extends EnumOptions {}

export function EnumType(options: StringEnumOptions): EnumField {
  let result = new StringEnumField(options);
  return Object.assign(result, options);
}

declare type IntEnumMap = {
  [key: string]: number;
};

export interface IntegerEnumOptions extends FieldOptions {
  // used when we're migrating from old -> new values and want to reuse the values but the values may not be the best keys so this is preferred
  // instead of values.
  // GRAPHQL will take the key and use it as the value here instead o
  map?: IntEnumMap;
  deprecated?: IntEnumMap;

  // by default the type is the name as the field
  // it's recommended to scope the enum names in scenarios where it makes sense
  tsType?: string;
  graphQLType?: string;

  // if set to true, we don't add an `UNKNOWN` or `Unknown` type to deal with invalid|deprecated|old types
  // coming from the db.
  // GraphQL is strict about old values so we are adding this
  disableUnknownType?: boolean;

  // TODO would be nice for typescript to make tsType and graphQLType required
  // when globalType is set
  // hard to do that because FieldOptions allows any field so disjoint `|` types don't work
  globalType?: string;
}

export class IntegerEnumField extends BaseField implements Field {
  type: Type;
  private map: IntEnumMap;

  constructor(options: IntegerEnumOptions) {
    super();
    this.type = {
      dbType: DBType.IntEnum,
      intEnumMap: options.map,
      type: options.tsType,
      graphQLType: options.graphQLType,
      deprecatedIntEnumMap: options.deprecated,
      disableUnknownType: options.disableUnknownType,
      globalType: options.globalType,
    };

    if (options.foreignKey) {
      throw new Error(`foreignKey on intEnum not supported`);
    }

    if (options.globalType) {
      if (options.map) {
        throw new Error(`cannot specify map and globalType`);
      }
      this.map = {};
    } else {
      let count = 0;
      for (const _ in options.map) {
        count++;
        break;
      }
      if (!count) {
        throw new Error("need at least one entry in enum map");
      }
      if (!options.map) {
        throw new Error("map required if not globalType");
      }
      this.map = options.map!;
    }
  }

  async valid(val: any): Promise<boolean> {
    if (this.type?.globalType) {
      const f = __getGlobalSchemaField(this.type.globalType);
      if (f) {
        if (f.valid) {
          return f.valid(val);
        }
        return true;
      } else {
        log(
          "error",
          `globalType ${this.type.globalType} not found in global schema`,
        );
        return false;
      }
    }

    // lookup table enum and indicated via presence of foreignKey

    for (const k in this.map) {
      const v = this.map[k];
      if (v === val || v === parseInt(val)) {
        return true;
      }
    }
    return false;
  }

  format(val: any): any {
    if (this.type.globalType) {
      const f = __getGlobalSchemaField(this.type.globalType);
      if (f && f.format) {
        return f.format(val);
      }
    }

    return parseInt(val);
  }
}

export function IntegerEnumType(options: IntegerEnumOptions): IntegerEnumField {
  let result = new IntegerEnumField(options);
  return Object.assign(result, options);
}

interface ListOptions extends FieldOptions {
  disableJSONStringify?: boolean;
}

export class ListField extends BaseField {
  type: Type;
  private validators: { (val: any[]): boolean }[] = [];

  constructor(
    private field: Field,
    private options?: ListOptions,
  ) {
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

  __getElemField() {
    return this.field;
  }

  validate(validator: (val: any[]) => boolean): this {
    this.validators.push(validator);
    return this;
  }

  async valid(val: any) {
    if (!Array.isArray(val)) {
      return false;
    }
    for (const validator of this.validators) {
      if (!validator(val)) {
        return false;
      }
    }
    const valid = this.field.valid;
    if (!valid) {
      return true;
    }
    const res = valid.apply(this.field, [val[0]]);
    if (isPromise(res)) {
      const ret = await Promise.all(
        val.map(async (v) => await valid.apply(this.field, [v])),
      );
      return ret.every((v) => v);
    }
    const ret = val.map((v) => valid.apply(this.field, [v]));
    const result = ret.every((v) => v);
    return result;
  }

  private postgresVal(val: any, jsonType?: boolean) {
    if (!jsonType && val === "") {
      // support empty strings in list
      val = '"' + val + '"';
      return val;
    }
    if (this.options?.disableJSONStringify) {
      return val;
    }
    return JSON.stringify(val);
  }

  format(val: any, nested?: boolean): any {
    if (!Array.isArray(val)) {
      throw new Error(`need an array to format`);
    }

    const elemDBType = this.type.listElemType!.dbType;
    const jsonType = elemDBType === "JSON" || elemDBType === "JSONB";
    // postgres ish doesn't apply when nested
    const postgres = !nested && DB.getDialect() === Dialect.Postgres;

    if (nested && !this.field.format) {
      return val;
    }

    if (!postgres && !this.field.format) {
      return JSON.stringify(val);
    }

    let ret: any[] = [];
    let postgresRet: string = "{";
    for (let i = 0; i < val.length; i++) {
      let formatted = val[i];
      if (this.field.format) {
        formatted = this.field.format(val[i], nested);
      }

      // postgres supports arrays natively so we
      // structure it in the expected format
      if (postgres) {
        postgresRet += this.postgresVal(formatted, jsonType);
        if (i !== val.length - 1) {
          postgresRet += ",";
        }
      } else {
        ret[i] = formatted;
      }
    }
    if (postgres) {
      return postgresRet + "}";
    }
    // don't JSON.stringify if nested
    if (nested) {
      return ret;
    }
    return JSON.stringify(ret);
  }

  minLen(l: number): this {
    return this.validate((val: any[]) => val.length >= l);
  }

  maxLen(l: number): this {
    return this.validate((val: any[]) => val.length <= l);
  }

  length(l: number): this {
    return this.validate((val: any[]) => val.length === l);
  }

  // like python's range() function
  // start is where to start and stop is the number to stop (not inclusive in the range)
  range(start: any, stop: any): this {
    return this.validate((val: any[]) => {
      for (const v of val) {
        if (v < start || v >= stop) {
          return false;
        }
      }
      return true;
    });
  }
}

export function StringListType(options?: StringOptions) {
  return new ListField(StringType(options), options);
}

export function IntListType(options?: FieldOptions) {
  return new ListField(IntegerType(options), options);
}

export function IntegerListType(options?: FieldOptions) {
  return new ListField(IntegerType(options), options);
}

export function FloatListType(options?: FieldOptions) {
  return new ListField(FloatType(options), options);
}

export function BigIntegerListType(options: FieldOptions) {
  return new ListField(BigIntegerType(options), options);
}

export function BooleanListType(options?: FieldOptions) {
  return new ListField(BooleanType(options), options);
}

export function TimestampListType(options: TimestampOptions) {
  return new ListField(TimestampType(options), options);
}

export function TimestamptzListType(options?: TimestampOptions) {
  return new ListField(TimestamptzType(options), options);
}

export function TimeListType(options?: TimeOptions) {
  return new ListField(TimeType(options), options);
}

export function TimetzListType(options: TimeOptions) {
  return new ListField(TimetzType(options), options);
}

export function DateListType(options?: FieldOptions) {
  return new ListField(DateType(options), options);
}

export function EnumListType(options: StringEnumOptions) {
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

export function IntegerEnumListType(options: IntegerEnumOptions) {
  // not all of these will make sense in a list...
  // can make it work eventually but involves work we're not currently trying to do
  // developer can try to work around it by calling below on their own.
  // unclear what the behavior is
  return new ListField(IntegerEnumType(options), options);
}

export function UUIDListType(options?: FieldOptions) {
  return new ListField(UUIDType(options), {
    ...options,
    disableJSONStringify: true,
  });
}
