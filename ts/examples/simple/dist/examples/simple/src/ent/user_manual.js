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
import { v4 as uuidv4 } from 'uuid';
const tableName = "users";
// todo generate this
export default class User {
    // TODO viewer...
    constructor(id, options) {
        this.id = id;
        this.firstName = options['first_name'];
        this.lastName = options['last_name'];
        this.createdAt = options['created_at'];
        this.updatedAt = options['updated_at'];
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
        return [
            "id",
            "created_at",
            "updated_at",
            "first_name",
            "last_name",
        ];
    }
    static getOptions() {
        return {
            tableName: tableName,
            fields: User.getFields(),
            ent: User,
        };
    }
}
// todo viewer, mutations, actions the works
export function createUser(input) {
    return __awaiter(this, void 0, void 0, function* () {
        let date = new Date();
        let fields = {
            // todo add this to fields and automate...
            "id": uuidv4(),
            "first_name": input.firstName,
            "last_name": input.lastName,
            "created_at": date,
            "updated_at": date,
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
        let date = new Date();
        let fields = {
            "updated_at": date,
        };
        if (input.firstName) {
            fields["first_name"] = input.firstName;
        }
        if (input.lastName) {
            fields["last_name"] = input.lastName;
        }
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
;
