// these are dependent on having the right tsconfig.json file...
import {
  loadEnt,
  ID,
  Viewer,
  loadEntX,
  loadEnts,
  LoadEntOptions,
  createEnt,
  editEnt,
  deleteEnt,
  AssocEdge,
  loadEdges,
  loadRawEdgeCountX,
  loadNodesByEdge,
  loadEdgeForID2,
  loadEntsFromClause,
  loadEntFromClause,
  loadEntXFromClause,
  loadRow,
} from "ent/ent";
import { AlwaysDenyRule, PrivacyPolicy } from "ent/privacy";
import { Field, getFields } from "ent/schema";
import schema from "src/schema/user";
import { EdgeType } from "src/ent/const";
import * as query from "ent/query";
import Event from "src/ent/event";
import User from "src/ent/user";
import Contact from "src/ent/contact";

const tableName = "users";

export class UserBase {
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly firstName: string;
  readonly lastName: string;
  readonly emailAddress: string;

  constructor(public viewer: Viewer, id: ID, data: {}) {
    this.id = id;
    // TODO don't double read id
    this.id = data["id"];
    this.createdAt = data["created_at"];
    this.updatedAt = data["updated_at"];
    this.firstName = data["first_name"];
    this.lastName = data["last_name"];
    this.emailAddress = data["email_address"];
  }

  // by default, we always deny and it's up to the ent
  // to overwrite this privacy policy in its subclasses

  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysDenyRule],
  };

  static async load<T extends UserBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, UserBase.loaderOptions.apply(this));
  }

  static async loadX<T extends UserBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, UserBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends UserBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(viewer, UserBase.loaderOptions.apply(this), ...ids);
  }

  static async loadFromEmailAddress<T extends UserBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
    viewer: Viewer,
    emailAddress: string,
  ): Promise<T | null> {
    return loadEntFromClause(
      viewer,
      UserBase.loaderOptions.apply(this),
      query.Eq("email_address", emailAddress),
    );
  }

  static async loadFromEmailAddressX<T extends UserBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
    viewer: Viewer,
    emailAddress: string,
  ): Promise<T> {
    return loadEntXFromClause(
      viewer,
      UserBase.loaderOptions.apply(this),
      query.Eq("email_address", emailAddress),
    );
  }

  static async loadIDFromEmailAddress<T extends UserBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
    emailAddress: string,
  ): Promise<ID | null> {
    const row = await loadRow({
      ...UserBase.loaderOptions.apply(this),
      clause: query.Eq("email_address", emailAddress),
    });
    if (!row) {
      return null;
    }
    return row["id"];
  }

  static loaderOptions<T extends UserBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: UserBase.getFields(),
      ent: this,
    };
  }

  private static getFields(): string[] {
    return [
      "id",
      "created_at",
      "updated_at",
      "first_name",
      "last_name",
      "email_address",
    ];
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (UserBase.schemaFields != null) {
      return UserBase.schemaFields;
    }
    return (UserBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return UserBase.getSchemaFields().get(key);
  }

  loadCreatedEventsEdges(): Promise<AssocEdge[]> {
    return loadEdges(this.id, EdgeType.UserToCreatedEvents);
  }

  loadCreatedEvents(): Promise<Event[]> {
    return loadNodesByEdge(
      this.viewer,
      this.id,
      EdgeType.UserToCreatedEvents,
      Event.loaderOptions(),
    );
  }

  loadCreatedEventsRawCountX(): Promise<number> {
    return loadRawEdgeCountX(this.id, EdgeType.UserToCreatedEvents);
  }

  loadCreatedEventEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2(this.id, EdgeType.UserToCreatedEvents, id2);
  }

  loadFriendsEdges(): Promise<AssocEdge[]> {
    return loadEdges(this.id, EdgeType.UserToFriends);
  }

  loadFriends(): Promise<User[]> {
    return loadNodesByEdge(
      this.viewer,
      this.id,
      EdgeType.UserToFriends,
      User.loaderOptions(),
    );
  }

  loadFriendsRawCountX(): Promise<number> {
    return loadRawEdgeCountX(this.id, EdgeType.UserToFriends);
  }

  loadFriendEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2(this.id, EdgeType.UserToFriends, id2);
  }

  loadInvitedEventsEdges(): Promise<AssocEdge[]> {
    return loadEdges(this.id, EdgeType.UserToInvitedEvents);
  }

  loadInvitedEvents(): Promise<Event[]> {
    return loadNodesByEdge(
      this.viewer,
      this.id,
      EdgeType.UserToInvitedEvents,
      Event.loaderOptions(),
    );
  }

  loadInvitedEventsRawCountX(): Promise<number> {
    return loadRawEdgeCountX(this.id, EdgeType.UserToInvitedEvents);
  }

  loadInvitedEventEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2(this.id, EdgeType.UserToInvitedEvents, id2);
  }

  loadEventsAttendingEdges(): Promise<AssocEdge[]> {
    return loadEdges(this.id, EdgeType.UserToEventsAttending);
  }

  loadEventsAttending(): Promise<Event[]> {
    return loadNodesByEdge(
      this.viewer,
      this.id,
      EdgeType.UserToEventsAttending,
      Event.loaderOptions(),
    );
  }

  loadEventsAttendingRawCountX(): Promise<number> {
    return loadRawEdgeCountX(this.id, EdgeType.UserToEventsAttending);
  }

  loadEventsAttendingEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2(this.id, EdgeType.UserToEventsAttending, id2);
  }

  loadDeclinedEventsEdges(): Promise<AssocEdge[]> {
    return loadEdges(this.id, EdgeType.UserToDeclinedEvents);
  }

  loadDeclinedEvents(): Promise<Event[]> {
    return loadNodesByEdge(
      this.viewer,
      this.id,
      EdgeType.UserToDeclinedEvents,
      Event.loaderOptions(),
    );
  }

  loadDeclinedEventsRawCountX(): Promise<number> {
    return loadRawEdgeCountX(this.id, EdgeType.UserToDeclinedEvents);
  }

  loadDeclinedEventEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2(this.id, EdgeType.UserToDeclinedEvents, id2);
  }

  loadMaybeEventsEdges(): Promise<AssocEdge[]> {
    return loadEdges(this.id, EdgeType.UserToMaybeEvents);
  }

  loadMaybeEvents(): Promise<Event[]> {
    return loadNodesByEdge(
      this.viewer,
      this.id,
      EdgeType.UserToMaybeEvents,
      Event.loaderOptions(),
    );
  }

  loadMaybeEventsRawCountX(): Promise<number> {
    return loadRawEdgeCountX(this.id, EdgeType.UserToMaybeEvents);
  }

  loadMaybeEventEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2(this.id, EdgeType.UserToMaybeEvents, id2);
  }

  loadContacts(): Promise<Contact[]> {
    return loadEntsFromClause(
      this.viewer,
      query.Eq("user_id", this.id),
      Contact.loaderOptions(),
    );
  }
}

// no actions yet so we support full create, edit, delete for now
export interface UserCreateInput {
  firstName: string;
  lastName: string;
  emailAddress: string;
}

export interface UserEditInput {
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
}

function defaultValue(key: string, property: string): any {
  let fn = UserBase.getField(key)?.[property];
  if (!fn) {
    return null;
  }
  return fn();
}

export async function createUserFrom<T extends UserBase>(
  viewer: Viewer,
  input: UserCreateInput,
  arg: new (viewer: Viewer, id: ID, data: {}) => T,
): Promise<T | null> {
  let fields = {
    id: defaultValue("ID", "defaultValueOnCreate"),
    created_at: defaultValue("createdAt", "defaultValueOnCreate"),
    updated_at: defaultValue("updatedAt", "defaultValueOnCreate"),
    first_name: input.firstName,
    last_name: input.lastName,
    email_address: input.emailAddress,
  };

  return await createEnt(viewer, {
    tableName: tableName,
    fields: fields,
    ent: arg,
  });
}

export async function editUserFrom<T extends UserBase>(
  viewer: Viewer,
  id: ID,
  input: UserEditInput,
  arg: new (viewer: Viewer, id: ID, data: {}) => T,
): Promise<T | null> {
  const setField = function(key: string, value: any) {
    if (value !== undefined) {
      // nullable fields allowed
      fields[key] = value;
    }
  };
  let fields = {
    updated_at: defaultValue("updatedAt", "defaultValueOnEdit"),
  };
  setField("first_name", input.firstName);
  setField("last_name", input.lastName);
  setField("email_address", input.emailAddress);

  return await editEnt(viewer, id, {
    tableName: tableName,
    fields: fields,
    ent: arg,
  });
}

export async function deleteUser(viewer: Viewer, id: ID): Promise<null> {
  return await deleteEnt(viewer, id, {
    tableName: tableName,
  });
}
