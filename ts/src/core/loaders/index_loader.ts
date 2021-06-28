import {
  ID,
  SelectBaseDataOptions,
  Context,
  Data,
  LoaderFactory,
  EdgeQueryableDataOptions,
} from "../base";
import * as clause from "../clause";
import { ObjectLoaderFactory } from "./object_loader";
import { QueryLoaderFactory } from "./query_loader";

// we're keeping this for legacy reasons so as to not break existing callers
// and to decouple the change here but all callers can safely be changed here to use QueryLoaderFactory
export class IndexLoaderFactory implements LoaderFactory<ID, Data[]> {
  name: string;
  private factory: QueryLoaderFactory<ID>;
  constructor(
    options: SelectBaseDataOptions,
    col: string,
    opts?: {
      extraClause?: clause.Clause;
      sortColumn?: string;
      toPrime?: ObjectLoaderFactory<ID>[];
    },
  ) {
    this.factory = new QueryLoaderFactory({
      fields: options.fields,
      tableName: options.tableName,
      groupCol: col,
      clause: opts?.extraClause,
      sortColumn: opts?.sortColumn,
      toPrime: opts?.toPrime,
    });
    this.name = `indexLoader:${options.tableName}:${col}`;
  }

  createLoader(context?: Context) {
    return this.factory.createLoader(context);
  }

  createConfigurableLoader(
    options: EdgeQueryableDataOptions,
    context?: Context,
  ) {
    return this.factory.createConfigurableLoader(options, context);
  }
}
