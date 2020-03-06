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
    },
    {
        name: "updatedAt",
        type: {
            dbType: DBType.Time,
        },
        hideFromGraphQL: true,
    },
];
// Timestamps is a Pattern that adds a createdAt and updatedAt timestamp fields to the ent
export const Timestamps = {
    fields: tsFields,
};
let nodeFields = [].concat([
    {
        name: "ID",
        type: {
            dbType: DBType.UUID,
        },
        primaryKey: true,
    },
], tsFields);
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
