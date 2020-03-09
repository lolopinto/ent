var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { loadEnt, loadEntX, createEnt, editEnt, deleteEnt, } from "../../../../src/ent";
import { getFields } from "../../../../src/schema";
import schema from "./../schema/user";
const tableName = "users";
export default class User {
    // TODO viewer...
    constructor(id, options) {
        this.id = id;
        // TODO don't double read id
        this.id = options["id"];
        this.createdAt = options["created_at"];
        this.updatedAt = options["updated_at"];
        this.firstName = options["first_name"];
        this.lastName = options["last_name"];
    }
    // TODO viewer
    static load(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return loadEnt(id, User.getOptions());
        });
    }
    // also TODO viewer
    static loadX(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return loadEntX(id, User.getOptions());
        });
    }
    static getFields() {
        return ["id", "created_at", "updated_at", "first_name", "last_name"];
    }
    static getSchemaFields() {
        if (User.schemaFields != null) {
            return User.schemaFields;
        }
        return (User.schemaFields = getFields(schema));
    }
    static getField(key) {
        return User.getSchemaFields().get(key);
    }
    static getOptions() {
        return {
            tableName: tableName,
            fields: User.getFields(),
            ent: User,
        };
    }
}
function defaultValue(key, property) {
    var _a;
    let fn = (_a = User.getField(key)) === null || _a === void 0 ? void 0 : _a[property];
    if (!fn) {
        return null;
    }
    return fn();
}
export function createUser(input) {
    return __awaiter(this, void 0, void 0, function* () {
        let fields = {
            id: defaultValue("ID", "defaultValueOnCreate"),
            created_at: defaultValue("createdAt", "defaultValueOnCreate"),
            updated_at: defaultValue("updatedAt", "defaultValueOnCreate"),
            first_name: input.firstName,
            last_name: input.lastName,
        };
        return yield createEnt({
            tableName: tableName,
            fields: fields,
            ent: User,
        });
    });
}
export function editUser(id, input) {
    return __awaiter(this, void 0, void 0, function* () {
        const setField = function (key, value) {
            if (value !== undefined) {
                // nullable fields allowed
                fields[key] = value;
            }
        };
        let fields = {
            updated_at: defaultValue("updatedAt", "defaultValueOnEdit"),
        };
        setField("first_name", input.firstName);
        setField("last_name", input.lastName);
        return yield editEnt(id, {
            tableName: tableName,
            fields: fields,
            ent: User,
        });
    });
}
export function deleteUser(id) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield deleteEnt(id, {
            tableName: tableName,
        });
    });
}
