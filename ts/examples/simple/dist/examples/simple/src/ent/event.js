var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { loadEnt, loadEntX, createEnt, editEnt, deleteEnt } from "../../../../src/ent";
import { getFields } from "../../../../src/schema";
import schema from './../schema/event';
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
    static getSchemaFields() {
        if (Event.schemaFields != null) {
            return Event.schemaFields;
        }
        return Event.schemaFields = getFields(schema);
    }
    static getField(key) {
        return Event.getSchemaFields().get(key);
    }
    static getOptions() {
        return {
            tableName: tableName,
            fields: Event.getFields(),
            ent: Event,
        };
    }
}
function defaultValue(key, property) {
    var _a;
    let fn = (_a = Event.getField(key)) === null || _a === void 0 ? void 0 : _a[property];
    if (!fn) {
        return null;
    }
    return fn();
}
;
export function createEvent(input) {
    return __awaiter(this, void 0, void 0, function* () {
        let fields = {
            "id": defaultValue("ID", "defaultValueOnCreate"),
            "created_at": defaultValue("createdAt", "defaultValueOnCreate"),
            "updated_at": defaultValue("updatedAt", "defaultValueOnCreate"),
            "name": input.name,
            "user_id": input.creatorID,
            "start_time": input.startTime,
            "end_time": input.endTime,
            "location": input.location,
        };
        return yield createEnt({
            tableName: tableName,
            fields: fields,
            ent: Event,
        });
    });
}
export function editEvent(id, input) {
    return __awaiter(this, void 0, void 0, function* () {
        const setField = function (key, value) {
            if (value !== undefined) { // nullable fields allowed
                fields[key] = value;
            }
        };
        let fields = {
            "updated_at": defaultValue("updatedAt", "defaultValueOnEdit"),
        };
        setField("name", input.name);
        setField("user_id", input.creatorID);
        setField("start_time", input.startTime);
        setField("end_time", input.endTime);
        setField("location", input.location);
        return yield editEnt(id, {
            tableName: tableName,
            fields: fields,
            ent: Event,
        });
    });
}
export function deleteEvent(id) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield deleteEnt(id, {
            tableName: tableName,
        });
    });
}
;
