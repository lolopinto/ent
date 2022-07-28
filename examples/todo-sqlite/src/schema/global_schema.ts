import { GlobalSchema, TimestampType } from "@snowtop/ent/schema/";
import * as clause from "@snowtop/ent/core/clause";
import {
  Ent,
  UpdateOperation,
  TransformedUpdateOperation,
  SQLStatementOperation,
} from "@snowtop/ent";

const glo: GlobalSchema = {
  extraEdgeFields: {
    // same energy as soft_delete pattern but implemented manually
    deleted_at: TimestampType({
      nullable: true,
      defaultValueOnCreate: () => null,
    }),
  },

  // TODO use these in edges
  // write tests
  transformEdgeRead(): clause.Clause {
    return clause.Eq("deleted_at", null);
  },

  transformEdgeWrite<T extends Ent>(
    stmt: UpdateOperation<T>,
  ): TransformedUpdateOperation<T> | null {
    switch (stmt.op) {
      case SQLStatementOperation.Delete:
        return {
          op: SQLStatementOperation.Update,
          data: {
            // this should return field, it'll be formatted as needed
            deleted_at: new Date(),
          },
        };
    }
    return null;
  },
};
export default glo;
