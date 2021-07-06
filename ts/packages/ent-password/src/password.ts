import {
  Type,
  DBType,
  Field,
  FieldOptions,
  BaseField,
  StringField,
  StringType,
} from "@snowtop/ent/schema";

import * as bcrypt from "bcryptjs";

export class Password extends BaseField implements Field {
  type: Type = { dbType: DBType.String };
  private _cost: number | undefined;
  private stringType: StringField;

  // hardcode password to be private and hidden from graphql by default
  private = true;
  hideFromGraphQL = true;
  // indicate sensitive so that we don't log the value of the password
  sensitive = true;

  constructor() {
    super();
    this.stringType = StringType({ name: "field" });
  }

  cost(cost: number): this {
    this._cost = cost;
    return this;
  }

  minLen(length: number): this {
    this.stringType.minLen(length);
    return this;
  }

  maxLen(length: number): this {
    this.stringType.maxLen(length);
    return this;
  }

  length(length: number): this {
    this.stringType.length(length);
    return this;
  }

  match(pattern: string | RegExp): this {
    this.stringType.match(pattern);
    return this;
  }

  doesNotMatch(pattern: string | RegExp): this {
    this.stringType.doesNotMatch(pattern);
    return this;
  }

  validate(validator: (str: string) => boolean): this {
    this.stringType.validate(validator);
    return this;
  }

  async format(val: any): Promise<any> {
    // apply any string based formatting
    val = this.stringType.format(val);

    let salt = await bcrypt.genSalt(this._cost);
    return await bcrypt.hash(val, salt);
  }

  valid(val: any): boolean {
    // default to string validation
    return this.stringType.valid(val);
  }
}

export function PasswordType(options: FieldOptions): Password {
  let result = new Password();
  return Object.assign(result, options);
}
