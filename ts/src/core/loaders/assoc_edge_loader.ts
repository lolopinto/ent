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
  buildGroupQuery,
  AssocEdgeData,
} from "../ent";
import * as clause from "../clause";
import { logEnabled } from "../logger";
import { cacheMap, getCustomLoader } from "./loader";
import memoizee from "memoizee";

function createLoader<T extends AssocEdge>(
  options: EdgeQueryableDataOptions,
  edgeType: string,
  edgeCtr: AssocEdgeConstructor<T>,
  edgeData: AssocEdgeData,
) {
  const loaderOptions: DataLoader.Options<ID, T[]> = {};

  if (logEnabled("query")) {
    loaderOptions.cacheMap = new cacheMap({
      tableName: edgeData.edgeTable,
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

    let m = new Map<ID, number>();
    let result: T[][] = [];
    for (let i = 0; i < keys.length; i++) {
      result.push([]);
      // store the index....
      m.set(keys[i], i);
    }

    options.orderby = options.orderby || "time DESC";
    // TODO defaultEdgeQueryOptions
    options.limit = options.limit || DefaultLimit;

    const tableName = edgeData.edgeTable;
    const [query, cls] = buildGroupQuery({
      tableName: tableName,
      fields: [
        "id1",
        "id2",
        "edge_type",
        "id1_type",
        "id2_type",
        "data",
        "time",
      ],
      values: keys,
      orderby: options.orderby,
      limit: options.limit || DefaultLimit,
      groupColumn: "id1",
      clause: clause.Eq("edge_type", edgeType),
    });

    const rows = await performRawQuery(query, cls.values(), cls.logValues());
    for (const row of rows) {
      const srcID = row.id1;
      const idx = m.get(srcID);
      delete row.row_num;
      if (idx === undefined) {
        throw new Error(
          `malformed query. got ${srcID} back but didn't query for it`,
        );
      }
      result[idx].push(new edgeCtr(row));
    }
    return result;
  }, loaderOptions);
}

interface AssocLoader<T extends AssocEdge> extends Loader<ID, T[]> {
  loadEdgeForID2(id: ID, id2: ID): Promise<T | undefined>;
}

export class AssocEdgeLoader<T extends AssocEdge> implements Loader<ID, T[]> {
  private loaderFn: () => Promise<DataLoader<ID, T[]>>;
  private loader: DataLoader<ID, T[]> | undefined;
  constructor(
    private edgeType: string,
    private edgeCtr: AssocEdgeConstructor<T>,
    private options: EdgeQueryableDataOptions,
    public context: Context,
  ) {
    this.loaderFn = memoizee(this.getLoader);
  }

  private async getLoader() {
    const edgeData = await loadEdgeData(this.edgeType);
    if (!edgeData) {
      throw new Error(`error loading edge data for ${this.edgeType}`);
    }
    this.loader = createLoader(
      this.options,
      this.edgeType,
      this.edgeCtr,
      edgeData,
    );
    return this.loader;
  }

  async load(id: ID): Promise<T[]> {
    const loader = await this.loaderFn();
    return loader.load(id);
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

  clearAll() {
    this.loader && this.loader.clearAll();
  }
}

export class AssocDirectEdgeLoader<T extends AssocEdge>
  implements Loader<ID, T[]>
{
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

  clearAll() {}
}

export class AssocEdgeLoaderFactory<T extends AssocEdge>
  implements LoaderFactory<ID, T[]>
{
  name: string;

  constructor(
    private edgeType: string,
    private edgeCtr: AssocEdgeConstructor<T> | (() => AssocEdgeConstructor<T>),
  ) {
    this.name = `assocEdgeLoader:${edgeType}`;
  }

  createLoader(context?: Context) {
    return this.createConfigurableLoader({}, context);
  }

  private isFunction(
    edgeCtr: AssocEdgeConstructor<T> | (() => AssocEdgeConstructor<T>),
  ): edgeCtr is () => AssocEdgeConstructor<T> {
    // not constructor
    return !(edgeCtr.prototype && edgeCtr.prototype.constructor === edgeCtr);
  }

  createConfigurableLoader(
    options: EdgeQueryableDataOptions,
    context?: Context,
  ): AssocLoader<T> {
    let edgeCtr = this.edgeCtr;
    // in generated code, the edge is not necessarily defined at the time of loading
    // so we call this as follows:
    // const loader = new AssocEdgeLoaderFactory(EdgeType.Foo, ()=>DerivedEdgeClass);
    if (this.isFunction(edgeCtr)) {
      edgeCtr = edgeCtr();
    }
    // rename to make TS happy
    let ctr: AssocEdgeConstructor<T> = edgeCtr;

    // there's a clause which implies there's an offset or something else complicated
    // let's be simple for now and just return a regular Loader that does nothing fancy and hits
    // the db for each query
    // or no context. just do the simple query
    if (options?.clause || !context) {
      return new AssocDirectEdgeLoader(
        this.edgeType,
        edgeCtr,
        options,
        context,
      );
    }

    // we create a loader which can combine first X queries in the same fetch
    const key = `${this.name}:limit:${options.limit}:orderby:${options.orderby}`;
    return getCustomLoader(
      key,
      () => new AssocEdgeLoader(this.edgeType, ctr, options, context),
      context,
    ) as AssocEdgeLoader<T>;
  }
}
