/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  AllowIfViewerPrivacyPolicy,
  Context,
  CustomQuery,
  Data,
  Ent,
  ID,
  LoadEntOptions,
  PrivacyPolicy,
  loadCustomCount,
  loadCustomData,
  loadCustomEnts,
  loadEnt,
  loadEntX,
  loadEnts,
} from "@snowtop/ent";
import { Field, getFields } from "@snowtop/ent/schema";
import {
  HoursOfOperationDBData,
  hoursOfOperationLoader,
  hoursOfOperationLoaderInfo,
} from "./loaders";
import { NodeType } from "./types";
import { DayOfWeekMixin, IDayOfWeek } from "../internal";
import schema from "../../schema/hours_of_operation_schema";
import { ExampleViewer as ExampleViewerAlias } from "../../viewer/viewer";

export class HoursOfOperationBase
  extends DayOfWeekMixin(class {})
  implements Ent<ExampleViewerAlias>, IDayOfWeek
{
  protected readonly data: HoursOfOperationDBData;
  readonly nodeType = NodeType.HoursOfOperation;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly open: string;
  readonly close: string;

  constructor(public viewer: ExampleViewerAlias, data: Data) {
    // @ts-ignore pass to mixin
    super(viewer, data);
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.open = data.open;
    this.close = data.close;
    // @ts-expect-error
    this.data = data;
  }

  __setRawDBData<HoursOfOperationDBData>(data: HoursOfOperationDBData) {}

  /** used by some ent internals to get access to raw db data. should not be depended on. may not always be on the ent **/
  ___getRawDBData(): HoursOfOperationDBData {
    return this.data;
  }

  getPrivacyPolicy(): PrivacyPolicy<this, ExampleViewerAlias> {
    return AllowIfViewerPrivacyPolicy;
  }

  static async load<T extends HoursOfOperationBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    viewer: ExampleViewerAlias,
    id: ID,
  ): Promise<T | null> {
    return (await loadEnt(
      viewer,
      id,
      HoursOfOperationBase.loaderOptions.apply(this),
    )) as T | null;
  }

  static async loadX<T extends HoursOfOperationBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    viewer: ExampleViewerAlias,
    id: ID,
  ): Promise<T> {
    return (await loadEntX(
      viewer,
      id,
      HoursOfOperationBase.loaderOptions.apply(this),
    )) as T;
  }

  static async loadMany<T extends HoursOfOperationBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    viewer: ExampleViewerAlias,
    ...ids: ID[]
  ): Promise<Map<ID, T>> {
    return (await loadEnts(
      viewer,
      HoursOfOperationBase.loaderOptions.apply(this),
      ...ids,
    )) as Map<ID, T>;
  }

  static async loadCustom<T extends HoursOfOperationBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    viewer: ExampleViewerAlias,
    query: CustomQuery<HoursOfOperationDBData>,
  ): Promise<T[]> {
    return (await loadCustomEnts(
      viewer,
      {
        ...HoursOfOperationBase.loaderOptions.apply(this),
        prime: true,
      },
      query,
    )) as T[];
  }

  static async loadCustomData<T extends HoursOfOperationBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    query: CustomQuery<HoursOfOperationDBData>,
    context?: Context,
  ): Promise<HoursOfOperationDBData[]> {
    return loadCustomData<HoursOfOperationDBData, HoursOfOperationDBData>(
      {
        ...HoursOfOperationBase.loaderOptions.apply(this),
        prime: true,
      },
      query,
      context,
    );
  }

  static async loadCustomCount<T extends HoursOfOperationBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    query: CustomQuery<HoursOfOperationDBData>,
    context?: Context,
  ): Promise<number> {
    return loadCustomCount(
      {
        ...HoursOfOperationBase.loaderOptions.apply(this),
      },
      query,
      context,
    );
  }

  static async loadRawData<T extends HoursOfOperationBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    id: ID,
    context?: Context,
  ): Promise<HoursOfOperationDBData | null> {
    return hoursOfOperationLoader.createLoader(context).load(id);
  }

  static async loadRawDataX<T extends HoursOfOperationBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    id: ID,
    context?: Context,
  ): Promise<HoursOfOperationDBData> {
    const row = await hoursOfOperationLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row;
  }

  static loaderOptions<T extends HoursOfOperationBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
  ): LoadEntOptions<T, ExampleViewerAlias, HoursOfOperationDBData> {
    return {
      tableName: hoursOfOperationLoaderInfo.tableName,
      fields: hoursOfOperationLoaderInfo.fields,
      ent: this,
      loaderFactory: hoursOfOperationLoader,
    };
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (HoursOfOperationBase.schemaFields != null) {
      return HoursOfOperationBase.schemaFields;
    }
    return (HoursOfOperationBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return HoursOfOperationBase.getSchemaFields().get(key);
  }
}
