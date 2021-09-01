import { parsePhoneNumberFromString } from "libphonenumber-js";

export function random(): string {
  return Math.random().toString(16).substring(2);
}

export function randomEmail(domain?: string): string {
  domain = domain || "email.com";

  return `test+${random()}@${domain}`;
}

export function randomPhoneNumber(): string {
  const phone = Math.random().toString(10).substring(2, 12);
  const phoneNumber = parsePhoneNumberFromString(phone, "US");
  return phoneNumber!.format("E.164");
}
