// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  loadEnt,
  ID,
  Data,
  Viewer,
  loadEntX,
  loadEnts,
  LoadEntOptions,
  AssocEdge,
  loadEdges,
  loadRawEdgeCountX,
  loadNodesByEdge,
  loadEdgeForID2,
  loadEntsFromClause,
  loadEntFromClause,
  loadEntXFromClause,
  loadRow,
  loadRowX,
  loadUniqueEdge,
  loadUniqueNode,
  AlwaysDenyRule,
  PrivacyPolicy,
  query,
} from "@lolopinto/ent";
import { Field, getFields } from "@lolopinto/ent/schema";
import { EdgeType, NodeType, Event, User, Contact } from "src/ent/internal";
import schema from "src/schema/user";

const tableName = "users";

export class UserBase {
  readonly nodeType = NodeType.User;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly firstName: string;
  readonly lastName: string;
  readonly emailAddress: string;
  readonly phoneNumber: string | null;
  protected readonly password: string | null;
  readonly accountStatus: string | null;
  readonly emailVerified: boolean;

  constructor(public viewer: Viewer, id: ID, data: Data) {
    this.id = id;
    // TODO don't double read id
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.emailAddress = data.email_address;
    this.phoneNumber = data.phone_number;
    this.password = data.password;
    this.accountStatus = data.account_status;
    this.emailVerified = data.email_verified;
  }

  // by default, we always deny and it's up to the ent
  // to overwrite this privacy policy in its subclasses

  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysDenyRule],
  };

  static async load<T extends UserBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, UserBase.loaderOptions.apply(this));
  }

  static async loadX<T extends UserBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, UserBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends UserBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(viewer, UserBase.loaderOptions.apply(this), ...ids);
  }

  static async loadRawData<T extends UserBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    id: ID,
  ): Promise<Data | null> {
    return await loadRow({
      ...UserBase.loaderOptions.apply(this),
      clause: query.Eq("id", id),
    });
  }

  static async loadRawDataX<T extends UserBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    id: ID,
  ): Promise<Data> {
    return await loadRowX({
      ...UserBase.loaderOptions.apply(this),
      clause: query.Eq("id", id),
    });
  }

  static async loadFromEmailAddress<T extends UserBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
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
    this: new (viewer: Viewer, id: ID, data: Data) => T,
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
    this: new (viewer: Viewer, id: ID, data: Data) => T,
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

  static async loadRawDataFromEmailAddress<T extends UserBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    emailAddress: string,
  ): Promise<Data | null> {
    return await loadRow({
      ...UserBase.loaderOptions.apply(this),
      clause: query.Eq("email_address", emailAddress),
    });
  }

  static async loadFromPhoneNumber<T extends UserBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    phoneNumber: string,
  ): Promise<T | null> {
    return loadEntFromClause(
      viewer,
      UserBase.loaderOptions.apply(this),
      query.Eq("phone_number", phoneNumber),
    );
  }

  static async loadFromPhoneNumberX<T extends UserBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    phoneNumber: string,
  ): Promise<T> {
    return loadEntXFromClause(
      viewer,
      UserBase.loaderOptions.apply(this),
      query.Eq("phone_number", phoneNumber),
    );
  }

  static async loadIDFromPhoneNumber<T extends UserBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    phoneNumber: string,
  ): Promise<ID | null> {
    const row = await loadRow({
      ...UserBase.loaderOptions.apply(this),
      clause: query.Eq("phone_number", phoneNumber),
    });
    if (!row) {
      return null;
    }
    return row["id"];
  }

  static async loadRawDataFromPhoneNumber<T extends UserBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    phoneNumber: string,
  ): Promise<Data | null> {
    return await loadRow({
      ...UserBase.loaderOptions.apply(this),
      clause: query.Eq("phone_number", phoneNumber),
    });
  }

  static loaderOptions<T extends UserBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
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
      "phone_number",
      "password",
      "account_status",
      "email_verified",
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
    return loadEdges({
      id1: this.id,
      edgeType: EdgeType.UserToCreatedEvents,
      context: this.viewer.context,
    });
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
    return loadRawEdgeCountX({
      id1: this.id,
      edgeType: EdgeType.UserToCreatedEvents,
      context: this.viewer.context,
    });
  }

  loadCreatedEventEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2({
      id1: this.id,
      edgeType: EdgeType.UserToCreatedEvents,
      id2,
      context: this.viewer.context,
    });
  }

  loadFriendsEdges(): Promise<AssocEdge[]> {
    return loadEdges({
      id1: this.id,
      edgeType: EdgeType.UserToFriends,
      context: this.viewer.context,
    });
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
    return loadRawEdgeCountX({
      id1: this.id,
      edgeType: EdgeType.UserToFriends,
      context: this.viewer.context,
    });
  }

  loadFriendEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2({
      id1: this.id,
      edgeType: EdgeType.UserToFriends,
      id2,
      context: this.viewer.context,
    });
  }

  loadSelfContactEdge(): Promise<AssocEdge | null> {
    return loadUniqueEdge({
      id1: this.id,
      edgeType: EdgeType.UserToSelfContact,
      context: this.viewer.context,
    });
  }

  loadSelfContact(): Promise<Contact | null> {
    return loadUniqueNode(
      this.viewer,
      this.id,
      EdgeType.UserToSelfContact,
      Contact.loaderOptions(),
    );
  }

  loadInvitedEventsEdges(): Promise<AssocEdge[]> {
    return loadEdges({
      id1: this.id,
      edgeType: EdgeType.UserToInvitedEvents,
      context: this.viewer.context,
    });
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
    return loadRawEdgeCountX({
      id1: this.id,
      edgeType: EdgeType.UserToInvitedEvents,
      context: this.viewer.context,
    });
  }

  loadInvitedEventEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2({
      id1: this.id,
      edgeType: EdgeType.UserToInvitedEvents,
      id2,
      context: this.viewer.context,
    });
  }

  loadEventsAttendingEdges(): Promise<AssocEdge[]> {
    return loadEdges({
      id1: this.id,
      edgeType: EdgeType.UserToEventsAttending,
      context: this.viewer.context,
    });
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
    return loadRawEdgeCountX({
      id1: this.id,
      edgeType: EdgeType.UserToEventsAttending,
      context: this.viewer.context,
    });
  }

  loadEventsAttendingEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2({
      id1: this.id,
      edgeType: EdgeType.UserToEventsAttending,
      id2,
      context: this.viewer.context,
    });
  }

  loadDeclinedEventsEdges(): Promise<AssocEdge[]> {
    return loadEdges({
      id1: this.id,
      edgeType: EdgeType.UserToDeclinedEvents,
      context: this.viewer.context,
    });
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
    return loadRawEdgeCountX({
      id1: this.id,
      edgeType: EdgeType.UserToDeclinedEvents,
      context: this.viewer.context,
    });
  }

  loadDeclinedEventEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2({
      id1: this.id,
      edgeType: EdgeType.UserToDeclinedEvents,
      id2,
      context: this.viewer.context,
    });
  }

  loadMaybeEventsEdges(): Promise<AssocEdge[]> {
    return loadEdges({
      id1: this.id,
      edgeType: EdgeType.UserToMaybeEvents,
      context: this.viewer.context,
    });
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
    return loadRawEdgeCountX({
      id1: this.id,
      edgeType: EdgeType.UserToMaybeEvents,
      context: this.viewer.context,
    });
  }

  loadMaybeEventEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2({
      id1: this.id,
      edgeType: EdgeType.UserToMaybeEvents,
      id2,
      context: this.viewer.context,
    });
  }

  async loadContacts(): Promise<Contact[]> {
    let map = await loadEntsFromClause(
      this.viewer,
      query.Eq("user_id", this.id),
      Contact.loaderOptions(),
    );
    let results: Contact[] = [];
    map.forEach((ent) => {
      results.push(ent);
    });
    return results;
  }
}
