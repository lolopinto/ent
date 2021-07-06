import {
  Type,
  DBType,
  Field,
  FieldOptions,
  BaseField,
  StringType,
  ListField,
} from "@snowtop/ent";
import email from "email-addresses";

function isParsedMailbox(
  mailboxOrGroup: email.ParsedMailbox | email.ParsedGroup,
): mailboxOrGroup is email.ParsedMailbox {
  return mailboxOrGroup.type === "mailbox";
}

export class Email extends BaseField implements Field {
  private _domain: string | undefined;

  // restrict to just this domain
  domain(domain: string): this {
    this._domain = domain;
    return this;
  }

  valid(val: any): boolean {
    const address = email.parseOneAddress(val);
    if (!address) {
      return false;
    }

    // don't support groups at the moment
    // not even sure how to do that
    if (!isParsedMailbox(address)) {
      return false;
    }
    if (this._domain && address.domain !== this._domain) {
      return false;
    }
    // address with name is not valid for storing. that's for email
    // can make this optional in the future
    return address.name === null;
  }

  format(val: any): any {
    // always trim and store in lowercase
    const type = StringType({ name: "s" }).toLowerCase().trim();
    return type.format(val);
  }

  type: Type = { dbType: DBType.String };
}

export function EmailType(options: FieldOptions): Email {
  let result = new Email();
  return Object.assign(result, options);
}

export function EmailListType(options: FieldOptions) {
  return new ListField(EmailType(options), options);
}
