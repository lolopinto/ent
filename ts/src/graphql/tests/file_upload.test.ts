import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLNonNull,
  GraphQLBoolean,
  GraphQLList,
} from "graphql";
import { GraphQLUpload, graphqlUploadExpress } from "graphql-upload";
import * as fs from "fs";
import { expectMutation } from "../../testutils/ent-graphql-tests";

const fileContents = ["col1,col2", "data1,data2"].join("\n");
const paths = ["foo.csv", "foo2.csv"];

beforeAll(() => {
  paths.forEach((path) => {
    fs.writeFileSync(path, fileContents, {
      encoding: "utf-8",
    });
  });
});

afterAll(() => {
  paths.forEach((path) => {
    fs.unlinkSync(path);
  });
});

async function readStream(file): Promise<string> {
  return await new Promise((resolve) => {
    const stream = file.createReadStream();
    let data: string[] = [];
    stream.on("data", function(chunk) {
      data.push(chunk.toString());
    });

    stream.on("close", function() {
      return resolve(data.join(""));
    });
  });
}

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "RootQueryType",
    fields: {
      hello: {
        type: GraphQLString,
        resolve() {
          return "world";
        },
      },
    },
  }),
  mutation: new GraphQLObjectType({
    name: "RootMutationType",
    fields: {
      fileUpload: {
        type: GraphQLNonNull(GraphQLBoolean),
        args: {
          file: {
            type: GraphQLNonNull(GraphQLUpload),
          },
        },
        async resolve(src, args) {
          const file = await args.file;

          const data = await readStream(file);
          if (data !== fileContents) {
            throw new Error(`invalid file sent`);
          }

          return true;
        },
      },
      fileUploadMultiple: {
        type: GraphQLNonNull(GraphQLBoolean),
        args: {
          files: {
            type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GraphQLUpload))),
          },
        },
        async resolve(src, args) {
          await Promise.all(
            args.files.map(async (f) => {
              const file = await f;
              const data = await readStream(file);
              if (data !== fileContents) {
                throw new Error(`invalid file sent`);
              }
              return data;
            }),
          );

          return true;
        },
      },
    },
  }),
});

test("file upload", async () => {
  await expectMutation(
    {
      schema: schema,
      mutation: "fileUpload",
      args: {
        file: paths[0],
      },
      disableInputWrapping: true,
      customHandlers: [
        graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
      ],
    },
    [".", true],
  );
});

test("file upload. with stream", async () => {
  await expectMutation(
    {
      schema: schema,
      mutation: "fileUpload",
      args: {
        file: fs.createReadStream(paths[0]),
      },
      disableInputWrapping: true,
      customHandlers: [
        graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
      ],
    },
    [".", true],
  );
});

test("file upload. with buffer", async () => {
  await expectMutation(
    {
      schema: schema,
      mutation: "fileUpload",
      args: {
        file: fs.readFileSync(paths[0]),
      },
      disableInputWrapping: true,
      customHandlers: [
        graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
      ],
    },
    [".", true],
  );
});

test("file upload. no graphqlUploadExpress", async () => {
  await expectMutation(
    {
      schema: schema,
      mutation: "fileUpload",
      args: {
        file: paths[0],
      },
      disableInputWrapping: true,
      expectedStatus: 400,
      // TODO not sure where this error from is but it's failing as expected which is fine
      expectedError: /Must provide query string/,
    },
    [".", true],
  );
});

test("file upload multiple", async () => {
  await expectMutation(
    {
      schema: schema,
      mutation: "fileUploadMultiple",
      args: {
        files: paths,
      },
      disableInputWrapping: true,
      customHandlers: [
        graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
      ],
    },
    [".", true],
  );
});
