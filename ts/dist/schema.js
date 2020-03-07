import { v4 as uuidv4 } from 'uuid';
// we want --strictNullChecks flag so nullable is used to type graphql, ts, db
// should eventually generate (boolean | null) etc
// supported db types
export var DBType;
(function (DBType) {
    DBType["UUID"] = "UUID";
    DBType["Int64ID"] = "Int64ID";
    DBType["Boolean"] = "Boolean";
    DBType["Int"] = "Int";
    DBType["Float"] = "Float";
    DBType["String"] = "String";
    DBType["Time"] = "Time";
    DBType["JSON"] = "JSON";
})(DBType || (DBType = {}));
let tsFields;
tsFields = [
    {
        name: "createdAt",
        type: {
            dbType: DBType.Time,
        },
        hideFromGraphQL: true,
        disableUserEditable: true,
        defaultValueOnCreate: () => {
            return new Date();
        },
    },
    {
        name: "updatedAt",
        type: {
            dbType: DBType.Time,
        },
        hideFromGraphQL: true,
        disableUserEditable: true,
        defaultValueOnCreate: () => {
            return new Date();
        },
        defaultValueOnEdit: () => {
            return new Date();
        },
    },
];
// Timestamps is a Pattern that adds a createdAt and updatedAt timestamp fields to the ent
export const Timestamps = {
    fields: tsFields,
};
let nodeFields = [
    {
        name: "ID",
        type: {
            dbType: DBType.UUID,
        },
        primaryKey: true,
        disableUserEditable: true,
        defaultValueOnCreate: () => {
            return uuidv4();
        },
    },
];
nodeFields = nodeFields.concat(tsFields);
// Node is a Pattern that adds 3 fields to the ent: (id, createdAt, and updatedAt timestamps) 
export const Node = {
    fields: nodeFields,
};
// Base ent schema. has Node Pattern by default.
// exists just to have less typing and easier for clients to implement
export class BaseEntSchema {
    constructor() {
        this.patterns = [Node];
    }
}
export function getFields(value) {
    let schema;
    if (value.constructor == Object) {
        schema = value;
    }
    else {
        schema = new value();
    }
    let m = new Map();
    if (schema.patterns) {
        for (const pattern of schema.patterns) {
            for (const field of pattern.fields) {
                m.set(field.name, field);
            }
        }
    }
    for (const field of schema.fields) {
        m.set(field.name, field);
    }
    return m;
}
