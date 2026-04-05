import type { GlobalSchema } from "@snowtop/ent/schema";
import { PgVectorExtension } from "@snowtop/ent-pgvector";

const globalSchema: GlobalSchema = {
  dbExtensions: [PgVectorExtension()],
};

export default globalSchema;
