import * as fs from "fs";
import JSON5 from "json5";
import ts from "typescript";
import * as path from "path";

function findTSConfigFile(filePath: string): string | null {
  while (filePath != "/") {
    let configPath = `${filePath}/tsconfig.json`;
    if (fs.existsSync(configPath)) {
      return configPath;
    }
    filePath = path.join(filePath, "..");
  }
  return null;
}

export function readCompilerOptions(filePath: string) {
  let configPath = findTSConfigFile(filePath);
  if (!configPath) {
    return {};
  }

  let json: any = {};
  try {
    json = JSON5.parse(
      fs.readFileSync(configPath, {
        encoding: "utf8",
      }),
    );
  } catch (e) {
    console.error("couldn't read tsconfig.json file");
  }
  let options: ts.CompilerOptions = json["compilerOptions"] || {};
  // @ts-ignore
  if (options.moduleResolution === "node") {
    options.moduleResolution = ts.ModuleResolutionKind.NodeJs;
  }
  return options;
}
