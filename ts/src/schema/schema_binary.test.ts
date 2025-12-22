import { Data, Ent, Viewer, WriteOperation } from "../core/base.js";
import { BaseEnt, BuilderSchema, SimpleAction } from "../testutils/builder.js";
import { Schema, FieldMap } from "./index.js";
import { BinaryTextType, ByteaType } from "./binary_field.js";
import { TempDB, getSchemaTable } from "../testutils/db/temp_db.js";
import DB, { Dialect } from "../core/db.js";
import { loadConfig } from "../core/config.js";
import { LoggedOutViewer } from "../core/viewer.js";
import { readFileSync } from "fs";
import { convertTextToBuffer } from "../core/convert.js";

class Image extends BaseEnt implements Ent {
  nodeType = "Image";
  constructor(
    public viewer: Viewer,
    public data: Data,
  ) {
    super(viewer, data);
  }
}

class ImageSchema implements Schema {
  fields: FieldMap = {
    image: ByteaType(),
  };
  ent = Image;
}

class ImageBinarySchema implements Schema {
  fields: FieldMap = {
    image: BinaryTextType(),
  };
  ent = Image;
}

let tdb: TempDB;

async function createTables(...schemas: BuilderSchema<Ent>[]) {
  for (const schema of schemas) {
    await tdb.create(getSchemaTable(schema, DB.getDialect()));
  }
}

function getInsertAction<T extends Ent>(
  schema: BuilderSchema<T>,
  map: Map<string, any>,
) {
  return new SimpleAction(
    new LoggedOutViewer(),
    schema,
    map,
    WriteOperation.Insert,
    null,
  );
}

beforeAll(async () => {
  loadConfig();
  tdb = new TempDB(Dialect.Postgres);
  await tdb.beforeAll();
});

afterAll(async () => {
  await tdb.afterAll();
});

afterEach(async () => {
  await tdb.dropAll();
});

test("bytea", async () => {
  await createTables(new ImageSchema());
  const b = readFileSync("../testdata/flower.jpg");

  const action = getInsertAction(new ImageSchema(), new Map([["image", b]]));
  const ent = await action.saveX();
  const img = ent.data["image"];
  expect(img).toBeInstanceOf(Buffer);
  expect(img).toStrictEqual(b);
});

test("binary text", async () => {
  await createTables(new ImageBinarySchema());
  const b = readFileSync("../testdata/flower.jpg");

  const action = getInsertAction(
    new ImageBinarySchema(),
    new Map([["image", b]]),
  );
  const ent = await action.saveX();
  const img = convertTextToBuffer(ent.data["image"]);
  expect(img).toBeInstanceOf(Buffer);
  expect(img).toStrictEqual(b);
});
