import {
  ID,
  Ent,
  Viewer,
  Data,
  LoadEntOptions,
  PrivacyPolicy,
} from "../../core/base";
import { loadEnt, loadEntX } from "../../core/ent";
import {
  AllowIfViewerRule,
  AlwaysDenyRule,
  AllowIfViewerInboundEdgeExistsRule,
  AllowIfConditionAppliesRule,
  AllowIfViewerIsEntPropertyRule,
} from "../../core/privacy";
import { getBuilderSchemaFromFields, SimpleAction } from "../builder";
import { StringType, UUIDType } from "../../schema";
import { EdgeType } from "./internal";
import { NodeType } from "./const";
import { IDViewer, IDViewerOptions } from "../../core/viewer";
import { table, uuid, text, timestamptz, index } from "../db/temp_db";
import { ObjectLoaderFactory } from "../../core/loaders";
import { convertDate } from "../../core/convert";
import { WriteOperation } from "../../action";

export class FakeTag implements Ent {
  readonly id: ID;
  readonly data: Data;
  readonly nodeType = NodeType.FakeUser;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly displayName: string;
  readonly canonicalName: string;
  readonly ownerID: string;

  getPrivacyPolicy(): PrivacyPolicy<this> {
    return {
      rules: [new AllowIfViewerIsEntPropertyRule("ownerID"), AlwaysDenyRule],
    };
  }

  constructor(public viewer: Viewer, data: Data) {
    this.data = data;
    this.id = data.id;
    this.createdAt = convertDate(data.created_at);
    this.updatedAt = convertDate(data.updated_at);
    this.displayName = data.display_name;
    this.canonicalName = data.canonical_name;
    this.ownerID = data.owner_id;
  }

  static getFields(): string[] {
    return [
      "id",
      "created_at",
      "updated_at",
      "display_name",
      "canonical_name",
      "owner_id",
    ];
  }

  static getTestTable() {
    return table(
      "fake_tags",
      uuid("id", { primaryKey: true }),
      timestamptz("created_at"),
      timestamptz("updated_at"),
      text("display_name"),
      text("canonical_name"),
      uuid("owner_id"), // TODO index: true sqlite broken?
      index("fake_tags", ["canonical_name", "owner_id"], { unique: true }),
    );
  }

  static loaderOptions(): LoadEntOptions<FakeTag> {
    return {
      tableName: "fake_tags",
      fields: FakeTag.getFields(),
      ent: this,
      loaderFactory: tagLoader,
    };
  }
  static async load(v: Viewer, id: ID): Promise<FakeTag | null> {
    return loadEnt(v, id, FakeTag.loaderOptions());
  }

  static async loadX(v: Viewer, id: ID): Promise<FakeTag> {
    return loadEntX(v, id, FakeTag.loaderOptions());
  }
}

export const FakeTagSchema = getBuilderSchemaFromFields(
  {
    displayName: StringType(),
    canonicalName: StringType().trim().toLowerCase(),
    ownerID: UUIDType({}),
  },
  FakeTag,
);

export interface TagCreateInput {
  displayName: string;
  canonicalName: string;
  ownerID: ID;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TagEditInput = Partial<TagCreateInput>;

export function getTagBuilder(viewer: Viewer, input: TagCreateInput) {
  const action = getTagAction(viewer, input);
  return action.builder;
}

export function getTagAction(viewer: Viewer, input: TagCreateInput) {
  const m = new Map();
  for (const key in input) {
    m.set(key, input[key]);
  }
  const action = new SimpleAction(
    viewer,
    FakeTagSchema,
    m,
    WriteOperation.Insert,
    null,
  );
  return action;
}

export async function createTag(viewer: Viewer, input: TagCreateInput) {
  const action = getTagAction(viewer, input);
  return action.saveX();
}

export const tagLoader = new ObjectLoaderFactory({
  tableName: "fake_tags",
  fields: FakeTag.getFields(),
  key: "id",
});
