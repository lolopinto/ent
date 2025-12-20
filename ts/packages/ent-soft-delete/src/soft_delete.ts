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
  Viewer,
  query,
  Clause
} from "@snowtop/ent";

export class DeletedAtPattern implements Pattern {
  name = "deleted_at";

  disableMixin = true;

  fields: FieldMap = {
    deleted_at: TimestampType({
      nullable: true,
      // Node table index for soft delete reads on ents.
      index: true,
      defaultValueOnCreate: () => null,
      hideFromGraphQL: true,
      private: true,
    }),
  };

  transformRead(): Clause {
    return query.Eq("deleted_at", null);
  }

  transformReadCodegen_BETA(): string {
    return `query.Eq('deleted_at', null)`;
  }

  transformWrite<T extends Ent<TViewer>, TViewer extends Viewer>(
    stmt: UpdateOperation<T, TViewer>,
  ): TransformedUpdateOperation<T, TViewer> | null {
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
  extraEdgeFields: {
    deleted_at: TimestampType({
      nullable: true,
      defaultValueOnCreate: () => null,
    }),
  },
  edgeIndices: [
    {
      // Edge table composite index for edge queries with soft delete.
      columns: ["id1", "edge_type", "deleted_at"],
    },
  ],

  transformEdgeRead(): Clause {
    return query.Eq("deleted_at", null);
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
