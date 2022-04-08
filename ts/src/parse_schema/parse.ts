import {
  Pattern,
  Schema,
  Field,
  AssocEdge,
  AssocEdgeGroup,
  Action,
} from "../schema";
import { ActionField, Type } from "../schema/schema";

function processFields(src: Field[], patternName?: string): ProcessedField[] {
  const ret: ProcessedField[] = [];
  for (const field of src) {
    let f: ProcessedField = { ...field };
    f.hasDefaultValueOnCreate = field.defaultValueOnCreate != undefined;
    f.hasDefaultValueOnEdit = field.defaultValueOnEdit != undefined;
    if (field.polymorphic) {
      // convert boolean into object
      // we keep boolean as an option to keep API simple
      if (typeof field.polymorphic === "boolean") {
        f.polymorphic = {};
      } else {
        f.polymorphic = field.polymorphic;
      }
    } else {
      delete f.polymorphic;
    }
    // convert string to object to make API consumed by go simple
    if (f.fieldEdge && f.fieldEdge.inverseEdge) {
      if (typeof f.fieldEdge.inverseEdge === "string") {
        f.fieldEdge.inverseEdge = {
          name: f.fieldEdge.inverseEdge,
        };
      }
    }
    if (patternName) {
      f.patternName = patternName;
    }

    transformType(field.type);

    ret.push(f);
  }
  return ret;
}

function transformImportType(typ: Type) {
  if (!typ.importType) {
    return;
  }
  typ.importType = {
    ...typ.importType,
    // these 2 needed for forwards compatibility with new go schema
    importPath: typ.importType.path,
    import: typ.importType.type,
  };
}

function transformType(typ: Type | undefined) {
  if (!typ) {
    return;
  }
  transformImportType(typ);
  transformType(typ.listElemType);
}

function processEdges(
  src: AssocEdge[],
  patternName?: string,
): ProcessedAssocEdge[] {
  const ret: ProcessedAssocEdge[] = [];
  for (const edge of src) {
    let edge2 = { ...edge } as ProcessedAssocEdge;
    edge2.edgeActions = edge.edgeActions?.map((action) =>
      processAction(action),
    );
    edge2.patternName = patternName;
    ret.push(edge2);
  }
  return ret;
}

function processEdgeGroups(
  processedSchema: ProcessedSchema,
  edgeGroups: AssocEdgeGroup[],
) {
  // array-ify this
  for (const group of edgeGroups) {
    if (group.nullStates && !Array.isArray(group.nullStates)) {
      group.nullStates = [group.nullStates];
    }
    let group2 = { ...group } as ProcessedAssocEdgeGroup;
    if (group.edgeAction) {
      group2.edgeAction = processAction(group.edgeAction);
    }
    processedSchema.assocEdgeGroups.push(group2);
  }
}

function processPattern(
  patterns: patternsDict,
  pattern: Pattern,
  processedSchema: ProcessedSchema,
): TransformFlags {
  let ret: TransformFlags = {
    ...pattern,
  };
  const name = pattern.name;
  const fields = processFields(pattern.fields, pattern.name);
  processedSchema.fields.push(...fields);
  if (pattern.edges) {
    const edges = processEdges(pattern.edges, pattern.name);
    processedSchema.assocEdges.push(...edges);
  }

  // flag transformsSelect
  if (pattern.transformRead) {
    ret.transformsSelect = true;
  }

  if (patterns[name] === undefined) {
    // intentionally processing separately and not passing pattern.name
    const edges = processEdges(pattern.edges || []);
    patterns[name] = {
      name: pattern.name,
      assocEdges: edges,
      fields: fields,
    };
  } else {
    // TODO ideally we want to make sure that different patterns don't have the same name
    // can't do a deepEqual check because function calls and therefore different instances in fields
  }
  return ret;
}

enum NullableResult {
  CONTENTS = "contents",
  CONTENTS_AND_LIST = "contentsAndList",
  ITEM = "true", // nullable = true
}

type ProcessedActionField = Omit<ActionField, "nullable"> & {
  nullable?: NullableResult;
};

type ProcessedAssocEdge = Omit<
  AssocEdge,
  "actionOnlyFields" | "edgeActions"
> & {
  // indicates edge is part of a pattern and should reference that pattern
  // e.g. use pattern's const, pattern edgequery base class etc
  // set via framework
  patternName?: string;
  edgeActions?: OutputAction[];
};

interface TransformFlags {
  // we don't necessary use all of the below but we flag it for now
  // in case we end up using it in the future
  // we only care
  // meaning there needs to be a way to load without transformation
  transformsSelect?: boolean;
  // meaning there needs to be a way to actually delete
  transformsDelete?: boolean;

  transformsInsert?: boolean;
  transformsUpdate?: boolean;
}

type ProcessedSchema = Omit<
  Schema,
  "edges" | "actions" | "edgeGroups" | "fields"
> &
  TransformFlags & {
    actions: OutputAction[];
    assocEdges: ProcessedAssocEdge[];
    assocEdgeGroups: ProcessedAssocEdgeGroup[];
    fields: ProcessedField[];
  };

type ProcessedAssocEdgeGroup = Omit<AssocEdgeGroup, "edgeAction"> & {
  edgeAction?: OutputAction;
};

// interface InputAction extends Action {
//   actionOnlyFields?: ActionField[];
// }

type OutputAction = Omit<Action, "actionOnlyFields"> & {
  actionOnlyFields?: ProcessedActionField[];
};

function processAction(action: Action): OutputAction {
  if (!action.actionOnlyFields) {
    return { ...action } as OutputAction;
  }

  let ret = { ...action } as OutputAction;
  let actionOnlyFields: ProcessedActionField[] = action.actionOnlyFields.map(
    (f) => {
      let f2 = f as ProcessedActionField;
      if (!f.nullable) {
        delete f2.nullable;
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
    },
  );
  ret.actionOnlyFields = actionOnlyFields;
  return ret;
}

interface schemasDict {
  [key: string]: ProcessedSchema;
}

interface ProcessedPattern {
  name: string;
  assocEdges: ProcessedAssocEdge[];
  fields: ProcessedField[];
}

type ProcessedField = Omit<
  Field,
  "defaultValueOnEdit" | "defaultValueOnCreate"
> & {
  hasDefaultValueOnCreate?: boolean;
  hasDefaultValueOnEdit?: boolean;
  patternName?: string;
};

interface patternsDict {
  [key: string]: ProcessedPattern;
}

interface Result {
  schemas: schemasDict;
  patterns: patternsDict;
}

export function parseSchema(potentialSchemas: {}): Result {
  let schemas: schemasDict = {};
  let patterns: patternsDict = {};

  for (const key in potentialSchemas) {
    const value = potentialSchemas[key];
    let schema: Schema;
    if (value.constructor == Object) {
      schema = value;
    } else {
      schema = new value();
    }
    let processedSchema: ProcessedSchema = {
      fields: [],
      tableName: schema.tableName,
      enumTable: schema.enumTable,
      dbRows: schema.dbRows,
      constraints: schema.constraints,
      indices: schema.indices,
      hideFromGraphQL: schema.hideFromGraphQL,
      actions: schema.actions?.map((action) => processAction(action)) || [],
      assocEdges: [],
      assocEdgeGroups: [],
    };
    // let's put patterns first just so we have id, created_at, updated_at first
    // ¯\_(ツ)_/¯
    if (schema.patterns) {
      for (const pattern of schema.patterns) {
        const ret = processPattern(patterns, pattern, processedSchema);
        if (ret.transformsSelect) {
          if (processedSchema.transformsSelect) {
            throw new Error(
              `can only have one pattern which transforms default querying behavior`,
            );
          }
          processedSchema.transformsSelect = true;
        }

        if (ret.transformsDelete) {
          if (processedSchema.transformsDelete) {
            throw new Error(
              `can only have one pattern which transforms default deletion behavior`,
            );
          }
          processedSchema.transformsDelete = true;
        }
      }
    }
    const fields = processFields(schema.fields);
    processedSchema.fields.push(...fields);
    if (schema.edges) {
      const edges = processEdges(schema.edges);
      processedSchema.assocEdges.push(...edges);
    }
    if (schema.edgeGroups) {
      processEdgeGroups(processedSchema, schema.edgeGroups);
    }

    schemas[key] = processedSchema;
  }

  return { schemas, patterns };
}
