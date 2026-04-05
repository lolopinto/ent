// NB: this is copied from ent-graphql-tests package until I have time to figure out how to share code here effectively
// the circular dependencies btw this package and ent-graphql-tests seems to imply something needs to change
import express, { Express, RequestHandler } from "express";
import * as fs from "fs";
import {
  GraphQLArgument,
  GraphQLField,
  GraphQLFieldMap,
  GraphQLList,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLType,
  isEnumType,
  isScalarType,
  isWrappingType,
} from "graphql";
import {
  ExecutionContext,
  getGraphQLParameters,
  processRequest,
  sendResult,
} from "graphql-helix";
import { IncomingHttpHeaders } from "http";
import supertest from "supertest";
import { inspect } from "util";
import { buildContext, registerAuthHandler } from "../../auth";
import { Viewer } from "../../core/base";

function server(config: queryConfig): Express {
  const viewer = config.viewer;
  if (viewer) {
    registerAuthHandler("viewer", {
      authViewer: async (_context) => {
        // TODO we want to use Context here in tests to get caching etc
        return viewer;
      },
    });
  }
  let app = express();
  if (config.init) {
    config.init(app);
  }
  // @ts-ignore something changed. come back
  app.use(express.json());

  let handlers = config.customHandlers || [];
  handlers.push(async (req, res) => {
    const { operationName, query, variables } = getGraphQLParameters(req);
    const result = await processRequest({
      operationName,
      query,
      variables,
      request: req,
      schema: config.schema,
      contextFactory: async (executionContext: ExecutionContext) => {
        // @ts-ignore something changed. come back
        return buildContext(req, res);
      },
    });
    // @ts-ignore something changed. come back
    await sendResult(result, res);
  });
  app.use(config.graphQLPath || "/graphql", ...handlers);

  return app;
}

function getInnerType(typ, list) {
  if (isWrappingType(typ)) {
    if (typ instanceof GraphQLList) {
      return getInnerType(typ.ofType, true);
    }
    return getInnerType(typ.ofType, list);
  }
  return [typ, list];
}

function makeGraphQLRequest(
  config: queryConfig,
  query: string,
  fieldArgs: Readonly<GraphQLArgument[]>,
): [supertest.Agent, supertest.Test] {
  let agent: supertest.Agent;

  if (config.test) {
    if (typeof config.test === "function") {
      agent = config.test(config.server ? config.server : server(config));
    } else {
      agent = config.test;
    }
  } else {
    agent = supertest(config.server ? config.server : server(config));
  }

  let files = new Map();

  // handle files
  fieldArgs.forEach((fieldArg) => {
    let [typ, list] = getInnerType(fieldArg.type, false);

    if (typ instanceof GraphQLScalarType && typ.name == "Upload") {
      let value = config.args[fieldArg.name];
      if (list) {
        expect(Array.isArray(value)).toBe(true);
        // clone if we're going to make changes
        value = [...value];

        for (let i = 0; i < value.length; i++) {
          files.set(`${fieldArg.name}.${i}`, value[i]);
          value[i] = null;
        }
        config.args[fieldArg.name] = value;
      } else {
        files.set(fieldArg.name, value);
        config.args[fieldArg.name] = null;
      }
    }
  });

  let variables = {
    ...config.args,
  };
  for (const k in config.extraVariables) {
    variables[k] = config.extraVariables[k].value;
  }

  if (files.size) {
    let ret = agent
      .post(config.graphQLPath || "/graphql")
      .set((config.headers || {}) as IncomingHttpHeaders);

    ret.field(
      "operations",
      JSON.stringify({
        query: query,
        variables: variables,
      }),
    );

    let m = {};
    let idx = 0;
    for (const [key] of files) {
      m[idx] = [`variables.${key}`];
      idx++;
    }

    ret.field("map", JSON.stringify(m));

    idx = 0;
    for (let [key, val] of files) {
      if (typeof val === "string") {
        val = fs.createReadStream(val);
      }
      ret.attach(`${idx}`, val, key);
      idx++;
    }

    return [agent, ret];
  } else {
    return [
      agent,
      agent
        .post(config.graphQLPath || "/graphql")
        .set((config.headers || {}) as IncomingHttpHeaders)
        .send({
          query: query,
          variables: JSON.stringify(variables),
        }),
    ];
  }
}

function buildTreeFromQueryPaths(
  schema: GraphQLSchema,
  fieldType: GraphQLType,
  ...options: Option[]
) {
  let fields: GraphQLFieldMap<any, any>;
  const [typ] = getInnerType(fieldType, false);
  if (typ instanceof GraphQLObjectType) {
    fields = typ.getFields();
  }
  let topLevelTree = {};
  options.forEach((option) => {
    let path = option[0];
    let parts: string[] = [];
    let match = fragmentRegex.exec(path);
    if (match) {
      // fragment, keep the part of the fragment e.g. `...on User`, and then split the rest....
      parts = [match[0], ...match[2].split(".")];

      const typ = schema.getType(match[1]);
      if (!typ) {
        throw new Error(`can't find type for ${match[1]} in schema`);
      }
      if (typ instanceof GraphQLObjectType) {
        fields = typ.getFields();
      }
    } else {
      parts = splitPath(path);
    }

    let tree = topLevelTree;
    for (let i = 0; i < parts.length; i++) {
      let part = parts[i];
      // a list, remove the index in the list building part
      let idx = part.indexOf("[");
      if (idx !== -1) {
        part = part.substr(0, idx);
      }
      // if this part of the tree doesn't exist, put an empty node there
      if (tree[part] === undefined) {
        tree[part] = {};
      }
      if (part !== "") {
        tree = tree[part];
      }
      // TODO this needs to be aware of paths etc so this part works for complicated
      // cases but inlineFragmentRoot is a workaround for now.
      function handleSubtree(obj: {}, tree: {}, parts: string[]) {
        let parts2 = [...parts];
        if (Array.isArray(obj)) {
          for (const obj2 of obj) {
            handleSubtree(obj2, tree, parts2);
          }
          return;
        }
        for (const key in obj) {
          if (tree[key] === undefined) {
            tree[key] = {};
          }
          if (typeof obj[key] === "object") {
            let parts2 = [...parts, key];

            if (!scalarFieldAtLeaf(parts2)) {
              handleSubtree(obj[key], tree[key], parts2);
            }
          }
        }
      }

      function scalarFieldAtLeaf(pathFromRoot: string[]) {
        let root = fields;
        if (!root) {
          return false;
        }
        let subField: GraphQLField<any, any, any> | undefined;
        for (const p of pathFromRoot) {
          subField = root?.[p];
          if (subField) {
            [subField] = getInnerType(subField.type, false);
            if (subField instanceof GraphQLObjectType) {
              root = subField.getFields();
            }
          }
        }

        if (!subField) {
          return false;
        }
        return isScalarType(subField) || isEnumType(subField);
      }

      if (i === parts.length - 1 && typeof option[1] === "object") {
        if (!scalarFieldAtLeaf(parts)) {
          handleSubtree(option[1], tree, parts);
        }
      }
    }
  });
  return topLevelTree;
}

function constructQueryFromTreePath(treePath: {}) {
  let query: string[] = [];
  for (let key in treePath) {
    let value = treePath[key];
    let valueStr = constructQueryFromTreePath(value);
    if (!valueStr) {
      // leaf node
      query.push(key);
    } else {
      query.push(`${key}{${valueStr}}`);
    }
  }
  return query.join(",");
}

function expectQueryResult(
  schema: GraphQLSchema,
  fieldType: GraphQLType,
  ...options: Option[]
) {
  let topLevelTree = buildTreeFromQueryPaths(schema, fieldType, ...options);
  //  console.log(topLevelTree);

  let query = constructQueryFromTreePath(topLevelTree);

  //  console.log(query);
  return query;
}

export type Option = [string, any] | [string, any, string];

interface queryConfig {
  // if neither viewer nor init is passed, we end with a logged out viewer
  viewer?: Viewer;
  // to init express e.g. session, passport initialize etc
  init?: (app: Express) => void;
  test?: supertest.Agent | ((express: Express) => supertest.Agent);
  // TODO
  // if none indicated, defaults to logged out viewer
  schema: GraphQLSchema;
  headers?: object;
  debugMode?: boolean;
  args: {};
  // any variables in here get added to the query as `$foo`, in query you should use
  // $foo
  extraVariables?: {
    [key: string]: {
      graphqlType: string;
      value: string;
    };
  };
  expectedStatus?: number; // expected http status code
  expectedError?: string | RegExp; // expected error message
  // todo there can be more than one etc
  callback?: (res: supertest.Response) => void;
  inlineFragmentRoot?: string;
  customHandlers?: RequestHandler[];
  server?: any;
  graphQLPath?: string;
}

export interface queryRootConfig extends queryConfig {
  root: string;
  rootQueryNull?: boolean;
  nullQueryPaths?: string[];
  undefinedQueryPaths?: string[];
}

export async function expectQueryFromRoot(
  config: queryRootConfig,
  ...options: Option[] // TODO queries? expected values
): Promise<supertest.Agent> {
  return expectFromRoot(
    {
      ...config,
      queryPrefix: "query",
      querySuffix: "Query",
      queryFN: config.schema.getQueryType(),
    },
    ...options,
  );
}

export interface mutationRootConfig extends queryConfig {
  mutation: string;
  disableInputWrapping?: boolean;
  nullQueryPaths?: string[];
  //  rootQueryNull?: boolean;
}

export async function expectMutation(
  config: mutationRootConfig,
  ...options: Option[]
): Promise<supertest.Agent> {
  // wrap args in input because we simplify the args for mutations
  // and don't require the input
  let args = config.args;
  if (!config.disableInputWrapping) {
    args = {
      input: args,
    };
  }

  return expectFromRoot(
    {
      ...config,
      args: args,
      root: config.mutation,
      queryPrefix: "mutation",
      querySuffix: "Mutation",
      queryFN: config.schema.getMutationType(),
    },
    ...options,
  );
}

interface rootConfig extends queryConfig {
  queryFN: GraphQLObjectType<any, any> | null | undefined;
  queryPrefix: string;
  root: string;
  querySuffix: string;
  rootQueryNull?: boolean;
  nullQueryPaths?: string[];
  undefinedQueryPaths?: string[];
}

const fragmentRegex = /^...on (\w+)(.*)/;

function splitPath(path: string) {
  // handle fragment queries. we don't want to compare against this when checking the result
  // but we'll make sure to send to server
  const match = fragmentRegex.exec(path);
  if (!match) {
    return path.split(".");
  }
  return match[2].split(".");
}

async function expectFromRoot(
  config: rootConfig,
  ...options: Option[]
): Promise<supertest.Agent> {
  let query = config.queryFN;
  let fields = query?.getFields();
  if (!fields) {
    // TODO custom error?
    throw new Error("schema doesn't have query or fields");
  }
  let field = fields[config.root];
  if (!field) {
    throw new Error(
      `could not find field ${config.root} in GraphQL query schema`,
    );
  }
  let fieldArgs = field.args;

  let queryParams: string[] = [];
  fieldArgs.forEach((fieldArg) => {
    const arg = config.args[fieldArg.name];
    // let the graphql runtime handle this (it may be optional for example)
    if (arg === undefined) {
      return;
    }
    queryParams.push(`$${fieldArg.name}: ${fieldArg.type}`);
  });

  // add extra variables in queryArgs...
  for (const key in config.extraVariables) {
    const v = config.extraVariables[key];
    queryParams.push(`$${key}: ${v.graphqlType}`);
  }

  let params: string[] = [];
  for (let key in config.args) {
    params.push(`${key}: $${key}`);
  }
  let fieldType: GraphQLType = field.type;
  if (config.inlineFragmentRoot) {
    const rootType = config.schema.getType(config.inlineFragmentRoot);
    if (!rootType) {
      throw new Error(
        `couldn't find inline fragment root ${config.inlineFragmentRoot} in the schema`,
      );
    }
    fieldType = rootType;
  }
  let q = expectQueryResult(config.schema, fieldType, ...options);
  let queryVar = "";
  let callVar = "";
  if (queryParams.length) {
    queryVar = `(${queryParams.join(",")})`;
  }
  if (params.length) {
    callVar = `(${params.join(",")})`;
  }
  let suffix = "";
  if (q) {
    // if no suffix part of query, don't put it there
    suffix = `{${q}}`;
  }
  if (config.inlineFragmentRoot) {
    suffix = `{...on ${config.inlineFragmentRoot}${suffix}}`;
  }
  q = `${config.queryPrefix} ${config.root}${config.querySuffix} ${queryVar} {
    ${config.root}${callVar} ${suffix}
  }`;

  if (config.debugMode) {
    console.log(q);
  }
  let [st, temp] = makeGraphQLRequest(config, q, fieldArgs);
  const res = await temp.expect("Content-Type", /json/);
  if (config.debugMode) {
    console.log(inspect(res.body, false, 3));
  }
  // if there's a callback, let everything be done there and we're done
  if (config.callback) {
    config.callback(res);
    return st;
  }
  if (config.expectedStatus !== undefined) {
    expect(res.status).toBe(config.expectedStatus);
  } else {
    expect(
      res.ok,
      `expected ok response. instead got ${
        res.status
      } and result ${JSON.stringify(res.body)}`,
    );
  }

  // res.ok = true in graphql-helix when there's errors...
  // res.ok = false in express-graphql when there's errors...
  if (!res.ok || (res.body.errors && res.body.errors.length > 0)) {
    let errors: any[] = res.body.errors;
    expect(errors.length).toBeGreaterThan(0);

    if (config.expectedError) {
      // todo multiple errors etc
      expect(errors[0].message).toMatch(config.expectedError);
    } else {
      throw new Error(`unhandled error ${JSON.stringify(errors)}`);
    }
    return st;
  }
  let data = res.body.data;
  let result = data[config.root];

  if (config.rootQueryNull) {
    expect(result, "root query wasn't null").toBe(null);
    return st;
  }

  // special case. TODO needs to be handled better
  if (options.length === 1) {
    const parts = splitPath(options[0][0]);
    if (parts.length == 1 && parts[0] === "") {
      expect(options[0][1]).toStrictEqual(result);
      return st;
    }
  }

  await Promise.all(
    options.map(async (option) => {
      const path = option[0];
      const expected = option[1];
      const alias = option[2];

      let nullPath: string | undefined;
      let nullParts: string[] = [];
      let undefinedPath: string | undefined;
      let undefinedParts: string[] = [];
      if (config.nullQueryPaths) {
        for (let i = 0; i < config.nullQueryPaths.length; i++) {
          if (path.startsWith(config.nullQueryPaths[i])) {
            nullPath = config.nullQueryPaths[i];
            nullParts = splitPath(nullPath);
            break;
          }
        }
      }
      if (config.undefinedQueryPaths) {
        for (let i = 0; i < config.undefinedQueryPaths.length; i++) {
          if (path.startsWith(config.undefinedQueryPaths[i])) {
            undefinedPath = config.undefinedQueryPaths[i];
            undefinedParts = splitPath(undefinedPath);
            break;
          }
        }
      }

      let parts = splitPath(alias ?? path);
      let current = result;

      // possible to make this smarter and better
      // e.g. when building up the tree above
      for (let i = 0; i < parts.length; i++) {
        let part = parts[i];
        let idx = part.indexOf("[");
        let listIdx: number | undefined;

        // list
        if (idx !== -1) {
          let endIdx = part.indexOf("]");
          if (endIdx === -1) {
            throw new Error(
              "can't have a beginning index without an end index",
            );
          }
          // get the idx we care about
          listIdx = parseInt(part.substr(idx + 1, endIdx - idx), 10);

          // update part
          part = part.substr(0, idx);
        }

        idx = part.indexOf("(");
        // function or arg call
        if (idx !== -1) {
          let endIdx = part.indexOf(")");
          if (endIdx === -1) {
            throw new Error(
              "can't have a beginning index without an end index",
            );
          }
          // update part
          part = part.substr(0, idx);
        }

        // "" as root is ok.
        if (part !== "") {
          current = current[part];
        }

        if (listIdx !== undefined && nullPath?.indexOf("[") !== -1) {
          current = current[listIdx];
        }

        // at the part of the path where it's expected to be null, confirm it is before proceeding
        if (nullParts.length === i + 1) {
          expect(current, `path ${nullPath} expected to be null`).toBe(null);
          return st;
        }

        if (undefinedParts.length === i + 1) {
          expect(
            current,
            `path ${undefinedPath} expected to be undefined`,
          ).toBe(undefined);
          return st;
        }

        if (listIdx !== undefined && nullPath?.indexOf("[") === -1) {
          current = current[listIdx];
        }

        if (i === parts.length - 1) {
          // leaf node, check the value
          if (typeof expected === "function") {
            // TODO eventually may need to batch this but fine for now
            await expected(current);
          } else {
            expect(
              current,
              `value of ${part} in path ${path} was not as expected`,
            ).toStrictEqual(expected);
          }
        } else {
          expect(
            part,
            `found undefined node in path ${path} at subtree ${part}`,
          ).not.toBe(undefined);
        }
      }
    }),
  );
  return st;
}
