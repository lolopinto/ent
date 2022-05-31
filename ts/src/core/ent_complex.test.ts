import {
  User,
  SimpleAction,
  getTableName,
  getFieldInfo,
} from "../testutils/builder";
import {
  BaseEntSchema,
  BooleanType,
  EnumType,
  JSONBType,
  StringType,
  UUIDType,
  getFields,
  getFieldsWithPrivacy,
  getStorageKey,
  FieldMap,
  Schema,
} from "../schema";
import {
  AllowIfViewerInboundEdgeExistsRule,
  AllowIfViewerRule,
  AlwaysDenyPrivacyPolicy,
  AlwaysDenyRule,
} from "./privacy";
import {
  assoc_edge_config_table,
  assoc_edge_table,
  getSchemaTable,
  TempDB,
} from "../testutils/db/test_db";
import { Dialect } from "./db";
import { LoggedOutViewer } from "./viewer";
import { WriteOperation } from "../action";
import { loadEnt } from "./ent";
import { IDViewer } from "./viewer";
import { ObjectLoaderFactory } from "./loaders";
import { loadConfig } from "./config";
import { createRowForTest } from "../testutils/write";
import { snakeCase } from "snake-case";
import {
  Allow,
  Ent,
  PrivacyPolicy,
  PrivacyPolicyRule,
  Viewer,
  Skip,
  ID,
  Data,
} from "./base";

import email from "email-addresses";
import { TestContext } from "../testutils/context/test_context";

function isParsedMailbox(
  mailboxOrGroup: email.ParsedMailbox | email.ParsedGroup | null,
): mailboxOrGroup is email.ParsedMailbox {
  return mailboxOrGroup !== null && mailboxOrGroup.type === "mailbox";
}

const ignoredDomains = {
  "gmail.com": true,
  "yahoo.com": true,
  "aol.com": true,
  // etc...
};

function domainFromRow(row: Data | null | undefined) {
  if (!row) {
    return null;
  }
  const mb = email.parseOneAddress(row.email_address);
  if (!isParsedMailbox(mb)) {
    return null;
  }
  if (ignoredDomains[mb.domain]) {
    return null;
  }
  return mb.domain;
}

async function loadDomainFromID(v: Viewer, id: ID) {
  const row = await userLoaderFactory.createLoader(v.context).load(id);
  return domainFromRow(row);
}

async function loadDomainFromEnt(v: Viewer, id: ID) {
  const ent = await loadEnt(v, id, accountLoaderOptions);
  return domainFromRow(ent?.data);
}

const allowIfInSameOrgRule: PrivacyPolicyRule = {
  async apply(v: Viewer, ent?: Ent) {
    if (!v.viewerID || !ent) {
      return Skip();
    }
    const [viewerDomain, targetDomain] = await Promise.all([
      loadDomainFromID(v, v.viewerID),
      loadDomainFromID(v, ent.id),
    ]);

    if (viewerDomain === null || targetDomain === null) {
      return Skip();
    }

    return viewerDomain === targetDomain ? Allow() : Skip();
  },
};

const allowIfInSameOrgRuleLoadEnt: PrivacyPolicyRule = {
  async apply(v: Viewer, ent?: Ent) {
    if (!v.viewerID || !ent) {
      return Skip();
    }
    const [viewerDomain, targetDomain] = await Promise.all([
      loadDomainFromEnt(v, v.viewerID),
      loadDomainFromEnt(v, ent.id),
    ]);

    if (viewerDomain === null || targetDomain === null) {
      return Skip();
    }

    return viewerDomain === targetDomain ? Allow() : Skip();
  },
};

const sharedPolicy: PrivacyPolicy = {
  rules: [
    AllowIfViewerRule,
    // TODO https://github.com/lolopinto/ent/issues/874
    new AllowIfViewerInboundEdgeExistsRule("friends"),
    allowIfInSameOrgRule,
    AlwaysDenyRule,
  ],
};

const sharedPolicyLoadEnt: PrivacyPolicy = {
  rules: [
    AllowIfViewerRule,
    // TODO https://github.com/lolopinto/ent/issues/874
    new AllowIfViewerInboundEdgeExistsRule("friends"),
    allowIfInSameOrgRuleLoadEnt,
    AlwaysDenyRule,
  ],
};

class UserSchema extends BaseEntSchema {
  ent = User;

  fields: FieldMap = {
    firstName: StringType({
      privacyPolicy: sharedPolicy,
    }),
    lastName: StringType({
      privacyPolicy: sharedPolicy,
    }),
    emailAddress: StringType({
      privacyPolicy: sharedPolicy,
    }),
    phoneNumber: StringType({
      privacyPolicy: sharedPolicy,
    }),
    bio: StringType({
      privacyPolicy: sharedPolicy,
    }),
    password: StringType({
      private: true,
      hideFromGraphQL: true,
      privacyPolicy: AlwaysDenyPrivacyPolicy,
    }),
    accountStatus: EnumType({
      nullable: true,
      values: ["UNVERIFIED", "VERIFIED", "DEACTIVATED", "DISABLED"],
      defaultValueOnCreate: () => "UNVERIFIED",
      privacyPolicy: sharedPolicy,
    }),
    emailVerified: BooleanType({
      hideFromGraphQL: true,
      serverDefault: "FALSE",
      defaultValueOnCreate: () => false,
      privacyPolicy: sharedPolicy,
    }),
    birthday: StringType({
      privacyPolicy: sharedPolicy,
    }),
    prefs: JSONBType({
      nullable: true,
      privacyPolicy: sharedPolicy,
    }),
    foo_id: UUIDType({
      nullable: true,
      privacyPolicy: sharedPolicy,
    }),
    bar_id: UUIDType({
      nullable: true,
      privacyPolicy: sharedPolicy,
    }),
    baz_id: UUIDType({
      nullable: true,
      privacyPolicy: sharedPolicy,
    }),
  };
}

// basically same as UserSchema but more complicated privacy policy
class AccountSchema extends BaseEntSchema {
  ent = User;

  fields: FieldMap = {
    firstName: StringType({
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    lastName: StringType({
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    emailAddress: StringType({
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    phoneNumber: StringType({
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    bio: StringType({
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    password: StringType({
      private: true,
      hideFromGraphQL: true,
      privacyPolicy: AlwaysDenyPrivacyPolicy,
    }),
    accountStatus: EnumType({
      nullable: true,
      values: ["UNVERIFIED", "VERIFIED", "DEACTIVATED", "DISABLED"],
      defaultValueOnCreate: () => "UNVERIFIED",
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    emailVerified: BooleanType({
      hideFromGraphQL: true,
      serverDefault: "FALSE",
      defaultValueOnCreate: () => false,
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    birthday: StringType({
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    prefs: JSONBType({
      nullable: true,
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    foo_id: UUIDType({
      nullable: true,
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    bar_id: UUIDType({
      nullable: true,
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    baz_id: UUIDType({
      nullable: true,
      privacyPolicy: sharedPolicyLoadEnt,
    }),
  };
}

function getCols(schema: Schema) {
  const fields = getFields(schema);
  let cols: string[] = [];
  for (const [k, f] of fields) {
    cols.push(getStorageKey(f, k));
  }
  return cols;
}

const userSchema = new UserSchema();
const userFields = getCols(userSchema);
const userTableName = getTableName(userSchema);
const userLoaderFactory = new ObjectLoaderFactory({
  tableName: userTableName,
  fields: userFields,
  key: "id",
});
const userLoaderOptions = {
  tableName: userTableName,
  fields: userFields,
  ent: User,
  loaderFactory: userLoaderFactory,
  fieldPrivacy: getFieldsWithPrivacy(userSchema, getFieldInfo(userSchema)),
};

const accountSchema = new AccountSchema();
const accountFields = getCols(accountSchema);
const accountTableName = getTableName(accountSchema);
const accountLoaderFactory = new ObjectLoaderFactory({
  tableName: accountTableName,
  fields: accountFields,
  key: "id",
});
const accountLoaderOptions = {
  tableName: userTableName,
  fields: userFields,
  ent: User,
  loaderFactory: accountLoaderFactory,
  fieldPrivacy: getFieldsWithPrivacy(
    accountSchema,
    getFieldInfo(accountSchema),
  ),
};

let tdb: TempDB;
beforeAll(async () => {
  tdb = new TempDB([
    getSchemaTable(userSchema, Dialect.Postgres),
    getSchemaTable(accountSchema, Dialect.Postgres),
    assoc_edge_config_table(),
    assoc_edge_table("friends_table"),
  ]);

  await tdb.beforeAll();

  await createRowForTest({
    tableName: "assoc_edge_config",
    fields: {
      edge_table: snakeCase(`friends_table`),
      symmetric_edge: true,
      inverse_edge_type: null,
      edge_type: "friends",
      edge_name: "friends",
      created_at: new Date(),
      updated_at: new Date(),
    },
  });
});

afterAll(async () => {
  await tdb.afterAll();
});

loadConfig({
  // log: "query",
});

async function createUser(email: string) {
  const action = new SimpleAction(
    new LoggedOutViewer(),
    userSchema,
    new Map([
      ["firstName", "Jon"],
      ["lastName", "Snow"],
      ["emailAddress", email],
      ["phoneNumber", "415-232-1943"],
      ["bio", "he who knows nothing"],
      ["password", "test123"],
      ["birthday", "jan 1"],
    ]),
    WriteOperation.Insert,
    null,
  );
  return action.saveX();
}

async function createAccount(email: string) {
  const action = new SimpleAction(
    new LoggedOutViewer(),
    accountSchema,
    new Map([
      ["firstName", "Jon"],
      ["lastName", "Snow"],
      ["emailAddress", email],
      ["phoneNumber", "415-232-1943"],
      ["bio", "he who knows nothing"],
      ["password", "test123"],
      ["birthday", "jan 1"],
    ]),
    WriteOperation.Insert,
    null,
  );
  return action.saveX();
}

test("field privacy", async () => {
  const user1 = await createUser("foo@bar.com");
  const user2 = await createUser("bar@baz.com");

  let user2From1 = await loadEnt(
    new IDViewer(user1.id),
    user2.id,
    userLoaderOptions,
  );
  expect(user2From1).not.toBeNull();
  expect(user2From1?.firstName).toBeNull();
  const action = new SimpleAction(
    new LoggedOutViewer(),
    userSchema,
    new Map(),
    WriteOperation.Edit,
    user1,
  );
  action.builder.orchestrator.addOutboundEdge(user2.id, "friends", "user");
  await action.saveX();

  const user2From1Post = await loadEnt(
    new IDViewer(user1.id),
    user2.id,
    userLoaderOptions,
  );
  expect(user2From1Post).not.toBeNull();
  expect(user2From1Post?.firstName).toBe("Jon");
});

test("field privacy with context", async () => {
  const user1 = await createUser("foo@bar.com");
  const user2 = await createUser("bar@baz.com");

  const viewer = new TestContext(new IDViewer(user1.id)).getViewer();
  let user2From1 = await loadEnt(viewer, user2.id, userLoaderOptions);
  expect(user2From1).not.toBeNull();
  expect(user2From1?.firstName).toBeNull();
  const action = new SimpleAction(
    viewer,
    userSchema,
    new Map(),
    WriteOperation.Edit,
    user1,
  );
  action.builder.orchestrator.addOutboundEdge(user2.id, "friends", "user");
  await action.saveX();

  const user2From1Post = await loadEnt(viewer, user2.id, userLoaderOptions);
  expect(user2From1Post).not.toBeNull();
  expect(user2From1Post?.firstName).toBe("Jon");
});

// skipping this for now because we should detect the infinite loop in here and throw
// this test should change
// TODO https://github.com/lolopinto/ent/issues/875
test.skip("field privacy load ent in privacy", async () => {
  const account1 = await createAccount("foo@bar.com");
  const account2 = await createAccount("bar@baz.com");

  let account2From1 = await loadEnt(
    new IDViewer(account1.id),
    account2.id,
    accountLoaderOptions,
  );
  expect(account2From1).not.toBeNull();
  expect(account2From1?.firstName).toBeNull();
  const action = new SimpleAction(
    new LoggedOutViewer(),
    accountSchema,
    new Map(),
    WriteOperation.Edit,
    account1,
  );
  action.builder.orchestrator.addOutboundEdge(
    account2.id,
    "friends",
    "account",
  );
  await action.saveX();

  const account2From1Post = await loadEnt(
    new IDViewer(account1.id),
    account2.id,
    accountLoaderOptions,
  );
  expect(account2From1Post).not.toBeNull();
  expect(account2From1Post?.firstName).toBe("Jon");
});
