import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLNonNull,
  GraphQLBoolean,
  GraphQLList,
} from "graphql";
import { GraphQLUpload, graphqlUploadExpress } from "graphql-upload";
import { expectMutation } from "../../testutils/ent-graphql-tests";

const fileContents = ["col1,col2", "data1,data2"].join("\n");

function createTempFile() {
  // Generate a unique file name
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(
    tempDir,
    `tempfile-${crypto.randomUUID()}.txt`,
  );

  // Write content to the newly created file
  fs.writeFileSync(tempFilePath, fileContents, "utf8");

  return tempFilePath;
}

async function readStream(file): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = file.createReadStream();
    let data: string[] = [];
    stream.on("data", function (chunk) {
      data.push(chunk.toString());
    });

    stream.on("end", function () {
      return resolve(data.join(""));
    });
    stream.on("error", function (err) {
      return reject(err);
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
        type: new GraphQLNonNull(GraphQLBoolean),
        args: {
          file: {
            type: new GraphQLNonNull(GraphQLUpload),
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
        type: new GraphQLNonNull(GraphQLBoolean),
        args: {
          files: {
            type: new GraphQLNonNull(
              new GraphQLList(new GraphQLNonNull(GraphQLUpload)),
            ),
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
  const file = createTempFile();

  await expectMutation(
    {
      schema: schema,
      mutation: "fileUpload",
      args: {
        file,
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
  const file = createTempFile();

  await expectMutation(
    {
      schema: schema,
      mutation: "fileUpload",
      args: {
        file,
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
  const file = createTempFile();

  await expectMutation(
    {
      schema: schema,
      mutation: "fileUpload",
      args: {
        file: fs.readFileSync(file),
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
  const file = createTempFile();

  await expectMutation(
    {
      schema: schema,
      mutation: "fileUpload",
      args: {
        file,
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
  const file = createTempFile();
  const file2 = createTempFile();

  await expectMutation(
    {
      schema: schema,
      mutation: "fileUploadMultiple",
      args: {
        files: [file, file2],
      },
      disableInputWrapping: true,
      customHandlers: [
        graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
      ],
    },
    [".", true],
  );
});
