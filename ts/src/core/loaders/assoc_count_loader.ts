import DataLoader from "dataloader";
import {
  ID,
  Context,
  Loader,
  LoaderFactory,
  EdgeQueryableDataOptionsConfigureLoader,
} from "../base";
import {
  getEdgeClauseAndFields,
  loadEdgeData,
  loadRawEdgeCountX,
} from "../ent";
import * as clause from "../clause";
import { getCustomLoader, getLoader } from "./loader";
import { createCountDataLoader } from "./raw_count_loader";
import memoize from "memoizee";

export class AssocEdgeCountLoader implements Loader<ID, number> {
  private loaderFn: () => Promise<DataLoader<ID, number>>;
  private loader: DataLoader<ID, number> | undefined;

  constructor(
    private edgeType: string,
    public context?: Context,
    private options?: EdgeQueryableDataOptionsConfigureLoader,
  ) {
    if (context) {
      this.loaderFn = memoize(this.getLoader);
    }
  }

  private async getLoader() {
    const edgeData = await loadEdgeData(this.edgeType);
    if (!edgeData) {
      throw new Error(`error loading edge data for ${this.edgeType}`);
    }
    const { cls } = getEdgeClauseAndFields(
      clause.Eq("edge_type", this.edgeType),
      {
        queryOptions: this.options,
      },
    );

    this.loader = createCountDataLoader({
      tableName: edgeData.edgeTable,
      groupCol: "id1",
      clause: cls,
    });
    return this.loader;
  }

  async load(id: ID): Promise<number> {
    if (!this.loaderFn) {
      return loadRawEdgeCountX({
        id1: id,
        edgeType: this.edgeType,
        queryOptions: this.options,
      });
    }
    const loader = await this.loaderFn();
    return loader.load(id);
  }

  clearAll() {
    this.loader && this.loader.clearAll();
  }
}

export class AssocEdgeCountLoaderFactory implements LoaderFactory<ID, number> {
  name: string;
  constructor(private edgeType: string) {
    this.name = `assocEdgeLoader:count:${edgeType}`;
  }

  getEdgeType() {
    return this.edgeType;
  }

  createLoader(context?: Context): AssocEdgeCountLoader {
    return getLoader(
      this,
      () => new AssocEdgeCountLoader(this.edgeType, context),
      context,
    ) as AssocEdgeCountLoader;
  }

  createConfigurableLoader(
    options: EdgeQueryableDataOptionsConfigureLoader,
    context?: Context,
  ): AssocEdgeCountLoader {
    const key = `${this.name}:disableTransformations:${options.disableTransformations}`;
    return getCustomLoader(
      key,
      () => new AssocEdgeCountLoader(this.edgeType, context, options),
      context,
    ) as AssocEdgeCountLoader;
  }
}
