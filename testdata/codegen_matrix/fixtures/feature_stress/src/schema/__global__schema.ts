import {
  BooleanType,
  GlobalSchema,
  StringType,
  StructType,
} from "@snowtop/ent/schema";

const globalSchema: GlobalSchema = {
  fields: {
    matrix_preferences: StructType({
      tsType: "MatrixPreferences",
      graphQLType: "MatrixPreferences",
      fields: {
        notificationsEnabled: BooleanType(),
        locale: StringType(),
      },
    }),
  },
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
