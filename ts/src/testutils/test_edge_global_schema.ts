import {
  SQLStatementOperation,
  TimestampType,
  EdgeUpdateOperation,
  TransformedEdgeUpdateOperation,
} from "../schema";
import * as clause from "../core/clause";
import { AssocEdge } from "../core/ent";
import { Data } from "../core/base";

export class EdgeWithDeletedAt extends AssocEdge {
  deletedAt: Date | null;

  constructor(data: Data) {
    super(data);
    this.deletedAt = data.deleted_at;
  }
}

export const testEdgeGlobalSchema = {
  extraEdgeFields: {
    // need this to be lowerCamelCase because we do this based on field name
    // #510
    deletedAt: TimestampType({
      nullable: true,
      index: true,
      defaultValueOnCreate: () => null,
    }),
  },

  transformEdgeRead(): clause.Clause {
    return clause.Eq("deleted_at", null);
  },

  transformEdgeWrite(
    stmt: EdgeUpdateOperation,
  ): TransformedEdgeUpdateOperation | null {
    switch (stmt.op) {
      case SQLStatementOperation.Delete:
        return {
          op: SQLStatementOperation.Update,
          data: {
            deleted_at: new Date(),
          },
        };
    }
    return null;
  },
};
