export function randomEmail(domain?: string): string {
  domain = domain || "email.com";
  const rand = Math.random()
    .toString(16)
    .substring(2);

  return `test+${rand}@${domain}`;
}
