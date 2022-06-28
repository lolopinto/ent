import {
  Pattern,
  TimestampType,
  Field,
  Ent,
  UpdateOperation,
  TransformedUpdateOperation,
  SQLStatementOperation,
} from "@snowtop/ent";
import * as clause from "@snowtop/ent/core/clause";

export class DeletedAtPattern implements Pattern {
  name = "deleted_at";

  fields: Field[] = [
    TimestampType({
      name: "deleted_at",
      nullable: true,
      index: true,
      defaultValueOnCreate: () => null,
      hideFromGraphQL: true,
      private: true,
    }),
  ];

  transformRead(): clause.Clause {
    return clause.Eq("deleted_at", null);
  }

  transformWrite<T extends Ent>(
    stmt: UpdateOperation<T>,
  ): TransformedUpdateOperation<T> | undefined {
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
  }

  transformsDelete = true;
}
