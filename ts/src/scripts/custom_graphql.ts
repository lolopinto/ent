#!/usr/bin/env node

import glob from "glob";
import JSON5 from "json5";
import minimist from "minimist";
import {
  // can use the local interfaces since it's just the API we're getting from here
  ProcessedField,
  ProcessedCustomField,
  addCustomType,
  CustomObject,
  CustomQuery,
  CustomField,
  knownAllowedNames,
  isCustomType,
} from "../graphql/graphql";
import type { GQLCapture } from "../graphql/graphql";
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

function processCustomObjects(
  l: any[],
  gqlCapture: typeof GQLCapture,
  input?: boolean,
) {
  let m: Map<string, CustomObject>;
  if (input) {
    m = gqlCapture.getCustomInputObjects();
  } else {
    m = gqlCapture.getCustomObjects();
  }
  for (const input of l) {
    m.set(input.name, {
      nodeName: input.graphQLName || input.name,
      className: input.name,
    });
    if (input.fields) {
      processCustomFields(input.fields, gqlCapture, input.name);
    }
  }
}

function transformArgs(f: any) {
  return (f.args || []).map((v: any) => {
    const ret = {
      ...v,
    };
    // duplicated from getType in graphql.ts
    if (isCustomType(ret.type)) {
      ret.type = v.type.type;
      addCustomType(v.type);
    }
    // scalar types not supported for now
    ret.tsType = knownAllowedNames.get(v.type);
    return ret;
  });
}

function transformResultType(f: any) {
  return f.resultType
    ? [
        {
          name: "",
          type: f.resultType,
          tsType: knownAllowedNames.get(f.resultType),
          list: f.list,
          nullable: f.nullable,
        },
      ]
    : [];
}

function processTopLevel(l: any[], l2: CustomQuery[]) {
  for (const custom of l) {
    l2.push({
      nodeName: custom.class,
      functionName: custom.functionName || custom.name,
      gqlName: custom.graphQLName || custom.name,
      fieldType: custom.fieldType,
      args: transformArgs(custom),
      results: transformResultType(custom),
    });
  }
}

function processCustomFields(
  fields: any[],
  gqlCapture: typeof GQLCapture,
  nodeName: string,
) {
  const m = gqlCapture.getCustomFields();
  let results: CustomField[] = [];
  for (const f of fields) {
    results.push({
      nodeName: nodeName,
      gqlName: f.graphQLName || f.name,
      functionName: f.functionName || f.name,
      fieldType: f.fieldType,
      args: transformArgs(f),
      results: transformResultType(f),
    });
  }
  m.set(nodeName, results);
}

async function captureCustom(
  filePath: string,
  filesCsv: string | undefined,
  jsonPath: string | undefined,
  gqlCapture: typeof GQLCapture,
) {
  if (jsonPath !== undefined) {
    let json = JSON5.parse(
      fs.readFileSync(jsonPath, {
        encoding: "utf8",
      }),
    );
    if (json.fields) {
      for (const k in json.fields) {
        processCustomFields(json.fields[k], gqlCapture, k);
      }
    }
    if (json.inputs) {
      processCustomObjects(json.inputs, gqlCapture, true);
    }
    if (json.objects) {
      processCustomObjects(json.objects, gqlCapture);
    }
    if (json.queries) {
      processTopLevel(json.queries, gqlCapture.getCustomQueries());
    }
    if (json.mutations) {
      processTopLevel(json.mutations, gqlCapture.getCustomMutations());
    }

    return;
  }
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
  // known custom types that are not required
  // if not in the schema, will be ignored
  // something like GraphQLUpload gotten via gqlArg({type: gqlFileUpload})
  // these 2 need this because they're added by the schema
  // if this list grows too long, need to build this into golang types and passed here

  // TODO foreign non-scalars eventually
  addCustomType({
    importPath: MODULE_PATH,
    type: "GraphQLTime",
  });
  addCustomType({
    importPath: "graphql-type-json",
    type: "GraphQLJSON",
  });

  const options = minimist(process.argv.slice(2));

  if (!options.path) {
    throw new Error("path required");
  }

  const gqlPath = process.env.GRAPHQL_PATH || findGraphQLPath(options.path);
  if (!gqlPath) {
    throw new Error("could not find graphql path");
  }

  // use different variable  so that we use the correct GQLCapture as needed
  // for local dev, get the one from the file system. otherwise, get the one
  // from node_modules
  let gqlCapture: typeof GQLCapture;
  if (process.env.LOCAL_SCRIPT_PATH) {
    const r = require("../graphql/graphql");
    gqlCapture = r.GQLCapture;
  } else {
    const r = require(gqlPath);
    if (!r.GQLCapture) {
      throw new Error("could not find GQLCapture in module");
    }
    gqlCapture = r.GQLCapture;
    gqlCapture.enable(true);
  }

  const [inputsRead, _, imports] = await Promise.all([
    readInputs(),
    captureCustom(options.path, options.files, options.json_path, gqlCapture),
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
  gqlCapture.resolve(nodes);

  let args = fromMap(gqlCapture.getCustomArgs());
  let inputs = fromMap(gqlCapture.getCustomInputObjects());
  let fields = gqlCapture.getProcessedCustomFields();
  let queries = gqlCapture.getProcessedCustomQueries();
  let mutations = gqlCapture.getProcessedCustomMutations();
  let objects = fromMap(gqlCapture.getCustomObjects());
  let customTypes = fromMap(gqlCapture.getCustomTypes());

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
