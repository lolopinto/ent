import {loadEnt, ID, loadEntX, LoadEntOptions, createEnt, editEnt, deleteEnt} from "../../../../src/ent"
import { v4 as uuidv4 } from 'uuid';

const tableName = "users";

export default class User {

  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly firstName: string;
  readonly lastName: string;
  

  // TODO viewer...
  constructor(id: ID, options:{}) {
    this.id = id;
    // TODO don't double read id
    this.id = options['id'];
    this.createdAt = options['created_at'];
    this.updatedAt = options['updated_at'];
    this.firstName = options['first_name'];
    this.lastName = options['last_name'];
    
  }

  // TODO viewer
  static async load(id: ID): Promise<User | null>{
    return loadEnt(id, User.getOptions());
  }

  // also TODO viewer
  static async loadX(id: ID): Promise<User> {
    return loadEntX(id, User.getOptions());
  }

  private static getFields(): string[] {
    return [
    'id',
    'created_at',
    'updated_at',
    'first_name',
    'last_name',
    
    ];
  }

  private static getOptions(): LoadEntOptions<User> {
    return {
      tableName: tableName,
      fields: User.getFields(),
      ent: User,
    };
  }
}
