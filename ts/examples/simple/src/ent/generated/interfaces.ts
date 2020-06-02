import { ID, Ent, AssocEdge, LoadEntOptions } from "ent/ent";

// TODO name these UserInterface?
// the interface issue means that custom things aren't available tho...
// maybe why same name is good?
export interface User extends Ent {
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly firstName: string;
  readonly lastName: string;
  readonly emailAddress: string;
  readonly accountStatus: string | null;
  readonly emailVerified: boolean;

  // etc..
  loadCreatedEventsEdges(): Promise<AssocEdge[]>;
  loadCreatedEvents(): Promise<Event[]>;
  loadCreatedEventsRawCountX(): Promise<number>;
  loadCreatedEventEdgeFor(id2: ID): Promise<AssocEdge | undefined>;
  // TODO...
  loadSelfContact(): Promise<Contact | null>;

  //  static loaderOptions<T extends User>(): LoadEntOptions<T>;
}

export interface Address extends Ent {
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly streetName: string;
  readonly city: string;
  readonly zip: string;
}

export interface Contact extends Ent {
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly emailAddress: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly userID: ID;
  loadUser(): Promise<User | null>;
  loadUserX(): Promise<User>;
}

export interface Event extends Ent {
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly name: string;
  readonly creatorID: ID;
  readonly startTime: Date;
  readonly endTime: Date | null;
  readonly location: string;
  // etc...
  loadHostsEdges(): Promise<AssocEdge[]>;
  loadHosts(): Promise<User[]>;
  loadHostsRawCountX(): Promise<number>;
  loadHostEdgeFor(id2: ID): Promise<AssocEdge | undefined>;
  loadInvitedEdges(): Promise<AssocEdge[]>;
}
