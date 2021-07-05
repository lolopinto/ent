import {
  Type,
  DBType,
  Field,
  FieldOptions,
  BaseField,
  ListField,
} from "@snowtop/ent/schema";

import {
  CountryCode,
  NumberFormat,
  PhoneNumber as LibPhoneNumber,
  parsePhoneNumberFromString,
  FormatNumberOptions,
} from "libphonenumber-js";

export class PhoneNumber extends BaseField implements Field {
  type: Type = { dbType: DBType.String };

  private _region: CountryCode = "US";
  private _format: NumberFormat = "E.164";
  private _formatOptions: FormatNumberOptions | undefined;
  private _numbers: Map<string, LibPhoneNumber> = new Map();

  // This calls isPossible() by default and doesn't call isValid() by default
  // Provides a way to change the default behavior
  // Also provides a way to validate the number by taking the instance of LibPhoneNumber
  private _validateForRegion: boolean = true;
  private _validate: boolean = false;

  private validators: { (number: LibPhoneNumber): boolean }[] = [];

  countryCode(region: CountryCode): this {
    this._region = region;
    return this;
  }

  numberFormat(
    format: NumberFormat,
    formatOptions?: FormatNumberOptions,
  ): this {
    this._format = format;
    this._formatOptions = formatOptions;
    return this;
  }

  // validate that the number is possible
  validateForRegion(valid: boolean): this {
    this._validateForRegion = valid;
    return this;
  }

  validateNumber(valid: boolean): this {
    this._validate = valid;
    return this;
  }

  validate(validator: (number: LibPhoneNumber) => boolean): this {
    this.validators.push(validator);
    return this;
  }

  valid(val: any): boolean {
    const phoneNumber = parsePhoneNumberFromString(val, this._region);
    if (!phoneNumber) {
      return false;
    }

    // TODO isNonGeographic too?
    // /console.log(phoneNumber.isPossible(), phoneNumber.isNonGeographic());

    if (this._validateForRegion && !phoneNumber.isPossible()) {
      return false;
    }

    if (this._validate && !phoneNumber.isValid()) {
      return false;
    }

    for (const validator of this.validators) {
      if (!validator(phoneNumber)) {
        return false;
      }
    }

    this._numbers.set(val, phoneNumber);
    return true;
  }

  format(val: any) {
    const number = this._numbers.get(val);
    if (!number) {
      throw new Error(`need a valid number to format it`);
    }
    return number.format(this._format, this._formatOptions);
  }
}

export function PhoneNumberType(options: FieldOptions): PhoneNumber {
  let result = new PhoneNumber();
  return Object.assign(result, options);
}

export function PhoneNumberListType(options: FieldOptions) {
  return new ListField(PhoneNumberType(options), options);
}
