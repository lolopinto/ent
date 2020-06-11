import { Type, DBType, Field, FieldOptions } from "./../schema";
import { BaseField, String } from "./../field";
import phonenumber, {
  CountryCode,
  NumberFormat,
  PhoneNumber as LibPhoneNumber,
} from "libphonenumber-js";
import { FormatNumberOptions } from "libphonenumber-js/types";

// TODO this should be in ent-phonenumber eventually

export class PhoneNumber extends BaseField {
  private _region: CountryCode = "US";
  private _format: NumberFormat = "E.164";
  private _formatOptions: FormatNumberOptions | undefined;
  private _number: LibPhoneNumber | undefined;
  private _validateForRegion: boolean;

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

  valid(val: any): boolean {
    const phoneNumber = phonenumber.parsePhoneNumberFromString(
      val,
      this._region,
    );
    if (!phoneNumber) {
      return false;
    }

    // not validating validity because needed for tests
    // TODO: need to add an option for this
    // TODO isNonGeographic too?
    // /console.log(phoneNumber.isPossible(), phoneNumber.isNonGeographic());

    if (this._validateForRegion && !phoneNumber.isPossible()) {
      return false;
    }
    this._number = phoneNumber;
    return true;
  }

  format(_val: any) {
    if (!this._number) {
      throw new Error(`need a valid number to format it`);
    }
    return this._number.format(this._format, this._formatOptions);
  }
}

export function PhoneNumberType(options: FieldOptions): PhoneNumber {
  let result = new PhoneNumber();
  return Object.assign(result, options);
}
