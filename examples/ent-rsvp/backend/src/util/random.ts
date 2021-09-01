export function random(): string {
  return Math.random().toString(16).substring(2);
}

export function randomEmail(domain?: string): string {
  domain = domain || "email.com";

  return `test+${random()}@${domain}`;
}
