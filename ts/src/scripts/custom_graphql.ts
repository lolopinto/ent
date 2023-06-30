#!/usr/bin/env node

import * as glob from "glob";
import JSON5 from "json5";
import minimist from "minimist";
import * as path from "path";
import * as fs from "fs";
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
import { parseCustomImports, file } from "../imports";
import { exit } from "process";
import { Data } from "../core/base";
import { spawn } from "child_process";
import { GRAPHQL_PATH } from "../core/const";

// need to use the GQLCapture from the package so that when we call GQLCapture.enable()
// we're affecting the local paths as opposed to a different instance
// life is hard
const MODULE_PATH = GRAPHQL_PATH;

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

function transformArgs(f: any, gqlCapture: typeof GQLCapture) {
  return (f.args || []).map((v: any) => {
    const ret = {
      ...v,
    };
    // duplicated from getType in graphql.ts
    if (isCustomType(ret.type)) {
      ret.type = v.type.type;
      addCustomType(v.type, gqlCapture);
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
          connection: f.connection,
          nullable: f.nullable,
        },
      ]
    : [];
}

function processTopLevel(
  l: any[],
  l2: CustomQuery[],
  gqlCapture: typeof GQLCapture,
) {
  for (const custom of l) {
    l2.push({
      nodeName: custom.class,
      functionName: custom.functionName || custom.name,
      gqlName: custom.graphQLName || custom.name,
      edgeName: custom.edgeName,
      fieldType: custom.fieldType,
      args: transformArgs(custom, gqlCapture),
      results: transformResultType(custom),
      description: custom.description,
      extraImports: custom.extraImports,
      functionContents: custom.functionContents,
    });
  }
}

function processCustomTypes(m: {}, gqlCapture: typeof GQLCapture) {
  for (const k in m) {
    addCustomType(m[k], gqlCapture);
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
      args: transformArgs(f, gqlCapture),
      results: transformResultType(f),
      description: f.description,
    });
  }
  m.set(nodeName, results);
}

async function captureDynamic(filePath: string, gqlCapture: typeof GQLCapture) {
  if (!filePath) {
    return;
  }
  return await new Promise((resolve, reject) => {
    let cmd = "";
    const args: string[] = [];
    const env = {
      ...process.env,
    };
    // really only exists if there's a bug with swc or something. we should almost always be using swc
    if (process.env.DISABLE_SWC) {
      cmd = "ts-node";
      args.push("--transpileOnly");
    } else {
      cmd = "node";
      // we seem to get tsconfig-paths by default because child process but not 100% sure...
      args.push("-r", "@swc-node/register");
      env.SWCRC = "true";
    }
    args.push(filePath);
    const r = spawn(cmd, args, {
      env,
    });

    const datas: string[] = [];
    r.stdout.on("data", (data) => {
      datas.push(data.toString());
    });

    r.stderr.on("data", (data) => {
      reject(new Error(data.toString()));
    });

    r.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`error code ${code} on dynamic path`));
        return;
      }

      let json = JSON5.parse(datas.join(""));

      processJSON(gqlCapture, json);

      resolve(undefined);
    });
  });
}

async function processJSON(gqlCapture: typeof GQLCapture, json: any) {
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
    processTopLevel(json.queries, gqlCapture.getCustomQueries(), gqlCapture);
  }
  if (json.mutations) {
    processTopLevel(
      json.mutations,
      gqlCapture.getCustomMutations(),
      gqlCapture,
    );
  }
  if (json.customTypes) {
    processCustomTypes(json.customTypes, gqlCapture);
  }
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

    processJSON(gqlCapture, json);

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

// filePath is path-to-src
async function parseImports(filePath: string) {
  return parseCustomImports(filePath, [
    {
      // graphql files
      root: path.join(filePath, "graphql"),
      opts: {
        ignore: ["**/generated/**", "**/tests/**"],
      },
    },
    {
      // can't just use top level ent files but have to check for all (non-generated) files
      // in src/ent/* because custom edges (or other things) could have @gqlField etc
      // and then have to look for these imports etc
      root: path.join(filePath, "ent"),
      opts: {
        // not in action files since we can't customize payloads (yet?)
        ignore: ["**/generated/**", "**/tests/**", "**/actions/**"],
      },
    },
  ]);
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

// test as follows:
// there should be an easier way to do this...
// also, there should be a way to get the list of objects here that's not manual
//echo "User\nContact\nContactEmail\nComment" | ts-node-script --log-error --project ./tsconfig.json -r tsconfig-paths/register ../../ts/src/scripts/custom_graphql.ts --path ~/code/ent/examples/simple/src/
async function main() {
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

  // known custom types that are not required
  // if not in the schema, will be ignored
  // something like GraphQLUpload gotten via gqlArg({type: gqlFileUpload})
  // these 2 need this because they're added by the schema
  // if this list grows too long, need to build this into golang types and passed here

  // TODO foreign non-scalars eventually
  addCustomType(
    {
      importPath: MODULE_PATH,
      // for go tests...
      // TODO need a flag that only does this for go tests
      // breaks when running locally sometimes...
      secondaryImportPath: "../graphql/scalars/time",
      type: "GraphQLTime",
    },
    gqlCapture,
  );
  addCustomType(
    {
      importPath: "graphql-type-json",
      type: "GraphQLJSON",
    },
    gqlCapture,
  );

  const [inputsRead, _, __, imports] = await Promise.all([
    readInputs(),
    captureCustom(options.path, options.files, options.json_path, gqlCapture),
    captureDynamic(options.dynamic_path, gqlCapture),
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
  let interfaces = fromMap(gqlCapture.getCustomInterfaces());
  let unions = fromMap(gqlCapture.getCustomUnions());
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
      if (field.nodeName && !nodesMap.has(field.nodeName)) {
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
  // call for every field in a node
  for (const k in fields) {
    buildClasses(fields[k]);
  }

  console.log(
    JSON.stringify({
      args,
      inputs,
      fields,
      queries,
      mutations,
      classes,
      objects,
      interfaces,
      unions,
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
