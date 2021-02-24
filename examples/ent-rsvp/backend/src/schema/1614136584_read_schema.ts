import {Schema, Field, Edge, AssocEdge, AssocEdgeGroup} from "@lolopinto/ent/schema";

import Address from "./address"
import AuthCode from "./auth_code"
import Event from "./event"
import EventActivity from "./event_activity"
import Guest from "./guest"
import GuestData from "./guest_data"
import GuestGroup from "./guest_group"
import User from "./user"
let potentialSchemas = {
"Address": Address,
"AuthCode": AuthCode,
"Event": Event,
"EventActivity": EventActivity,
"Guest": Guest,
"GuestData": GuestData,
"GuestGroup": GuestGroup,
"User": User,
};

let schemas = {};

for (const key in potentialSchemas) {
  const value = potentialSchemas[key];
  let schema: Schema;
  if (value.constructor == Object) {
    schema = value;
  } else {
    schema = new value();
  }

  // let's put patterns first just so we have id, created_at, updated_at first
  // ¯\_(ツ)_/¯
  let fields: Field[] = [];
  //  let fields = [...schema.fields];
  if (schema.patterns) {
    for (const pattern of schema.patterns) {
      processFields(fields, pattern.fields)
    }
  }
  processFields(fields, schema.fields);

  let assocEdges: AssocEdge[] = [];
  let assocEdgeGroups: AssocEdgeGroup[] = [];

  if (schema.edges) {
    for (const edge of schema.edges) {
      if (isAssocEdge(edge)) {
        assocEdges.push(edge)
      } else {
        // array-ify this
        if (edge.nullStates && !Array.isArray(edge.nullStates)) {
          edge.nullStates = [edge.nullStates];
        }
        assocEdgeGroups.push(edge)
      }
    }
  }

  schemas[key] = {
    tableName: schema.tableName,
    fields: fields,
    assocEdges: assocEdges,
    assocEdgeGroups: assocEdgeGroups,
    actions: schema.actions,
    enumTable: schema.enumTable,
    dbRows: schema.dbRows,
    constraints: schema.constraints,
    indices: schema.indices,
    hideFromGraphQL: schema.hideFromGraphQL,
  };
}

function isAssocEdge(edge: Edge): edge is AssocEdge {
  return (edge as AssocEdge).schemaName != undefined;
}

function processFields(dst: {}[], src:Field[]) {
  for (const field of src) {
    let f = {};
    f = field;
    f['hasDefaultValueOnCreate'] = (field.defaultValueOnCreate != undefined)
    f['hasDefaultValueOnEdit'] = (field.defaultValueOnEdit != undefined)
    if (field.polymorphic) {
      // convert boolean into object
      // we keep boolean as an option to keep API simple
      if (typeof field.polymorphic ==='boolean') {
        f['polymorphic'] = {};
      } else {
        f['polymorphic'] = field.polymorphic;
      }
    }
    dst.push(f);
  }
}

console.log(JSON.stringify(schemas));
