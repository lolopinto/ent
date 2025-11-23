import { randomBytes } from "crypto";
export function random(): string {
  return Math.random().toString(16).substring(2);
}

export function randomEmail(domain?: string): string {
  domain = domain || "email.com";

  return `test+${random()}@${domain}`;
}

export function randomPhoneNumber(): string {
  // generate 12 digits from random bytes so we can safely carve out a NANP number
  const raw = randomBytes(5).readUIntBE(0, 5).toString().padStart(12, "0");
  const first = (parseInt(raw[0], 10) % 8) + 2; // ensure 2-9 for NANP area codes
  const areaCode = `${first}${raw[1]}${raw[2]}`;
  const localNumber = raw.slice(3, 10);
  return `+1${areaCode}${localNumber}`;
}
