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
import schema from './../schema/address';
const tableName = "addresses";
export default class Address {
    // TODO viewer...
    constructor(id, options) {
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
    static load(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return loadEnt(id, Address.getOptions());
        });
    }
    // also TODO viewer
    static loadX(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return loadEntX(id, Address.getOptions());
        });
    }
    static getFields() {
        return [
            'id',
            'created_at',
            'updated_at',
            'street_name',
            'city',
            'zip',
        ];
    }
    static getSchemaFields() {
        if (Address.schemaFields != null) {
            return Address.schemaFields;
        }
        return Address.schemaFields = getFields(schema);
    }
    static getField(key) {
        return Address.getSchemaFields().get(key);
    }
    static getOptions() {
        return {
            tableName: tableName,
            fields: Address.getFields(),
            ent: Address,
        };
    }
}
function defaultValue(key, property) {
    var _a;
    let fn = (_a = Address.getField(key)) === null || _a === void 0 ? void 0 : _a[property];
    if (!fn) {
        return null;
    }
    return fn();
}
;
export function createAddress(input) {
    return __awaiter(this, void 0, void 0, function* () {
        let fields = {
            "id": defaultValue("ID", "defaultValueOnCreate"),
            "created_at": defaultValue("createdAt", "defaultValueOnCreate"),
            "updated_at": defaultValue("updatedAt", "defaultValueOnCreate"),
            "street_name": input.streetName,
            "city": input.city,
            "zip": input.zip,
        };
        return yield createEnt({
            tableName: tableName,
            fields: fields,
            ent: Address,
        });
    });
}
export function editAddress(id, input) {
    return __awaiter(this, void 0, void 0, function* () {
        const setField = function (key, value) {
            if (value !== undefined) { // nullable fields allowed
                fields[key] = value;
            }
        };
        let fields = {
            "updated_at": defaultValue("updatedAt", "defaultValueOnEdit"),
        };
        setField("street_name", input.streetName);
        setField("city", input.city);
        setField("zip", input.zip);
        return yield editEnt(id, {
            tableName: tableName,
            fields: fields,
            ent: Address,
        });
    });
}
export function deleteAddress(id) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield deleteEnt(id, {
            tableName: tableName,
        });
    });
}
;
