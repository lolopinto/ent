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
    static getOptions() {
        return {
            tableName: tableName,
            fields: Address.getFields(),
            ent: Address,
        };
    }
}
