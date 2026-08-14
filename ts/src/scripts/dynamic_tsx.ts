import { fileURLToPath } from "node:url";

export function getDynamicTypeScriptCommand(
  filePath: string,
  runtime: "node" | "bun",
): {
  command: string;
  args: string[];
} {
  if (runtime === "bun") {
    return {
      command: "bun",
      args: [filePath],
    };
  }
  return {
    command: process.execPath,
    args: [fileURLToPath(new URL("./run_tsx.js", import.meta.url)), filePath],
  };
}
