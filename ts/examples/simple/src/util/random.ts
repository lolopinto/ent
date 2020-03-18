export function randomEmail(): string {
  const rand = Math.random()
    .toString(16)
    .substring(2);

  return `test+${rand}@email.com`;
}
