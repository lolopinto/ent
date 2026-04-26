import {
  ActionOperation,
  EntSchema,
  StringType,
  TimestamptzType,
} from "@snowtop/ent/schema";

const SearchDocumentSchema = new EntSchema({
  tableName: "matrix_pg_search_documents",
  fields: {
    title: StringType(),
    body: StringType({
      nullable: true,
    }),
    category: StringType({
      serverDefault: "general",
    }),
    publishedAt: TimestamptzType(),
  },
  indices: [
    {
      name: "matrix_pg_search_documents_title_pattern_idx",
      columns: ["title"],
      indexType: "btree",
      ops: {
        title: "text_pattern_ops",
      },
      indexParams: {
        fillfactor: 70,
      },
      where: "title IS NOT NULL",
    },
  ],
  actions: [
    {
      operation: ActionOperation.Mutations,
    },
  ],
});

export default SearchDocumentSchema;
