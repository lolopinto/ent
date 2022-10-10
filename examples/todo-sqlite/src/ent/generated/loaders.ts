// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { ObjectLoaderFactory } from "@snowtop/ent";
import { getObjectLoaderProperties } from "@snowtop/ent/schema";
import AccountSchema from "src/schema/account_schema";
import TagSchema from "src/schema/tag_schema";
import TodoSchema from "src/schema/todo_schema";
import { NodeType } from "./const";

const accountTable = "accounts";
const accountFields = [
  "id",
  "created_at",
  "updated_at",
  "deleted_at",
  "name",
  "phone_number",
  "account_state",
  "account_prefs",
];

export const accountLoader = new ObjectLoaderFactory({
  tableName: accountTable,
  fields: accountFields,
  key: "id",
  ...getObjectLoaderProperties(AccountSchema, accountTable),
});

export const accountPhoneNumberLoader = new ObjectLoaderFactory({
  tableName: accountTable,
  fields: accountFields,
  key: "phone_number",
  ...getObjectLoaderProperties(AccountSchema, accountTable),
});

export const accountNoTransformLoader = new ObjectLoaderFactory({
  tableName: accountTable,
  fields: accountFields,
  key: "id",
});

export const accountPhoneNumberNoTransformLoader = new ObjectLoaderFactory({
  tableName: accountTable,
  fields: accountFields,
  key: "phone_number",
});

export const accountLoaderInfo = {
  tableName: accountTable,
  fields: accountFields,
  nodeType: NodeType.Account,
  loaderFactory: accountLoader,
  fieldInfo: {
    ID: {
      dbCol: "id",
      inputKey: "id",
    },
    createdAt: {
      dbCol: "created_at",
      inputKey: "createdAt",
    },
    updatedAt: {
      dbCol: "updated_at",
      inputKey: "updatedAt",
    },
    deleted_at: {
      dbCol: "deleted_at",
      inputKey: "deletedAt",
    },
    Name: {
      dbCol: "name",
      inputKey: "name",
    },
    PhoneNumber: {
      dbCol: "phone_number",
      inputKey: "phoneNumber",
    },
    accountState: {
      dbCol: "account_state",
      inputKey: "accountState",
    },
    accountPrefs: {
      dbCol: "account_prefs",
      inputKey: "accountPrefs",
    },
  },
};

accountLoader.addToPrime(accountPhoneNumberLoader);
accountPhoneNumberLoader.addToPrime(accountLoader);

accountNoTransformLoader.addToPrime(accountPhoneNumberNoTransformLoader);
accountPhoneNumberNoTransformLoader.addToPrime(accountNoTransformLoader);

const tagTable = "tags";
const tagFields = [
  "id",
  "created_at",
  "updated_at",
  "deleted_at",
  "display_name",
  "canonical_name",
  "owner_id",
  "related_tag_ids",
];

export const tagLoader = new ObjectLoaderFactory({
  tableName: tagTable,
  fields: tagFields,
  key: "id",
  ...getObjectLoaderProperties(TagSchema, tagTable),
});

export const tagNoTransformLoader = new ObjectLoaderFactory({
  tableName: tagTable,
  fields: tagFields,
  key: "id",
});

export const tagLoaderInfo = {
  tableName: tagTable,
  fields: tagFields,
  nodeType: NodeType.Tag,
  loaderFactory: tagLoader,
  fieldInfo: {
    ID: {
      dbCol: "id",
      inputKey: "id",
    },
    createdAt: {
      dbCol: "created_at",
      inputKey: "createdAt",
    },
    updatedAt: {
      dbCol: "updated_at",
      inputKey: "updatedAt",
    },
    deleted_at: {
      dbCol: "deleted_at",
      inputKey: "deletedAt",
    },
    DisplayName: {
      dbCol: "display_name",
      inputKey: "displayName",
    },
    canonicalName: {
      dbCol: "canonical_name",
      inputKey: "canonicalName",
    },
    ownerID: {
      dbCol: "owner_id",
      inputKey: "ownerID",
    },
    relatedTagIds: {
      dbCol: "related_tag_ids",
      inputKey: "relatedTagIds",
    },
  },
};

const todoTable = "todos";
const todoFields = [
  "id",
  "created_at",
  "updated_at",
  "deleted_at",
  "text",
  "completed",
  "creator_id",
  "completed_date",
];

export const todoLoader = new ObjectLoaderFactory({
  tableName: todoTable,
  fields: todoFields,
  key: "id",
  ...getObjectLoaderProperties(TodoSchema, todoTable),
});

export const todoNoTransformLoader = new ObjectLoaderFactory({
  tableName: todoTable,
  fields: todoFields,
  key: "id",
});

export const todoLoaderInfo = {
  tableName: todoTable,
  fields: todoFields,
  nodeType: NodeType.Todo,
  loaderFactory: todoLoader,
  fieldInfo: {
    ID: {
      dbCol: "id",
      inputKey: "id",
    },
    createdAt: {
      dbCol: "created_at",
      inputKey: "createdAt",
    },
    updatedAt: {
      dbCol: "updated_at",
      inputKey: "updatedAt",
    },
    deleted_at: {
      dbCol: "deleted_at",
      inputKey: "deletedAt",
    },
    Text: {
      dbCol: "text",
      inputKey: "text",
    },
    Completed: {
      dbCol: "completed",
      inputKey: "completed",
    },
    creatorID: {
      dbCol: "creator_id",
      inputKey: "creatorID",
    },
    completedDate: {
      dbCol: "completed_date",
      inputKey: "completedDate",
    },
  },
};

export function getLoaderInfoFromSchema(schema: string) {
  switch (schema) {
    case "Account":
      return accountLoaderInfo;
    case "Tag":
      return tagLoaderInfo;
    case "Todo":
      return todoLoaderInfo;
    default:
      throw new Error(
        `invalid schema ${schema} passed to getLoaderInfoFromSchema`,
      );
  }
}

export function getLoaderInfoFromNodeType(nodeType: NodeType) {
  switch (nodeType) {
    case NodeType.Account:
      return accountLoaderInfo;
    case NodeType.Tag:
      return tagLoaderInfo;
    case NodeType.Todo:
      return todoLoaderInfo;
    default:
      throw new Error(
        `invalid nodeType ${nodeType} passed to getLoaderInfoFromNodeType`,
      );
  }
}
