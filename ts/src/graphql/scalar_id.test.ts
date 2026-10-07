import {
  graphql,
  GraphQLID,
  GraphQLList,
  GraphQLObjectType,
  GraphQLSchema,
} from "graphql";
import {
  encodeGQLID,
  encodeGQLIDReference,
  mustDecodeIDFromGQLID,
  clearResolvers,
} from "./node_resolver";

const id = "00000000-0000-4000-8000-000000000001";
const encoded =
  "bm9kZTpob2xpZGF5OjAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMQ==";

test("saved references encode without any registered node loader", async () => {
  await clearResolvers();
  expect(encodeGQLIDReference(id, "holiday")).toBe(encoded);
  expect(encodeGQLID({ id, nodeType: "holiday" })).toBe(encoded);
  expect(mustDecodeIDFromGQLID(encoded)).toBe(id);
  expect(encodeGQLIDReference(mustDecodeIDFromGQLID(encoded), "holiday")).toBe(
    encoded,
  );
});

test("nulls, omitted values, empty lists and duplicates are preserved without mutation", () => {
  const values = Object.freeze([id, null, id, undefined]);
  expect(encodeGQLIDReference(values, "holiday")).toEqual([
    encoded,
    null,
    encoded,
    undefined,
  ]);
  expect(values).toEqual([id, null, id, undefined]);
  expect(encodeGQLIDReference(null, "holiday")).toBeNull();
  expect(encodeGQLIDReference(undefined, "holiday")).toBeUndefined();
  expect(encodeGQLIDReference([], "holiday")).toEqual([]);
});

test("GraphQL scalar output preserves unavailable references and the cached source", async () => {
  const source = Object.freeze({ ids: Object.freeze([id, null, id]) });
  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: "Query",
      fields: {
        ids: {
          type: new GraphQLList(GraphQLID),
          resolve: () => encodeGQLIDReference(source.ids, "holiday"),
        },
      },
    }),
  });
  const result = await graphql({ schema, source: "{ ids }" });
  expect(result.errors).toBeUndefined();
  expect(result.data?.ids).toEqual([encoded, null, encoded]);
  expect(source.ids).toEqual([id, null, id]);
});
