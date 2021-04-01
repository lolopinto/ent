import {
  Action,
  Schema,
  Field,
  Edge,
  AssocEdge,
  AssocEdgeGroup,
} from "../schema";
import glob from "glob";
import * as path from "path";
import { pascalCase } from "pascal-case";
import minimist from "minimist";
import { ActionField, EdgeGroupAction } from "../schema/schema";

function isAssocEdge(edge: Edge): edge is AssocEdge {
  return (edge as AssocEdge).schemaName != undefined;
}

function processFields(dst: {}[], src: Field[]) {
  for (const field of src) {
    let f = {};
    f = field;
    f["hasDefaultValueOnCreate"] = field.defaultValueOnCreate != undefined;
    f["hasDefaultValueOnEdit"] = field.defaultValueOnEdit != undefined;
    if (field.polymorphic) {
      // convert boolean into object
      // we keep boolean as an option to keep API simple
      if (typeof field.polymorphic === "boolean") {
        f["polymorphic"] = {};
      } else {
        f["polymorphic"] = field.polymorphic;
      }
    }
    dst.push(f);
  }
}

enum NullableResult {
  CONTENTS = "contents",
  CONTENTS_AND_LIST = "contentsAndList",
  ITEM = "true", // nullable = true
}

type ProcessedActionField =
  | Exclude<ActionField, "nullable">
  | {
      nullable?: NullableResult;
    };

type ProcessedAssocEdge =
  | Exclude<AssocEdge, "actionOnlyFields" | "edgeActions">
  | {
      edgeActions?: OutputAction[];
      //      actionOnlyFields?: ProcessedActionField[];
    };

type ProcessedAssocEdgeGroup =
  | Exclude<AssocEdgeGroup, "edgeAction">
  | {
      edgeAction?: OutputAction;
      //      actionOnlyFields?: ProcessedActionField[];
    };

// type ProcessedEdgeGroupAction =
//   | Exclude<EdgeGroupAction, "actionOnlyFields">
//   | {
//       actionOnlyFields?: OutputAction[];
//     };

interface InputAction {
  actionOnlyFields?: ActionField[];
}

interface OutputAction {
  actionOnlyFields?: ProcessedActionField[];
}

function processAction(action: InputAction): OutputAction {
  if (!action.actionOnlyFields) {
    return action;
  }

  let ret = action as OutputAction;
  ret.actionOnlyFields = action.actionOnlyFields.map((f) => {
    let f2 = f as ProcessedActionField;
    if (!f.nullable) {
      return f2;
    }
    if (typeof f.nullable === "boolean") {
      f2.nullable = NullableResult.ITEM;
    } else {
      if (f.nullable === "contentsAndList") {
        f2.nullable = NullableResult.CONTENTS_AND_LIST;
      } else {
        f2.nullable = NullableResult.CONTENTS;
      }
    }

    return f2;
  });
  return ret;
}

async function main() {
  const options = minimist(process.argv.slice(2));

  if (!options.path) {
    throw new Error("path required");
  }

  const r = /(\w+).ts/;
  const paths = glob.sync(path.join(options.path, "*.ts"), {
    ignore: [`\d+_read_schema.ts`],
  });
  let potentialSchemas = {};
  for (const p of paths) {
    const basename = path.basename(p);
    const match = r.exec(basename);
    if (!match) {
      throw new Error(`non-typescript file ${p} returned by glob`);
    }
    potentialSchemas[pascalCase(match[1])] = require(p).default;
  }
  //  console.log(potentialSchemas);

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
        processFields(fields, pattern.fields);
      }
    }
    processFields(fields, schema.fields);
    let assocEdges: ProcessedAssocEdge[] = [];
    let assocEdgeGroups: AssocEdgeGroup[] = [];
    if (schema.edges) {
      for (const edge of schema.edges) {
        if (isAssocEdge(edge)) {
          let edge2: ProcessedAssocEdge = edge;
          edge2.edgeActions = edge.edgeActions?.map((action) =>
            processAction(action),
          );
          assocEdges.push(edge2);
        } else {
          // array-ify this
          if (edge.nullStates && !Array.isArray(edge.nullStates)) {
            edge.nullStates = [edge.nullStates];
          }
          let group: ProcessedAssocEdgeGroup = edge;
          if (edge.edgeAction) {
            group.edgeAction = processAction(edge.edgeAction);
          }
          assocEdgeGroups.push(edge);
        }
      }
    }
    schemas[key] = {
      tableName: schema.tableName,
      fields: fields,
      assocEdges: assocEdges,
      assocEdgeGroups: assocEdgeGroups,
      actions: schema.actions?.map((action) => processAction(action)),
      enumTable: schema.enumTable,
      dbRows: schema.dbRows,
      constraints: schema.constraints,
      indices: schema.indices,
      hideFromGraphQL: schema.hideFromGraphQL,
    };
  }
  console.log(JSON.stringify(schemas));
}

Promise.resolve(main());
