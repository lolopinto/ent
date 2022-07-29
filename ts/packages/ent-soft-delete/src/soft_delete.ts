import {
  Pattern,
  TimestampType,
  Ent,
  UpdateOperation,
  TransformedUpdateOperation,
  SQLStatementOperation,
  FieldMap,
  EdgeUpdateOperation,
  TransformedEdgeUpdateOperation,
} from "@snowtop/ent";
import * as clause from "@snowtop/ent/core/clause";

export class DeletedAtPattern implements Pattern {
  name = "deleted_at";

  disableMixin = true;

  fields: FieldMap = {
    deleted_at: TimestampType({
      nullable: true,
      index: true,
      defaultValueOnCreate: () => null,
      hideFromGraphQL: true,
      private: true,
    }),
  };

  transformRead(): clause.Clause {
    return clause.Eq("deleted_at", null);
  }

  transformWrite<T extends Ent>(
    stmt: UpdateOperation<T>,
  ): TransformedUpdateOperation<T> | null {
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
  }

  transformsDelete = true;
}

export const GlobalDeletedEdge = {
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
