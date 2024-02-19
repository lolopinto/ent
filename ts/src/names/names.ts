import { camelCase } from "camel-case";
import { pascalCase } from "pascal-case";
import { snakeCase } from "snake-case";

// TODO tests and update functionality to match golang

export function toDBColumnOrTable(...strs: string[]): string {
  let name = "";
  for (let i = 0; i < strs.length; i++) {
    const s = strs[i];
    name += snakeCase(s);
    if (i !== strs.length - 1) {
      name += "_";
    }
  }
  return name;
}

export function toFilePath(s: string): string {
  return snakeCase(s);
}

export function toFieldName(...strs: string[]): string {
  let name = "";
  let hasDoneLower = false;

  for (const s of strs) {
    if (!hasDoneLower) {
      name += camelCase(s);
      hasDoneLower = true;
    } else {
      name += pascalCase(s);
    }
  }
  return name;
}

export function toClassName(str: string): string {
  return pascalCase(str);
}
