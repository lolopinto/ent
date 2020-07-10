// TODO all this can/should be moved into its own npm package
// or into ent itself
// haven't figured out the correct dependency structure with express etc so not for now
import express, { Express, response } from "express";
import graphqlHTTP from "express-graphql";
import { Viewer } from "ent/ent";
import { GraphQLSchema, GraphQLObjectType } from "graphql";
import { registerAuthHandler } from "ent/auth";
import { buildContext } from "ent/auth/context";
import { IncomingMessage, ServerResponse } from "http";
import supertest from "supertest";

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
  app.use(
    "/graphql",
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

  return app;
}

function makeGraphQLRequest(
  config: queryConfig,
  query: string,
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

function buildTreeFromQueryPaths(...options: Option[]) {
  let topLevelTree = {};
  options.forEach((option) => {
    let path = option[0];
    let parts = path.split(".");

    let tree = topLevelTree;
    parts.forEach((part) => {
      // a list, remove the index in the list building part
      let idx = part.indexOf("[");
      if (idx !== -1) {
        part = part.substr(0, idx);
      }
      // if this part of the tree doesn't exist, put an empty node there
      if (tree[part] === undefined) {
        tree[part] = {};
      }
      tree = tree[part];
    });
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

function expectQueryResult(...options: Option[]) {
  let topLevelTree = buildTreeFromQueryPaths(...options);
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
}

export interface queryRootConfig extends queryConfig {
  root: string;
  rootQueryNull?: boolean;
  nullQueryPaths?: string[];
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
    if (!arg) {
      return;
    }
    queryParams.push(`$${fieldArg.name}: ${fieldArg.type}`);
  });
  let params: string[] = [];
  for (let key in config.args) {
    params.push(`${key}: $${key}`);
  }
  let q = expectQueryResult(...options);
  let queryVar = "";
  let callVar = "";
  if (queryParams.length) {
    queryVar = `(${queryParams.join(",")})`;
  }
  if (params.length) {
    callVar = `(${params.join(",")})`;
  }
  q = `${config.queryPrefix} ${config.root}${config.querySuffix} ${queryVar} {
    ${config.root}${callVar} {${q}}
  }`;

  let [st, temp] = makeGraphQLRequest(config, q);
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

  options.forEach((option) => {
    let path = option[0];
    let expected = option[1];

    let nullPath: string | undefined;
    let nullParts: string[] = [];
    if (config.nullQueryPaths) {
      for (let i = 0; i < config.nullQueryPaths.length; i++) {
        if (path.startsWith(config.nullQueryPaths[i])) {
          nullPath = config.nullQueryPaths[i];
          nullParts = nullPath.split(".");
          break;
        }
      }
    }

    let parts = path.split(".");
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

      current = current[part];

      // at the part of the path where it's expected to be null, confirm it is before proceeding
      if (nullParts.length === i + 1) {
        expect(current, `path ${nullPath} expected to be null`).toBe(null);
        return st;
      }

      if (listIdx !== undefined) {
        current = current[listIdx];
      }
      if (expected === null) {
        expect(current).toBe(null);
        break;
      }

      if (i === parts.length - 1) {
        // leaf node, check the value
        if (typeof expected === "function") {
          // TODO eventually may need to batch this but fine for now
          Promise.resolve(expected(current));
        } else {
          expect(
            current,
            `value of ${part} in path ${path} was not as expected`,
          ).toBe(expected);
        }
      } else {
        expect(
          part,
          `found undefined node in path ${path} at subtree ${part}`,
        ).not.toBe(undefined);
      }
    }
  });
  return st;
}
