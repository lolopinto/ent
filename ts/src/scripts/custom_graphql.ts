#!/usr/bin/env node

import glob from "glob";
import minimist from "minimist";
import {
  // can use the local interfaces since it's just the API we're getting from here
  ProcessedField,
  ProcessedCustomField,
} from "../graphql/graphql";
import * as readline from "readline";
import * as path from "path";
import * as fs from "fs";
import { parseCustomImports, file } from "../imports";
import { exit } from "process";
import { Data } from "../core/base";

// need to use the GQLCapture from the package so that when we call GQLCapture.enable()
// we're affecting the local paths as opposed to a different instance
// life is hard
const MODULE_PATH = "@snowtop/ent/graphql";

async function readInputs(): Promise<{
  nodes: string[];
  nodesMap: Map<string, boolean>;
}> {
  return await new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      //  output: process.stdout,
      terminal: false,
    });
    let nodes: string[] = [];
    let nodesMap: Map<string, boolean> = new Map();
    rl.on("line", function (line: string) {
      nodes.push(line);
      nodesMap.set(line, true);
    });

    rl.on("close", function () {
      return resolve({ nodes, nodesMap });
    });
  });
}

async function captureCustom(filePath: string, filesCsv: string | undefined) {
  if (filesCsv !== undefined) {
    let files = filesCsv.split(",");
    for (let i = 0; i < files.length; i++) {
      // TODO fix. we have "src" in the path we get here
      files[i] = path.join(filePath, "..", files[i]);
    }

    await requireFiles(files);
    return;
  }
  // TODO delete all of this eventually

  // TODO configurable paths eventually
  // for now only files that are in the include path of the roots are allowed

  const rootFiles = [
    // right now, currently expecting all custom ent stuff to be in the ent object
    // eventually, create a path we check e.g. ent/custom_gql/ ent/graphql?
    // for now can just go in graphql/resolvers/ (not generated)
    path.join(filePath, "ent/index.ts"),
    path.join(filePath, "/graphql/resolvers/index.ts"),
  ];

  const ignore = [
    "**/generated/**",
    "**/tests/**",
    "**/index.ts",
    "**/internal.ts",
    // ignore test files.
    "**/*.test.ts",
  ];
  const customGQLResolvers = glob.sync(
    path.join(filePath, "/graphql/resolvers/**/*.ts"),
    {
      // no actions for now to speed things up
      // no index.ts or internal file.
      ignore: ignore,
    },
  );
  const customGQLMutations = glob.sync(
    path.join(filePath, "/graphql/mutations/**/*.ts"),
    {
      // no actions for now to speed things up
      // no index.ts or internal file.
      ignore: ignore,
    },
  );
  const files = rootFiles.concat(customGQLResolvers, customGQLMutations);

  await requireFiles(files);
}

async function requireFiles(files: string[]) {
  await Promise.all(
    files.map(async (file) => {
      if (fs.existsSync(file)) {
        try {
          await require(file);
        } catch (e) {
          throw new Error(`${(e as Error).message} loading ${file}`);
        }
      } else {
        throw new Error(`file ${file} doesn't exist`);
      }
    }),
  ).catch((err) => {
    throw new Error(err);
  });
}

async function parseImports(filePath: string) {
  // only do graphql files...
  return parseCustomImports(path.join(filePath, "graphql"), {
    ignore: ["**/generated/**", "**/tests/**"],
  });
}

function findGraphQLPath(filePath: string): string | undefined {
  while (filePath !== "/") {
    const potentialPath = path.join(filePath, "node_modules");
    if (fs.existsSync(potentialPath)) {
      const graphqlPath = path.join(potentialPath, MODULE_PATH);
      if (fs.existsSync(graphqlPath)) {
        return graphqlPath;
      }
    }
    filePath = path.join(filePath, "..");
  }
  return undefined;
}

async function main() {
  const options = minimist(process.argv.slice(2));

  if (!options.path) {
    throw new Error("path required");
  }

  const gqlPath = process.env.GRAPHQL_PATH || findGraphQLPath(options.path);
  if (!gqlPath) {
    throw new Error("could not find graphql path");
  }
  const r = require(gqlPath);
  if (!r.GQLCapture) {
    throw new Error("could not find GQLCapture in module");
  }
  const GQLCapture = r.GQLCapture;
  GQLCapture.enable(true);

  const [inputsRead, _, imports] = await Promise.all([
    readInputs(),
    captureCustom(options.path, options.files),
    parseImports(options.path),
  ]);
  const { nodes, nodesMap } = inputsRead;

  function fromMap<T extends any>(m: Map<string, T>) {
    let result: Data = {};
    for (const [key, value] of m) {
      result[key] = value;
    }
    return result;
  }
  GQLCapture.resolve(nodes);

  let args = fromMap(GQLCapture.getCustomArgs());
  let inputs = fromMap(GQLCapture.getCustomInputObjects());
  let fields = GQLCapture.getProcessedCustomFields();
  let queries = GQLCapture.getProcessedCustomQueries();
  let mutations = GQLCapture.getProcessedCustomMutations();
  let objects = fromMap(GQLCapture.getCustomObjects());
  let customTypes = fromMap(GQLCapture.getCustomTypes());

  let classes: Data = {};
  let allFiles: Data = {};

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
    let imps: Data = {};
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
      if (!nodesMap.has(field.nodeName)) {
        let info = imports.getInfoForClass(field.nodeName);
        classes[field.nodeName] = { ...info.class, path: info.file.path };
        buildFiles(info.file);
      }

      buildClasses2(field.args);
      buildClasses2(field.results);
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
      customTypes,
    }),
  );
}

main()
  .then()
  .catch((err) => {
    console.error(err);
    exit(1);
  });
