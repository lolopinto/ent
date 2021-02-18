#!/usr/bin/env node

import glob from "glob";
import minimist from "minimist";
import {
  // can use the local interfaces since it's just the API we're getting from here
  ProcessedField,
  ProcessedCustomField,
  CustomObject,
} from "../graphql/graphql";
import * as readline from "readline";
import * as path from "path";
import * as fs from "fs";
import { parseCustomInput, file } from "../imports";

// need to use the GQLCapture from the package so that when we call GQLCapture.enable()
// we're affecting the local paths as opposed to a different instance
// life is hard
const MODULE_PATH = "@lolopinto/ent/graphql";

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
  //console.log(files);

  let promises: any[] = [];
  files.forEach((file) => {
    if (fs.existsSync(file)) {
      promises.push(require(file));
    }
  });

  await Promise.all(promises);
}

async function parseImports(filePath: string) {
  // only do graphql files...
  return parseCustomInput(path.join(filePath, "graphql"), {
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
