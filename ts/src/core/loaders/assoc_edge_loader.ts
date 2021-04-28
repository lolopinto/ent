import DataLoader from "dataloader";
import {
  Context,
  ID,
  EdgeQueryableDataOptions,
  Loader,
  LoaderFactory,
} from "../base";
import {
  AssocEdge,
  loadCustomEdges,
  AssocEdgeConstructor,
  loadEdgeData,
  DefaultLimit,
  performRawQuery,
  loadEdgeForID2,
} from "../ent";
import * as clause from "../clause";
import { logEnabled } from "../logger";
import { cacheMap, getCustomLoader } from "./loader";

function createLoader<T extends AssocEdge>(
  options: EdgeQueryableDataOptions,
  edgeType: string,
  edgeCtr: AssocEdgeConstructor<T>,
) {
  const loaderOptions: DataLoader.Options<ID, T[]> = {};

  if (logEnabled("query")) {
    // This is fetched later...
    loaderOptions.cacheMap = new cacheMap({
      tableName: "TODO",
    });
  }

  return new DataLoader(async (keys: ID[]) => {
    if (keys.length === 1) {
      // 1 key, just be simple and move on
      // same as AssocDirectEdgeLoader
      const r = await loadCustomEdges({
        id1: keys[0],
        edgeType: edgeType,
        queryOptions: options,
        ctr: edgeCtr,
      });
      return [r];
    }

    const edgeData = await loadEdgeData(edgeType);
    if (!edgeData) {
      throw new Error(`error loading edge data for ${edgeType}`);
    }

    let m = new Map<ID, number>();
    let result: T[][] = [];
    for (let i = 0; i < keys.length; i++) {
      result.push([]);
      // store the index....
      m.set(keys[i], i);
    }

    options.orderby = options.orderby || "time DESC";
    let orderby = `ORDER BY t2.${options.orderby}`;
    // TODO defaultEdgeQueryOptions
    options.limit = options.limit || DefaultLimit;
    let limit = `LIMIT ${options.limit}`;

    const tableName = edgeData.edgeTable;
    const cls = clause.And(
      clause.In(`${tableName}.id1`, ...keys),
      clause.Eq(`${tableName}.edge_type`, edgeType),
    );

    const query =
      `SELECT DISTINCT t.id1, t.id2, t.edge_type, t.time, id1_type, id2_type, data from ${tableName} inner join lateral ` +
      `(SELECT DISTINCT id1, id2, edge_type, time from ${tableName} t2 where t2.id1 = ${tableName}.id1 ${orderby} ${limit}) t on true WHERE ` +
      cls.clause(1) +
      " ORDER BY time DESC";

    const rows = await performRawQuery(query, cls.values(), cls.logValues());
    // console.log(query);
    // console.log(rows);
    for (const row of rows) {
      const srcID = row.id1;
      const idx = m.get(srcID);
      if (idx === undefined) {
        throw new Error(
          `malformed query. got ${srcID} back but didn't query for it`,
        );
      }
      result[idx].push(new edgeCtr(row));
    }
    //    console.log(result);
    return result;
  }, loaderOptions);
}

interface AssocLoader<T extends AssocEdge> extends Loader<ID, T[]> {
  loadEdgeForID2(id: ID, id2: ID): Promise<T | undefined>;
}

export class AssocEdgeLoader<T extends AssocEdge> implements Loader<ID, T[]> {
  private loader: DataLoader<ID, T[]>;
  constructor(
    private edgeType: string,
    private edgeCtr: AssocEdgeConstructor<T>,
    options: EdgeQueryableDataOptions,
    public context: Context,
  ) {
    this.loader = createLoader(options, edgeType, edgeCtr);
  }

  async load(id: ID): Promise<T[]> {
    return this.loader.load(id);
  }

  // maybe eventually optimize this
  async loadEdgeForID2(id: ID, id2: ID) {
    return loadEdgeForID2({
      id1: id,
      edgeType: this.edgeType,
      id2,
      context: this.context,
      ctr: this.edgeCtr,
    });
  }
}

export class AssocDirectEdgeLoader<T extends AssocEdge>
  implements Loader<ID, T[]> {
  constructor(
    private edgeType: string,
    private edgeCtr: AssocEdgeConstructor<T>,
    private options?: EdgeQueryableDataOptions,
    public context?: Context,
  ) {}

  async load(id: ID) {
    return await loadCustomEdges({
      id1: id,
      edgeType: this.edgeType,
      context: this.context,
      queryOptions: this.options,
      ctr: this.edgeCtr,
    });
  }

  async loadEdgeForID2(id: ID, id2: ID) {
    return loadEdgeForID2({
      id1: id,
      edgeType: this.edgeType,
      id2,
      context: this.context,
      ctr: this.edgeCtr,
    });
  }
}

export class AssocEdgeLoaderFactory<T extends AssocEdge>
  implements LoaderFactory<ID, T[]> {
  name: string;

  constructor(
    private edgeType: string,
    private edgeCtr: AssocEdgeConstructor<T>,
  ) {
    this.name = `assocEdgeLoader:${edgeType}`;
  }

  createLoader(context?: Context) {
    return this.createConfigurableLoader({}, context);
  }

  createConfigurableLoader(
    options: EdgeQueryableDataOptions,
    context?: Context,
  ): AssocLoader<T> {
    // there's a clause which implies there's an offset or something else complicated
    // let's be simple for now and just return a regular Loader that does nothing fancy and hits
    // the db for each query
    // or no context. just do the simple query
    if (options?.clause || !context) {
      return new AssocDirectEdgeLoader(
        this.edgeType,
        this.edgeCtr,
        options,
        context,
      );
    }

    // we create a loader which can combine first X queries in the same fetch
    const key = `${this.name}:limit:${options.limit}:orderby:${options.orderby}`;
    return getCustomLoader(
      key,
      () => new AssocEdgeLoader(this.edgeType, this.edgeCtr, options, context),
      context,
    ) as AssocEdgeLoader<T>;
  }
}
