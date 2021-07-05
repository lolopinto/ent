import express, { Express, RequestHandler } from "express";
import { graphqlHTTP } from "express-graphql";
import { Viewer } from "@snowtop/ent";
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLScalarType,
  isWrappingType,
  GraphQLArgument,
  GraphQLList,
  isScalarType,
  GraphQLType,
  GraphQLFieldMap,
} from "graphql";
import { buildContext, registerAuthHandler } from "@snowtop/ent/auth";
import { IncomingMessage, ServerResponse } from "http";
import supertest from "supertest";
import * as fs from "fs";

// TODO need to make it obvious that jest-expect-message is a peer?dependency and setupFilesAfterEnv is a requirement to use this
// or change the usage here.

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
  let handlers = config.customHandlers || [];
  handlers.push(
    graphqlHTTP((request: IncomingMessage, response: ServerResponse) => {
      const doWork = async () => {
        let context = await buildContext(request, response);
        return {
          schema: config.schema,
          context,
        };
      };
      return doWork();
    }),
  );
  app.use("/graphql", ...handlers);

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
  fieldArgs: GraphQLArgument[],
): [supertest.SuperTest<supertest.Test>, supertest.Test] {
  let test: supertest.SuperTest<supertest.Test>;

  if (config.test) {
    if (typeof config.test === "function") {
      test = config.test(server(config));
    } else {
      test = config.test;
    }
  } else {
    test = supertest(server(config));
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

  if (files.size) {
    let ret = test.post("/graphql").set(config.headers || {});

    ret.field(
      "operations",
      JSON.stringify({
        query: query,
        variables: config.args,
      }),
    );

    let m = {};
    let idx = 0;
    for (const [key, val] of files) {
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

    return [test, ret];
  } else {
    return [
      test,
      test
        .post("/graphql")
        .set(config.headers || {})
        .send({
          query: query,
          variables: JSON.stringify(config.args),
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
  if (fieldType instanceof GraphQLObjectType) {
    fields = fieldType.getFields();
  }
  let topLevelTree = {};
  options.forEach((option) => {
    let path = option[0];
    let parts: string[] = [];
    let match = fragmentRegex.exec(path);
    if (match) {
      // fragment, keep the part of the fragment e.g.  ...onUser, and then split the rest....
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
      function handleSubtree(obj: {}, tree: {}) {
        if (Array.isArray(obj)) {
          for (const obj2 of obj) {
            handleSubtree(obj2, tree);
          }
          return;
        }
        for (const key in obj) {
          if (tree[key] === undefined) {
            tree[key] = {};
          }
          if (typeof obj[key] === "object") {
            if (!isScalarField(key)) {
              handleSubtree(obj[key], tree[key]);
            }
          }
        }
      }

      // TODO this needs to work for super complicated objects and have fields update as nesting applies...
      function isScalarField(f: string) {
        const subField = fields?.[f];
        if (!subField) {
          return false;
        }
        if (!isWrappingType(subField.type)) {
          return false;
        }

        // only spread out if an object
        const [typ, _] = getInnerType(subField.type, true);
        return isScalarType(typ);
      }

      if (i === parts.length - 1 && typeof option[1] === "object") {
        if (!isScalarField(part)) {
          handleSubtree(option[1], tree);
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

export type Option = [string, any];

interface queryConfig {
  // if neither viewer nor init is passed, we end with a logged out viewer
  viewer?: Viewer;
  // to init express e.g. session, passport initialize etc
  init?: (app: Express) => void;
  test?:
    | supertest.SuperTest<supertest.Test>
    | ((express: Express) => supertest.SuperTest<supertest.Test>);
  // TODO
  // if none indicated, defaults to logged out viewer
  schema: GraphQLSchema;
  headers?: object;
  debugMode?: boolean;
  args: {};
  expectedStatus?: number; // expected http status code
  expectedError?: string | RegExp; // expected error message
  // todo there can be more than one etc
  callback?: (res: supertest.Response) => void;
  inlineFragmentRoot?: string;
  customHandlers?: RequestHandler[];
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
): Promise<supertest.SuperTest<supertest.Test>> {
  return await expectFromRoot(
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
  //  rootQueryNull?: boolean;
}

export async function expectMutation(
  config: mutationRootConfig,
  ...options: Option[]
): Promise<supertest.SuperTest<supertest.Test>> {
  // wrap args in input because we simplify the args for mutations
  // and don't require the input
  let args = config.args;
  if (!config.disableInputWrapping) {
    args = {
      input: args,
    };
  }

  return await expectFromRoot(
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
): Promise<supertest.SuperTest<supertest.Test>> {
  let query = config.queryFN;
  let fields = query?.getFields();
  if (!fields) {
    // TODO custom error?
    fail("schema doesn't have query or fields");
  }
  let field = fields[config.root];
  if (!field) {
    fail(`could not find field ${config.root} in GraphQL query schema`);
  }
  let fieldArgs = field.args;

  let queryParams: string[] = [];
  fieldArgs.forEach((fieldArg) => {
    let arg = config.args[fieldArg.name];
    // let the graphql runtime handle this (it may be optional for example)
    if (arg === undefined) {
      return;
    }
    queryParams.push(`$${fieldArg.name}: ${fieldArg.type}`);
  });
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
    console.log(res.body);
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

  if (!res.ok) {
    let errors: any[] = res.body.errors;
    expect(errors.length).toBeGreaterThan(0);

    if (config.expectedError) {
      // todo multiple errors etc
      expect(errors[0].message).toMatch(config.expectedError);
    } else {
      fail(`unhandled error ${JSON.stringify(errors)}`);
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
      let path = option[0];
      let expected = option[1];

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

      let parts = splitPath(path);
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
            fail("can't have a beginning index without an end index");
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
            fail("can't have a beginning index without an end index");
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
