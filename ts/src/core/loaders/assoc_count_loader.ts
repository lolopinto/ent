import DataLoader from "dataloader";
import { ID, Context, Loader, LoaderFactory } from "../base";
import { loadEdgeData, loadRawEdgeCountX } from "../ent";
import * as clause from "../clause";
import { getLoader } from "./loader";
import { createCountDataLoader } from "./raw_count_loader";
import memoize from "memoizee";

export class AssocEdgeCountLoader implements Loader<ID, number> {
  private loaderFn: () => Promise<DataLoader<ID, number>>;

  constructor(private edgeType: string, public context?: Context) {
    if (context) {
      this.loaderFn = memoize(this.getLoader);
    }
  }

  private async getLoader() {
    const edgeData = await loadEdgeData(this.edgeType);
    if (!edgeData) {
      throw new Error(`error loading edge data for ${this.edgeType}`);
    }

    return createCountDataLoader(
      { tableName: edgeData.edgeTable },
      "id1",
      clause.Eq("edge_type", this.edgeType),
    );
  }

  async load(id: ID): Promise<number> {
    if (!this.loaderFn) {
      return loadRawEdgeCountX({
        id1: id,
        edgeType: this.edgeType,
      });
    }
    const loader = await this.loaderFn();
    return await loader.load(id);
  }
}

export class AssocEdgeCountLoaderFactory implements LoaderFactory<ID, number> {
  name: string;
  constructor(private edgeType: string) {
    this.name = `assocEdgeLoader:count:${edgeType}`;
  }

  createLoader(context?: Context): AssocEdgeCountLoader {
    return getLoader(
      this,
      () => new AssocEdgeCountLoader(this.edgeType, context),
      context,
    ) as AssocEdgeCountLoader;
  }
}
