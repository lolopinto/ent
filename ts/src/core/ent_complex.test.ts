import { User, SimpleAction, getTableName } from "../testutils/builder";
import {
  BaseEntSchema,
  BooleanType,
  EnumType,
  Field,
  JSONBType,
  StringType,
  UUIDType,
  getFields,
  getFieldsWithPrivacy,
  getStorageKey,
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

  fields: Field[] = [
    StringType({
      name: "firstName",
      privacyPolicy: sharedPolicy,
    }),
    StringType({
      name: "lastName",
      privacyPolicy: sharedPolicy,
    }),
    StringType({
      name: "emailAddress",
      privacyPolicy: sharedPolicy,
    }),
    StringType({
      name: "phoneNumber",
      privacyPolicy: sharedPolicy,
    }),
    StringType({
      name: "bio",
      privacyPolicy: sharedPolicy,
    }),
    StringType({
      name: "password",
      private: true,
      hideFromGraphQL: true,
      privacyPolicy: AlwaysDenyPrivacyPolicy,
    }),
    EnumType({
      name: "accountStatus",
      nullable: true,
      values: ["UNVERIFIED", "VERIFIED", "DEACTIVATED", "DISABLED"],
      defaultValueOnCreate: () => "UNVERIFIED",
      privacyPolicy: sharedPolicy,
    }),
    BooleanType({
      name: "emailVerified",
      hideFromGraphQL: true,
      serverDefault: "FALSE",
      defaultValueOnCreate: () => false,
      privacyPolicy: sharedPolicy,
    }),
    StringType({
      name: "birthday",
      privacyPolicy: sharedPolicy,
    }),
    JSONBType({
      name: "prefs",
      nullable: true,
      privacyPolicy: sharedPolicy,
    }),
    UUIDType({
      name: "foo_id",
      nullable: true,
      privacyPolicy: sharedPolicy,
    }),
    UUIDType({
      name: "bar_id",
      nullable: true,
      privacyPolicy: sharedPolicy,
    }),
    UUIDType({
      name: "baz_id",
      nullable: true,
      privacyPolicy: sharedPolicy,
    }),
  ];
}

// basically same as UserSchema but more complicated privacy policy
class AccountSchema extends BaseEntSchema {
  ent = User;

  fields: Field[] = [
    StringType({
      name: "firstName",
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    StringType({
      name: "lastName",
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    StringType({
      name: "emailAddress",
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    StringType({
      name: "phoneNumber",
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    StringType({
      name: "bio",
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    StringType({
      name: "password",
      private: true,
      hideFromGraphQL: true,
      privacyPolicy: AlwaysDenyPrivacyPolicy,
    }),
    EnumType({
      name: "accountStatus",
      nullable: true,
      values: ["UNVERIFIED", "VERIFIED", "DEACTIVATED", "DISABLED"],
      defaultValueOnCreate: () => "UNVERIFIED",
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    BooleanType({
      name: "emailVerified",
      hideFromGraphQL: true,
      serverDefault: "FALSE",
      defaultValueOnCreate: () => false,
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    StringType({
      name: "birthday",
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    JSONBType({
      name: "prefs",
      nullable: true,
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    UUIDType({
      name: "foo_id",
      nullable: true,
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    UUIDType({
      name: "bar_id",
      nullable: true,
      privacyPolicy: sharedPolicyLoadEnt,
    }),
    UUIDType({
      name: "baz_id",
      nullable: true,
      privacyPolicy: sharedPolicyLoadEnt,
    }),
  ];
}

const userSchema = new UserSchema();
const userFields = Array.from(getFields(userSchema).values()).map(
  getStorageKey,
);
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
  fieldPrivacy: getFieldsWithPrivacy(userSchema),
};

const accountSchema = new AccountSchema();
const accountFields = Array.from(getFields(userSchema).values()).map(
  getStorageKey,
);
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
  fieldPrivacy: getFieldsWithPrivacy(accountSchema),
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
  //  log: "query",
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
