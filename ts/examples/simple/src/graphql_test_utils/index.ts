// TODO all this can/should be moved into its own npm package
// or into ent itself
// haven't figured out the correct dependency structure with express etc so not for now
import express from "express";
import graphqlHTTP from "express-graphql";
import request from "supertest";
import { Viewer } from "ent/ent";
import { GraphQLSchema, GraphQLObjectType } from "graphql";

function server(viewer: Viewer, schema: GraphQLSchema) {
  let app = express();
  app.use(
    "/graphql",
    graphqlHTTP({
      schema: schema,
      context: {
        viewer,
      },
    }),
  );
  return app;
}

function makeRequest(
  viewer: Viewer,
  schema: GraphQLSchema,
  query: string,
  args?: {},
): request.Test {
  //  console.log(args);
  // query/variables etc
  return request(server(viewer, schema))
    .post("/graphql")
    .send({
      query: query,
      variables: JSON.stringify(args),
    });
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
  viewer: Viewer;
  schema: GraphQLSchema;
  args: {};
  expectedStatus?: number; // expected http status code
  expectedError?: string | RegExp; // expected error message
  // todo there can be more than one etc
  callback?: (res: request.Response) => void;
}

export interface queryRootConfig extends queryConfig {
  root: string;
  rootQueryNull?: boolean;
}

export async function expectQueryFromRoot(
  config: queryRootConfig,
  ...options: Option[] // TODO queries? expected values
) {
  await expectFromRoot(
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
) {
  // wrap args in input because we simplify the args for mutations
  // and don't require the input
  let args = config.args;
  if (!config.disableInputWrapping) {
    args = {
      input: args,
    };
  }

  await expectFromRoot(
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
}

async function expectFromRoot(config: rootConfig, ...options: Option[]) {
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
  q = `${config.queryPrefix} ${config.root}${
    config.querySuffix
  } (${queryParams.join(",")}) {
    ${config.root}(${params.join(",")}) {${q}}
  }`;

  let res = await makeRequest(config.viewer, config.schema, q, config.args); //.expect("Content-Type", /json/);
  // if there's a callback, let everything be done there and we're done
  if (config.callback) {
    return config.callback(res);
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
    }
    return;
  }
  let data = res.body.data;
  let result = data[config.root];

  if (config.rootQueryNull) {
    expect(result, "root query wasn't null").toBe(null);
    return;
  }

  //  console.log(result);
  options.forEach((option) => {
    let path = option[0];
    let expected = option[1];

    let parts = path.split(".");
    let current = result;

    //    console.log(result, current);
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

      if (expected === null) {
        // TODO this doesn't always work. need to indicate when source is null
        // vs id is null
        // need an option similar to rootQueryNull but for different subtrees
        expect(current).toBe(null);
        break;
      }

      if (listIdx !== undefined) {
        current = current[listIdx];
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
}
