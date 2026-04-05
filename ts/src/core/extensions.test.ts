import { types as pgTypes, type Pool } from "pg";
import {
  buildExtensionSearchPath,
  clearExtensionRuntimes,
  initializeExtensions,
  registerExtensionRuntime,
  resolveExtensions,
} from "./extensions";

describe("extension config resolution", () => {
  test("defaults to an empty extension list when runtime config is absent", () => {
    expect(resolveExtensions()).toEqual([]);
  });

  test("normalizes runtime extension configuration", () => {
    expect(
      resolveExtensions([
        {
          name: "vector",
        },
        {
          name: "postgis",
          provisionedBy: "external",
          runtimeSchemas: ["public"],
        },
      ]),
    ).toEqual([
      {
        name: "postgis",
        provisionedBy: "external",
        runtimeSchemas: ["public"],
        dropCascade: false,
      },
      {
        name: "vector",
        provisionedBy: "ent",
        runtimeSchemas: [],
        dropCascade: false,
      },
    ]);
  });
});

describe("extension search path", () => {
  afterEach(() => {
    clearExtensionRuntimes();
  });

  test("combines dev schema, configured schemas, and registered defaults", () => {
    registerExtensionRuntime({
      name: "postgis",
      runtimeSchemas: ["public"],
    });

    expect(
      buildExtensionSearchPath(
        {
          enabled: true,
          schemaName: "ent_dev_feature",
          includePublic: true,
        },
        [
          {
            name: "vector",
            runtimeSchemas: ["extensions"],
          },
        ],
      ),
    ).toBe("ent_dev_feature,extensions,public");
  });

  test("returns undefined when nothing contributes to search path", () => {
    expect(
      buildExtensionSearchPath(
        {
          enabled: false,
        },
        [],
      ),
    ).toBeUndefined();
  });

  test("registered defaults participate without runtime config", () => {
    registerExtensionRuntime({
      name: "postgis",
      runtimeSchemas: ["public"],
    });

    expect(
      buildExtensionSearchPath(
        {
          enabled: true,
          schemaName: "ent_dev_feature",
          includePublic: false,
        },
        [],
      ),
    ).toBe("ent_dev_feature,public");
  });
});

describe("extension initialization", () => {
  afterEach(() => {
    clearExtensionRuntimes();
    jest.restoreAllMocks();
  });

  test("validates configured extensions and batches type parser lookup", async () => {
    const validate = jest.fn();
    const setTypeParser = jest
      .spyOn(pgTypes, "setTypeParser")
      .mockImplementation(() => pgTypes);
    const getTypeParser = jest
      .spyOn(pgTypes, "getTypeParser")
      .mockImplementation((oid: number) => {
        if (oid === (1009 as any)) {
          return ((value: string) => ["POINT(-122.4 37.78)"]) as any;
        }
        return ((value: string) => value) as any;
      });

    registerExtensionRuntime({
      name: "postgis",
      runtimeSchemas: ["public"],
      validate,
      types: [
        {
          name: "geometry",
          parse: (value) => value,
        },
        {
          name: "geography",
          parse: (value) => value,
        },
      ],
    });
    registerExtensionRuntime({
      name: "vector",
      runtimeSchemas: ["public"],
      types: [
        {
          name: "vector",
          parse: (value) => value,
        },
      ],
    });

    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              extname: "postgis",
              extversion: "3.4.0",
              install_schema: "public",
            },
            {
              extname: "vector",
              extversion: "0.8.1",
              install_schema: "public",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            { oid: 1234, typname: "geometry", typarray: 1235 },
            { oid: 5678, typname: "geography", typarray: 5679 },
            { oid: 9012, typname: "vector", typarray: 9013 },
          ],
        }),
    } as unknown as Pool;

    await initializeExtensions(pool, [
      {
        name: "postgis",
        version: "3.4.0",
        runtimeSchemas: ["public"],
      },
      {
        name: "vector",
        provisionedBy: "external",
      },
    ]);

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("FROM pg_extension"),
      [["postgis", "vector"]],
    );
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("FROM pg_type"),
      [["geometry", "geography", "vector"]],
    );
    expect(validate).toHaveBeenCalledWith(
      {
        name: "postgis",
        version: "3.4.0",
        installSchema: "public",
      },
      {
        name: "postgis",
        provisionedBy: "ent",
        version: "3.4.0",
        runtimeSchemas: ["public"],
        dropCascade: false,
      },
    );
    expect(setTypeParser).toHaveBeenCalledTimes(6);
    expect(getTypeParser).toHaveBeenCalledWith(1009 as any);
  });

  test("throws when a required extension is missing", async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({
        rows: [],
      }),
    } as unknown as Pool;

    await expect(
      initializeExtensions(pool, [
        {
          name: "vector",
        },
      ]),
    ).rejects.toThrow('required db extension "vector" is not installed');
  });

  test("throws when a configured runtime type is missing", async () => {
    registerExtensionRuntime({
      name: "vector",
      types: [
        {
          name: "vector",
          parse: (value) => value,
        },
      ],
    });

    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              extname: "vector",
              extversion: "0.8.1",
              install_schema: "public",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [],
        }),
    } as unknown as Pool;

    await expect(
      initializeExtensions(pool, [
        {
          name: "vector",
        },
      ]),
    ).rejects.toThrow(
      'required pg type "vector" for db extension "vector" was not found',
    );
  });
});
