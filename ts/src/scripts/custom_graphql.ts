import glob from "glob";
import minimist from "minimist";
import {
  GQLCapture,
  ProcessedField,
  ProcessedCustomField,
  CustomObject,
} from "../graphql";
import * as readline from "readline";
import * as path from "path";
import { parseCustomInput, file } from "../imports";
import { argsToArgsConfig } from "graphql/type/definition";

GQLCapture.enable(true);

async function readInputs(): Promise<string[]> {
  return await new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      //  output: process.stdout,
      terminal: false,
    });
    let nodes: string[] = [];
    rl.on("line", function(line: string) {
      nodes.push(line);
    });

    rl.on("close", function() {
      return resolve(nodes);
    });
  });
}

async function captureCustom(filePath: string) {
  // TODO configurable paths...
  // for now only ent/**/
  // TODO we can probably be even smarter here but this is fine for now
  // and then it'll be graphql/custom or something
  const entFiles = glob.sync(path.join(filePath, "/ent/**/*.ts"), {
    // no actions for now to speed things up
    ignore: ["**/generated/**", "**/tests/**", "**/actions/**"],
  });
  const graphqlFiles = glob.sync(path.join(filePath, "/graphql/**/*.ts"), {
    // no actions for now to speed things up
    // no index.ts (need a better way to explicitly ignore specific files)
    ignore: ["**/generated/**", "**/tests/**", "**/index.ts"],
  });
  const files = [...entFiles, ...graphqlFiles];
  //  console.log(files);
  let promises: any[] = [];
  files.forEach((file) => {
    promises.push(require(file));
  });

  await Promise.all(promises);
}

async function parseImports(filePath: string) {
  // only do graphql files...
  return parseCustomInput(path.join(filePath, "graphql"), {
    ignore: ["**/generated/**", "**/tests/**"],
  });
}

async function main() {
  const options = minimist(process.argv.slice(2));

  if (!options.path) {
    throw new Error("path required");
  }
  const [nodes, _, imports] = await Promise.all([
    readInputs(),
    captureCustom(options.path),
    parseImports(options.path),
  ]);

  const fromMap = (m: Map<string, CustomObject>) => {
    let result = {};
    for (const [key, value] of m) {
      result[key] = value;
    }
    return result;
  };
  GQLCapture.resolve(nodes);

  let args = fromMap(GQLCapture.getCustomArgs());
  let inputs = fromMap(GQLCapture.getCustomInputObjects());
  let fields = GQLCapture.getProcessedCustomFields();
  let queries = GQLCapture.getProcessedCustomQueries();
  let mutations = GQLCapture.getProcessedCustomMutations();
  let objects = fromMap(GQLCapture.getCustomObjects());

  let classes = {};
  let allFiles = {};

  const buildClasses2 = (args: ProcessedField[]) => {
    args.forEach((arg) => {
      if (arg.isContextArg) {
        return;
      }
      let files = imports.m.get(arg.type);
      if (files?.length !== 1) {
        return;
      }
      let file = files[0];
      let classInfo = file.classes.get(arg.type);
      classes[arg.type] = { ...classInfo, path: file.path };

      buildFiles(file);
    });
  };

  // gather imports from files...
  // format is more compact as needed
  const buildFiles = (f: file) => {
    if (allFiles[f.path]) {
      return;
    }
    let imps = {};
    for (const [key, value] of f.imports) {
      imps[key] = {
        path: value.importPath,
      };
      if (value.defaultImport) {
        imps[key].defaultImport = true;
      }
    }
    allFiles[f.path] = {
      imports: imps,
    };
  };

  const buildClasses = (fields: ProcessedCustomField[]) => {
    fields.forEach((field) => {
      let info = imports.getInfoForClass(field.nodeName);
      classes[field.nodeName] = { ...info.class, path: info.file.path };

      buildClasses2(field.args);
      buildClasses2(field.results);
      buildFiles(info.file);
    });
  };
  buildClasses(mutations);
  buildClasses(queries);

  console.log(
    JSON.stringify({
      args,
      inputs,
      fields,
      queries,
      mutations,
      classes,
      objects,
      files: allFiles,
    }),
  );
}

Promise.resolve(main());
