import { ID, Ent, AssocEdge, LoadEntOptions } from "ent/ent";

// TODO name these UserInterface?
// the interface issue means that custom things aren't available tho...
// maybe why same name is good?
export interface UserInterface extends Ent {
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly firstName: string;
  readonly lastName: string;
  readonly emailAddress: string;
  readonly accountStatus: string | null;
  readonly emailVerified: boolean;

  // only way to get the type is to have this be generated tooo
  // so needs to be passed to the schema
  // no way to manually do this because can't merge types across
  // and get full codegen as needed.
  fullName: string;
  // etc..
  loadCreatedEventsEdges(): Promise<AssocEdge[]>;
  loadCreatedEvents(): Promise<EventInterface[]>;
  loadCreatedEventsRawCountX(): Promise<number>;
  loadCreatedEventEdgeFor(id2: ID): Promise<AssocEdge | undefined>;
  // TODO...
  loadSelfContact(): Promise<ContactInterface | null>;
  loadContacts(): Promise<ContactInterface[]>;

  //  static loaderOptions<T extends User>(): LoadEntOptions<T>;
}

export interface AddressInterface extends Ent {
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly streetName: string;
  readonly city: string;
  readonly zip: string;
}

export interface ContactInterface extends Ent {
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly emailAddress: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly userID: ID;
  loadUser(): Promise<UserInterface | null>;
  loadUserX(): Promise<UserInterface>;
}

export interface EventInterface extends Ent {
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly name: string;
  readonly creatorID: ID;
  readonly startTime: Date;
  readonly endTime: Date | null;
  readonly location: string;
  // etc...
  loadHostsEdges(): Promise<AssocEdge[]>;
  loadHosts(): Promise<UserInterface[]>;
  loadHostsRawCountX(): Promise<number>;
  loadHostEdgeFor(id2: ID): Promise<AssocEdge | undefined>;
  loadInvitedEdges(): Promise<AssocEdge[]>;
}
