import { GlobalSchema, StringType } from "@snowtop/ent/schema";

const globalSchema: GlobalSchema = {
  extraEdgeFields: {
    metadata: StringType({ nullable: true }),
  },
  edgeIndices: [
    {
      columns: ["time"],
      name: "time_lookup",
      where: "time IS NOT NULL",
    },
  ],
  dbExtensions: [
    {
      name: "pg_trgm",
      provisionedBy: "ent",
      installSchema: "public",
      runtimeSchemas: ["public"],
    },
  ],
};

export default globalSchema;
