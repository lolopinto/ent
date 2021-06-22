// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerPrivacyPolicy,
  AssocEdge,
  Context,
  Data,
  ID,
  LoadEntOptions,
  ObjectLoaderFactory,
  PrivacyPolicy,
  Viewer,
  convertBool,
  convertDate,
  convertNullableList,
  loadEnt,
  loadEntViaKey,
  loadEntX,
  loadEntXViaKey,
  loadEnts,
  loadUniqueEdge,
  loadUniqueNode,
} from "@snowtop/snowtop-ts";
import { Field, getFields } from "@snowtop/snowtop-ts/schema";
import {
  Contact,
  EdgeType,
  NodeType,
  UserToAuthCodesQuery,
  UserToContactsQuery,
  UserToCreatedEventsQuery,
  UserToDeclinedEventsQuery,
  UserToEventsAttendingQuery,
  UserToFriendsQuery,
  UserToHostedEventsQuery,
  UserToInvitedEventsQuery,
  UserToMaybeEventsQuery,
} from "src/ent/internal";
import schema from "src/schema/user";

const tableName = "users";
const fields = [
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
  "bio",
  "nicknames",
];

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
  readonly bio: string | null;
  readonly nicknames: string[] | null;

  constructor(public viewer: Viewer, data: Data) {
    this.id = data.id;
    this.createdAt = convertDate(data.created_at);
    this.updatedAt = convertDate(data.updated_at);
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.emailAddress = data.email_address;
    this.phoneNumber = data.phone_number;
    this.password = data.password;
    this.accountStatus = data.account_status;
    this.emailVerified = convertBool(data.email_verified);
    this.bio = data.bio;
    this.nicknames = convertNullableList(data.nicknames);
  }

  // default privacyPolicy is Viewer can see themselves
  privacyPolicy: PrivacyPolicy = AllowIfViewerPrivacyPolicy;

  static async load<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, UserBase.loaderOptions.apply(this));
  }

  static async loadX<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, UserBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(viewer, UserBase.loaderOptions.apply(this), ...ids);
  }

  static async loadRawData<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data | null> {
    return await userLoader.createLoader(context).load(id);
  }

  static async loadRawDataX<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data> {
    const row = await userLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row;
  }

  static async loadFromEmailAddress<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    emailAddress: string,
  ): Promise<T | null> {
    return loadEntViaKey(viewer, emailAddress, {
      ...UserBase.loaderOptions.apply(this),
      loaderFactory: userEmailAddressLoader,
    });
  }

  static async loadFromEmailAddressX<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    emailAddress: string,
  ): Promise<T> {
    return loadEntXViaKey(viewer, emailAddress, {
      ...UserBase.loaderOptions.apply(this),
      loaderFactory: userEmailAddressLoader,
    });
  }

  static async loadIDFromEmailAddress<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    emailAddress: string,
    context?: Context,
  ): Promise<ID | undefined> {
    const row = await userEmailAddressLoader
      .createLoader(context)
      .load(emailAddress);
    return row?.id;
  }

  static async loadRawDataFromEmailAddress<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    emailAddress: string,
    context?: Context,
  ): Promise<Data | null> {
    return await userEmailAddressLoader
      .createLoader(context)
      .load(emailAddress);
  }

  static async loadFromPhoneNumber<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    phoneNumber: string,
  ): Promise<T | null> {
    return loadEntViaKey(viewer, phoneNumber, {
      ...UserBase.loaderOptions.apply(this),
      loaderFactory: userPhoneNumberLoader,
    });
  }

  static async loadFromPhoneNumberX<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    phoneNumber: string,
  ): Promise<T> {
    return loadEntXViaKey(viewer, phoneNumber, {
      ...UserBase.loaderOptions.apply(this),
      loaderFactory: userPhoneNumberLoader,
    });
  }

  static async loadIDFromPhoneNumber<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    phoneNumber: string,
    context?: Context,
  ): Promise<ID | undefined> {
    const row = await userPhoneNumberLoader
      .createLoader(context)
      .load(phoneNumber);
    return row?.id;
  }

  static async loadRawDataFromPhoneNumber<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    phoneNumber: string,
    context?: Context,
  ): Promise<Data | null> {
    return await userPhoneNumberLoader.createLoader(context).load(phoneNumber);
  }

  static loaderOptions<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: fields,
      ent: this,
      loaderFactory: userLoader,
    };
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

  queryCreatedEvents(): UserToCreatedEventsQuery {
    return UserToCreatedEventsQuery.query(this.viewer, this.id);
  }

  queryDeclinedEvents(): UserToDeclinedEventsQuery {
    return UserToDeclinedEventsQuery.query(this.viewer, this.id);
  }

  queryEventsAttending(): UserToEventsAttendingQuery {
    return UserToEventsAttendingQuery.query(this.viewer, this.id);
  }

  queryFriends(): UserToFriendsQuery {
    return UserToFriendsQuery.query(this.viewer, this.id);
  }

  queryInvitedEvents(): UserToInvitedEventsQuery {
    return UserToInvitedEventsQuery.query(this.viewer, this.id);
  }

  queryMaybeEvents(): UserToMaybeEventsQuery {
    return UserToMaybeEventsQuery.query(this.viewer, this.id);
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

  queryUserToHostedEvents(): UserToHostedEventsQuery {
    return UserToHostedEventsQuery.query(this.viewer, this.id);
  }

  queryAuthCodes(): UserToAuthCodesQuery {
    return UserToAuthCodesQuery.query(this.viewer, this.id);
  }

  queryContacts(): UserToContactsQuery {
    return UserToContactsQuery.query(this.viewer, this.id);
  }
}

export const userLoader = new ObjectLoaderFactory({
  tableName,
  fields,
  key: "id",
});

export const userEmailAddressLoader = new ObjectLoaderFactory({
  tableName,
  fields,
  key: "email_address",
});

export const userPhoneNumberLoader = new ObjectLoaderFactory({
  tableName,
  fields,
  key: "phone_number",
});

userLoader.addToPrime(userEmailAddressLoader);
userLoader.addToPrime(userPhoneNumberLoader);
userEmailAddressLoader.addToPrime(userLoader);
userEmailAddressLoader.addToPrime(userPhoneNumberLoader);
userPhoneNumberLoader.addToPrime(userLoader);
userPhoneNumberLoader.addToPrime(userEmailAddressLoader);
