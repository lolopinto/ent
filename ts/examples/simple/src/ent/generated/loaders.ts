import {
  UserInterface,
  EventInterface,
  AddressInterface,
  ContactInterface,
} from "./interfaces";
import { ID, Viewer, Ent, LoadEntOptions } from "ent/ent";
import { TableName } from "src/ent/const";

interface ClassType<T = Ent> {
  new (viewer: Viewer, id: ID, data: {}): T;
}

export class UserLoader {
  private static instance: any;
  static registerClass<T extends UserInterface>(t: ClassType<T>) {
    UserLoader.instance = t;
  }

  static loaderOptions<T extends UserInterface>(): //    this: ClassType<T>
  LoadEntOptions<T> {
    return {
      tableName: TableName.User,
      fields: [
        "id",
        "created_at",
        "updated_at",
        "first_name",
        "last_name",
        "email_address",
        "account_status",
        "email_verified",
      ],
      ent: UserLoader.instance,
    };
  }
}

export class EventLoader {
  private static instance: any;
  static registerClass<T extends EventInterface>(t: ClassType<T>) {
    EventLoader.instance = t;
  }

  static loaderOptions<T extends EventInterface>(): //    this: ClassType<T>
  LoadEntOptions<T> {
    return {
      tableName: TableName.Event,
      fields: [
        "id",
        "created_at",
        "updated_at",
        "name",
        "user_id",
        "start_time",
        "end_time",
        "location",
      ],
      ent: EventLoader.instance,
    };
  }
}

export class AddressLoader {
  private static instance: any;
  static registerClass<T extends AddressInterface>(t: ClassType<T>) {
    AddressLoader.instance = t;
  }

  static loaderOptions<T extends AddressInterface>(): //    this: ClassType<T>,
  LoadEntOptions<T> {
    return {
      tableName: TableName.Address,
      fields: ["id", "created_at", "updated_at", "street_name", "city", "zip"],
      ent: AddressLoader.instance,
    };
  }
}

export class ContactLoader {
  private static instance: any;
  static registerClass<T extends ContactInterface>(t: ClassType<T>) {
    ContactLoader.instance = t;
  }

  static loaderOptions<T extends ContactInterface>(): //    this: ClassType<T>,
  LoadEntOptions<T> {
    return {
      tableName: TableName.Contact,
      fields: [
        "id",
        "created_at",
        "updated_at",
        "email_address",
        "first_name",
        "last_name",
        "user_id",
      ],
      ent: ContactLoader.instance,
    };
  }
}
