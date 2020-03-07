import {loadEnt, ID, loadEntX, LoadEntOptions, createEnt, editEnt, deleteEnt} from "../../../../src/ent"
import { v4 as uuidv4 } from 'uuid';

const tableName = "addresses";

export default class Address {

  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly streetName: string;
  readonly city: string;
  readonly zip: string;
  

  // TODO viewer...
  constructor(id: ID, options:{}) {
    this.id = id;
    // TODO don't double read id
    this.id = options['id'];
    this.createdAt = options['created_at'];
    this.updatedAt = options['updated_at'];
    this.streetName = options['street_name'];
    this.city = options['city'];
    this.zip = options['zip'];
    
  }

  // TODO viewer
  static async load(id: ID): Promise<Address | null>{
    return loadEnt(id, Address.getOptions());
  }

  // also TODO viewer
  static async loadX(id: ID): Promise<Address> {
    return loadEntX(id, Address.getOptions());
  }

  private static getFields(): string[] {
    return [
    'id',
    'created_at',
    'updated_at',
    'street_name',
    'city',
    'zip',
    
    ];
  }

  private static getOptions(): LoadEntOptions<Address> {
    return {
      tableName: tableName,
      fields: Address.getFields(),
      ent: Address,
    };
  }
}
