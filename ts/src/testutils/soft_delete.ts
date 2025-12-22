import { advanceTo } from "jest-date-mock";
import { WriteOperation } from "../action/index.js";
import { EntChangeset } from "../action/orchestrator.js";
import { Context, Data, Ent, Viewer } from "../core/base.js";
import { LoggedOutViewer } from "../core/viewer.js";
import { StringType, TimestampType } from "../schema/field.js";
import {
  Pattern,
  UpdateOperation,
  TransformedUpdateOperation,
  SQLStatementOperation,
} from "../schema/index.js";
import {
  SimpleAction,
  Contact,
  EntBuilderSchema,
  BaseEnt,
} from "../testutils/builder.js";
import { createRowForTest } from "../testutils/write.js";
import * as clause from "../core/clause.js";
import DB, { Dialect } from "../core/db.js";
import { ObjectLoaderFactory } from "../core/loaders/index.js";
import { TestContext } from "../testutils/context/test_context.js";
import {
  assoc_edge_config_table,
  assoc_edge_table,
  getSchemaTable,
  setupSqlite,
  Table,
  TempDB,
} from "../testutils/db/temp_db.js";
import { convertDate } from "../core/convert.js";
import { FieldMap } from "../schema/index.js";
import { loadRawEdgeCountX } from "../core/ent.js";

// custom Viewer interface
// IDViewer and LoggedOutViewer implicitly implement this
interface CustomViewer extends Viewer {
  marker: string;
}

export class DeletedAtPattern implements Pattern {
  name = "deleted_at";
  fields: FieldMap = {
    deletedAt: TimestampType({
      nullable: true,
      index: true,
      defaultValueOnCreate: () => null,
    }),
  };

  transformRead(): clause.Clause {
    // this is based on sql. other is based on field
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
            // this should return field, it'll be formatted as needed
            deletedAt: new Date(),
          },
        };
    }
    return null;
  }
}

export class DeletedAtSnakeCasePattern implements Pattern {
  name = "deleted_at";
  fields: FieldMap = {
    deleted_at: TimestampType({
      nullable: true,
      index: true,
      defaultValueOnCreate: () => null,
    }),
  };

  transformRead(): clause.Clause {
    // this is based on sql. other is based on field
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
            // this should return field, it'll be formatted as needed
            deleted_at: new Date(),
          },
        };
    }
    return null;
  }
}

export class DeletedAtPatternWithExtraWrites implements Pattern {
  name = "deleted_at";
  fields: FieldMap = {
    deletedAt: TimestampType({
      nullable: true,
      index: true,
      defaultValueOnCreate: () => null,
    }),
  };

  transformRead(): clause.Clause {
    // this is based on sql. other is based on field
    return clause.Eq("deleted_at", null);
  }

  transformWrite<T extends Ent<TViewer>, TViewer extends Viewer = CustomViewer>(
    stmt: UpdateOperation<T, TViewer>,
  ): TransformedUpdateOperation<T, TViewer> | null {
    switch (stmt.op) {
      case SQLStatementOperation.Delete:
        return {
          op: SQLStatementOperation.Update,
          data: {
            // this should return field, it'll be formatted as needed
            deletedAt: new Date(),
          },
          changeset: () =>
            EntChangeset.changesetFromQueries(stmt.builder, [
              `DELETE FROM edge_table WHERE id1 = '${stmt.builder.existingEnt?.id}'`,
              `DELETE FROM inverse_edge_table WHERE id1 = '${stmt.builder.existingEnt?.id}'`,
              `DELETE FROM symmetric_edge_table WHERE id1 = '${stmt.builder.existingEnt?.id}'`,
              {
                query: `DELETE FROM edge_table WHERE id2 = ${
                  DB.getDialect() === Dialect.Postgres ? "$1" : "?"
                }`,
                values: [stmt.builder.existingEnt?.id],
              },
              {
                query: `DELETE FROM inverse_edge_table WHERE id2 = ${
                  DB.getDialect() === Dialect.Postgres ? "$1" : "?"
                }`,
                values: [stmt.builder.existingEnt?.id],
              },
              {
                query: `DELETE FROM symmetric_edge_table WHERE id2 = ${
                  DB.getDialect() === Dialect.Postgres ? "$1" : "?"
                }`,
                values: [stmt.builder.existingEnt?.id],
              },
            ]),
        };
    }
    return null;
  }
}
