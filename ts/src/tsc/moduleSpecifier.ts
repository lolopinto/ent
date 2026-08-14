export function normalizeModuleSpecifierPath(value: string): string {
  return value.replace(/\\/g, "/");
}
