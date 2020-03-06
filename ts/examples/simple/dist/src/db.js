var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Pool } from "pg";
function getClientConfig() {
    return { database: "tsent_test", user: "ola", host: "localhost", port: 5432 };
}
export default class DB {
    constructor(config) {
        this.pool = new Pool(config);
    }
    getPool() {
        return this.pool;
    }
    // expect to release client as needed
    getNewClient() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.pool.connect();
        });
    }
    // this should be called when the server is shutting down or end of tests.
    endPool() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.pool.end();
        });
    }
    static getInstance() {
        if (DB.instance) {
            return DB.instance;
        }
        // TODO get this from config/database.yml or environment variable
        DB.instance = new DB(getClientConfig());
        return DB.instance;
    }
}
