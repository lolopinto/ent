// TODO all this can/should be moved into its own npm package
// or into ent itself
// haven't figured out the correct dependency structure with express etc so not for now
import express from "express";
import graphqlHTTP from "express-graphql";
import request from "supertest";
import { Viewer } from "ent/ent";
import { GraphQLSchema } from "graphql";

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

export interface queryRootConfig {
  viewer: Viewer;
  schema: GraphQLSchema;
  root: string;
  args: {};
  rootQueryNull?: boolean;
}

export async function expectQueryFromRoot(
  config: queryRootConfig,
  ...options: Option[] // TODO queries? expected values
) {
  // we want options after so this should not be variable sadly
  // or have this be overloaded
  let query = config.schema.getQueryType();
  let fields = query?.getFields();
  if (!fields) {
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
  q = `query ${config.root}Query (${queryParams.join(",")}) {
    ${config.root}(${params.join(",")}) {${q}}
  }`;

  let res = await makeRequest(
    config.viewer,
    config.schema,
    q,
    config.args,
  ).expect("Content-Type", /json/);
  if (res.status !== 200) {
    // TODO allow errors...
    throw new Error(
      `expected 200 status. instead got ${
        res.status
      } and result ${JSON.stringify(res.body)}`,
    );
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
        //        console.log(idx, endIdx, part.substr(idx + 1, endIdx - idx), listIdx);

        // update part
        part = part.substr(0, idx);
        //        console.log(part, current, current[part]);
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
        if (current !== expected) {
          console.log(current, expected, typeof current, typeof expected);
        }
        expect(
          current,
          `value of ${part} in path ${path} was not as expected`,
        ).toBe(expected);
      } else {
        expect(
          part,
          `found undefined node in path ${path} at subtree ${part}`,
        ).not.toBe(undefined);
      }
    }
  });
}
