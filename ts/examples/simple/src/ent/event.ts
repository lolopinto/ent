import {loadEnt, ID, loadEntX, LoadEntOptions, createEnt, editEnt, deleteEnt} from "../../../../src/ent"
import { v4 as uuidv4 } from 'uuid';

const tableName = "events";

export default class Event {

  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly name: string;
  readonly creatorID: string;
  readonly startTime: Date;
  readonly endTime: Date | null;
  readonly location: string;
  

  // TODO viewer...
  constructor(id: ID, options:{}) {
    this.id = id;
    // TODO don't double read id
    this.id = options['id'];
    this.createdAt = options['created_at'];
    this.updatedAt = options['updated_at'];
    this.name = options['name'];
    this.creatorID = options['user_id'];
    this.startTime = options['start_time'];
    this.endTime = options['end_time'];
    this.location = options['location'];
    
  }

  // TODO viewer
  static async load(id: ID): Promise<Event | null>{
    return loadEnt(id, Event.getOptions());
  }

  // also TODO viewer
  static async loadX(id: ID): Promise<Event> {
    return loadEntX(id, Event.getOptions());
  }

  private static getFields(): string[] {
    return [
    'id',
    'created_at',
    'updated_at',
    'name',
    'user_id',
    'start_time',
    'end_time',
    'location',
    
    ];
  }

  private static getOptions(): LoadEntOptions<Event> {
    return {
      tableName: tableName,
      fields: Event.getFields(),
      ent: Event,
    };
  }
}
