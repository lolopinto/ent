import { parseCustomInput } from "./imports/";
import * as path from "path";

if (process.argv.length !== 4) {
  throw new Error("invalid args");
}

const args = process.argv.slice(2);
if (args[0] !== "--path") {
  throw new Error("invalid args");
}

const filePath = path.join(args[1], "graphql");
const result = parseCustomInput(filePath, {
  ignore: ["**/generated/**", "**/tests/**"],
});
console.log(result.getInfoForClass("AuthResolver"));
