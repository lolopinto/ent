var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { loadEnt, loadEntX } from "../../../../src/ent";
const tableName = "events";
export default class Event {
    // TODO viewer...
    constructor(id, options) {
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
    static load(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return loadEnt(id, Event.getOptions());
        });
    }
    // also TODO viewer
    static loadX(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return loadEntX(id, Event.getOptions());
        });
    }
    static getFields() {
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
    static getOptions() {
        return {
            tableName: tableName,
            fields: Event.getFields(),
            ent: Event,
        };
    }
}
