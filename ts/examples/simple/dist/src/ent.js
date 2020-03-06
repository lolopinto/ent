var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import DB from "./db";
// Todo viewer
export function loadEnt(id, options) {
    return __awaiter(this, void 0, void 0, function* () {
        return loadRow(id, options);
    });
}
// todo viewer
export function loadEntX(id, options) {
    return __awaiter(this, void 0, void 0, function* () {
        return loadRowX(id, options);
    });
}
function loadRowX(id, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = yield loadRow(id, options);
        if (result == null) {
            throw new Error(`couldn't find row for id ${id}`);
        }
        return result;
    });
}
function logQuery(query) {
    console.log(query);
}
function loadRow(id, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const pool = DB.getInstance().getPool();
        const fields = options.fields.join(", ");
        const query = `SELECT ${fields} FROM ${options.tableName} WHERE id = $1`;
        logQuery(query);
        const res = yield pool.query(query, [id]);
        if (res.rowCount != 1) {
            if (res.rowCount > 1) {
                console.error("got more than one row for query " + query);
            }
            return null;
        }
        return new options.ent(id, res.rows[0]);
    });
}
export function createEnt(options) {
    return __awaiter(this, void 0, void 0, function* () {
        let fields = [];
        let values = [];
        let valsString = [];
        let idx = 1;
        for (const key in options.fields) {
            fields.push(key);
            values.push(options.fields[key]);
            valsString.push(`$${idx}`);
            idx++;
        }
        const cols = fields.join(", ");
        const vals = valsString.join(", ");
        let query = `INSERT INTO ${options.tableName} (${cols}) VALUES (${vals}) RETURNING *`;
        logQuery(query);
        const pool = DB.getInstance().getPool();
        try {
            const res = yield pool.query(query, values);
            if (res.rowCount == 1) {
                // for now assume id primary key 
                // todo
                let row = res.rows[0];
                return new options.ent(row.id, row);
            }
        }
        catch (e) {
            console.error(e);
            return null;
        }
        return null;
    });
}
// column should be passed in here
export function editEnt(id, options) {
    return __awaiter(this, void 0, void 0, function* () {
        let valsString = [];
        let values = [];
        let idx = 1;
        for (const key in options.fields) {
            values.push(options.fields[key]);
            valsString.push(`${key} = $${idx}`);
            idx++;
        }
        values.push(id);
        const vals = valsString.join(", ");
        let query = `UPDATE ${options.tableName} SET ${vals} WHERE id = $${idx} RETURNING *`;
        logQuery(query);
        try {
            const pool = DB.getInstance().getPool();
            const res = yield pool.query(query, values);
            if (res.rowCount == 1) {
                // for now assume id primary key 
                // TODO make this extensible as needed.
                let row = res.rows[0];
                return new options.ent(row.id, row);
            }
        }
        catch (e) {
            console.error(e);
            return null;
        }
        return null;
    });
}
export function deleteEnt(id, options) {
    return __awaiter(this, void 0, void 0, function* () {
        let query = `DELETE FROM ${options.tableName} WHERE id = $1`;
        logQuery(query);
        try {
            const pool = DB.getInstance().getPool();
            yield pool.query(query, [id]);
        }
        catch (e) {
            console.error(e);
        }
        return null;
    });
}
var EditOperation;
(function (EditOperation) {
    EditOperation["Create"] = "create";
    EditOperation["Edit"] = "edit";
    EditOperation["Delete"] = "delete";
})(EditOperation || (EditOperation = {}));
