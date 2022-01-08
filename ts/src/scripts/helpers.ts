import * as fs from "fs";
import JSON5 from "json5";
import ts from "typescript";

export function readCompilerOptions() {
  let json: any = {};
  try {
    json = JSON5.parse(
      fs.readFileSync("./tsconfig.json", {
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
