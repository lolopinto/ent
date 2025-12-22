import { cosmiconfigSync } from "cosmiconfig";
import { PACKAGE } from "../core/const.js";
import {
  Pattern,
  Schema,
  Field,
  AssocEdge,
  AssocEdgeGroup,
  Action,
  EdgeAction,
} from "../schema/index.js";
import {
  ActionField,
  Type,
  FieldMap,
  GlobalSchema,
  EdgeIndex,
  TransformReadBetaResult,
  CanViewerDo,
  EdgeGroupAction,
} from "../schema/schema.js";
import { setGlobalSchema } from "../core/global_schema.js";

export async function processFields(
  src: FieldMap | Field[],
  patternName?: string,
): Promise<ProcessedField[]> {
  const ret: ProcessedField[] = [];
  let m: FieldMap = {};
  if (Array.isArray(src)) {
    for (const field of src) {
      const name = field.name;
      if (!name) {
        throw new Error(`name is required`);
      }
      m[name] = field;
    }
  } else {
    m = src;
  }
  for (const name in m) {
    const field = m[name];
    //@ts-ignore type and other changed fields with different type in ProcessedField vs Field
    let f: ProcessedField = { ...field, name };
    f.hasDefaultValueOnCreate = field.defaultValueOnCreate != undefined;
    f.hasDefaultValueOnEdit = field.defaultValueOnEdit != undefined;
    f.hasFieldPrivacy = field.privacyPolicy !== undefined;
    f.hasEditFieldPrivacy = field.editPrivacyPolicy !== undefined;
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
    if (field.private) {
      // convert boolean into object
      // we keep boolean as an option to keep API simple
      if (typeof field.private === "boolean") {
        f.private = {};
      } else {
        f.private = field.private;
      }
    } else {
      delete f.private;
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
    if (field.serverDefault !== undefined) {
      f.serverDefault = await transformServerDefault(
        name,
        field,
        field.serverDefault,
      );
    }

    transformType(field.type);

    if (field.getDerivedFields) {
      f.derivedFields = await processFields(field.getDerivedFields(name));
    }
    if (field.type.subFields) {
      f.type.subFields = await processFields(field.type.subFields);
    }
    if (field.type.unionFields) {
      f.type.unionFields = await processFields(field.type.unionFields);
    }
    if (
      field.type.listElemType &&
      field.type.listElemType.subFields &&
      // check to avoid ts-ignore below. exists just for tsc
      f.type.listElemType
    ) {
      f.type.listElemType.subFields = await processFields(
        field.type.listElemType.subFields,
      );
    }
    ret.push(f);
  }
  return ret;
}

async function transformServerDefault(name: string, f: Field, value: any) {
  if (f.valid) {
    if (!(await f.valid(value))) {
      throw new Error(`invalid value ${value} passed to field ${name}`);
    }
  }
  if (f.format) {
    value = await f.format(value);
  }
  switch (typeof value) {
    case "boolean":
    case "number":
    case "bigint":
    case "string":
      return `${value}`;
    default:
      throw new Error(`invalid value ${value} passed to field ${name}`);
  }
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

async function processPattern(
  patterns: ProcessPatterns,
  pattern: Pattern,
  processedSchema: ProcessedSchema,
): Promise<TransformFlags> {
  let ret: TransformFlags = {
    ...pattern,
  };
  const name = pattern.name;
  const fields = await processFields(pattern.fields, pattern.name);
  processedSchema.fields.push(...fields);
  if (pattern.edges) {
    const edges = processEdges(pattern.edges, pattern.name);
    processedSchema.assocEdges.push(...edges);
  }

  // flag transformsSelect
  if (pattern.transformRead) {
    ret.transformsSelect = true;

    if (pattern.transformReadCodegen_BETA) {
      const r = pattern.transformReadCodegen_BETA();
      if (typeof r === "string") {
        ret.transformsLoaderCodegen = {
          code: r,
          imports: [
            {
              importPath: PACKAGE,
              import: "query",
            },
          ],
        };
      } else {
        ret.transformsLoaderCodegen = r;
      }
    }
  }

  if (!patterns.hasPattern(name)) {
    // intentionally processing separately and not passing pattern.name
    const edges = processEdges(pattern.edges || []);
    const processed = {
      name: pattern.name,
      assocEdges: edges,
      fields: fields,
      disableMixin: pattern.disableMixin,
    };
    patterns.addPattern(pattern, processed);
  } else {
    // can't do a deepEqual check because function calls and therefore different instances in fields
    // so compare as best we can
    const cmp = comparePatterns(pattern, patterns);
    if (typeof cmp !== "boolean") {
      if (cmp.field) {
        throw new Error(
          `pattern '${pattern.name}' in schema ${processedSchema.schemaPath} has different field ${cmp.field.name} from another pattern with the same name`,
        );
      } else if (cmp.edge) {
        throw new Error(
          `pattern '${pattern.name}' in schema ${processedSchema.schemaPath} has different field ${cmp.edge.name} from another pattern with the same name`,
        );
      } else {
        throw new Error(
          `pattern '${pattern.name}' in schema ${processedSchema.schemaPath} has different ${cmp.difference} from another pattern with the same name`,
        );
      }
    }
  }
  return ret;
}

interface ComparePatternResult {
  difference?: "name" | "disableMixin" | "field" | "edges" | "edge";
  field?: {
    name: string;
  };
  edge?: {
    name: string;
  };
}

function comparePatterns(
  pattern: Pattern,
  patterns: ProcessPatterns,
): true | ComparePatternResult {
  const processedPattern = patterns.getProcessedPattern(pattern.name);
  if (pattern.name !== processedPattern.name) {
    return {
      difference: "name",
    };
  }
  if (pattern.disableMixin !== processedPattern.disableMixin) {
    return {
      difference: "disableMixin",
    };
  }
  const processedFields = patterns.getPatternFields(pattern.name);
  for (const k in pattern.fields) {
    if (!processedFields[k]) {
      return {
        difference: "field",
        field: {
          name: k,
        },
      };
    }
    if (!compareField(pattern.fields[k], processedFields[k])) {
      return {
        difference: "field",
        field: {
          name: k,
        },
      };
    }
  }
  for (const k in processedFields) {
    if (!pattern.fields[k]) {
      return {
        difference: "field",
        field: {
          name: k,
        },
      };
    }
  }
  if (
    (pattern.edges?.length ?? 0) !== (processedPattern.assocEdges.length ?? 0)
  ) {
    return {
      difference: "edges",
    };
  }
  if (!pattern.edges?.length) {
    return true;
  }
  for (let i = 0; i < pattern.edges?.length; i++) {
    if (!compareEdge(pattern.edges[i], processedPattern.assocEdges[i])) {
      return {
        difference: "edge",
        edge: {
          name: pattern.edges[i].name,
        },
      };
    }
  }
  return true;
}

function compareObject(o1: Object, o2: Object): boolean {
  for (const k in o1) {
    const v = o1[k];
    if (
      typeof v === "function" ||
      typeof v === "symbol" ||
      (typeof v === "object" && v !== null)
    ) {
      continue;
    }
    if (v !== o2[k]) {
      return false;
    }
  }
  return true;
}

function compareField(field: Field, procesedField: Field): boolean {
  for (const k in field) {
    if (!compareObject(field[k], procesedField[k])) {
      return false;
    }
  }
  return true;
}

function compareEdge(
  edge: AssocEdge,
  processedEdge: ProcessedAssocEdge,
): boolean {
  for (const k in edge) {
    if (!compareObject(edge[k], processedEdge[k])) {
      return false;
    }
  }
  return true;
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

  transformsLoaderCodegen?: TransformReadBetaResult;

  transformsInsert?: boolean;
  transformsUpdate?: boolean;
}

type ProcessedSchema = Omit<
  Schema,
  "edges" | "actions" | "edgeGroups" | "fields" | "defaultActionPrivacy"
> &
  TransformFlags & {
    actions: OutputAction[];
    assocEdges: ProcessedAssocEdge[];
    assocEdgeGroups: ProcessedAssocEdgeGroup[];
    // converting to list for go because we want the order respected
    // and go maps don't support order

    fields: ProcessedField[];

    schemaPath?: string;
    patternNames?: string[];

    hasDefaultActionPrivacy?: boolean;
  };

type ProcessedAssocEdgeGroup = Omit<AssocEdgeGroup, "edgeAction"> & {
  edgeAction?: OutputAction;
};

type OutputAction = Omit<Action, "actionOnlyFields" | "canViewerDo"> & {
  actionOnlyFields?: ProcessedActionField[];
  canViewerDo?: CanViewerDo;
};

function processAction(
  action: Action | EdgeAction | EdgeGroupAction,
): OutputAction {
  const ret = { ...action } as OutputAction;
  if (action.actionOnlyFields !== undefined) {
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
          } else if (f.nullable === "contents") {
            f2.nullable = NullableResult.CONTENTS;
          } else if (f.nullable === "true") {
            // shouldn't happen but ran into weirdness where it did...
            f2.nullable = NullableResult.ITEM;
          }
        }

        return f2;
      },
    );
    ret.actionOnlyFields = actionOnlyFields;
  }

  if (action.canViewerDo !== undefined) {
    if (typeof action.canViewerDo !== "object") {
      delete ret.canViewerDo;
      ret.canViewerDo = {};
    }
  }

  return ret;
}

interface schemasDict {
  [key: string]: ProcessedSchema;
}

interface ProcessedPattern {
  name: string;
  assocEdges: ProcessedAssocEdge[];
  fields: ProcessedField[];
  disableMixin?: boolean;
}

type ProcessedType = Omit<
  Type,
  "subFields" | "listElemType" | "unionFields"
> & {
  subFields?: ProcessedField[];
  listElemType?: ProcessedType;
  unionFields?: ProcessedField[];
};

export type ProcessedField = Omit<
  Field,
  | "defaultValueOnEdit"
  | "defaultValueOnCreate"
  | "privacyPolicy"
  | "type"
  | "serverDefault"
> & {
  name: string;
  hasDefaultValueOnCreate?: boolean;
  hasDefaultValueOnEdit?: boolean;
  patternName?: string;
  hasFieldPrivacy?: boolean;
  hasEditFieldPrivacy?: boolean;
  derivedFields?: ProcessedField[];
  type: ProcessedType;
  serverDefault?: string;
};

interface patternsDict {
  [key: string]: ProcessedPattern;
}

interface Result {
  schemas: schemasDict;
  patterns: patternsDict;
  globalSchema?: ProcessedGlobalSchema;
  config?: {
    // TODO rename this to biome eventually...
    rome?: BiomeConfig;
  };
}

declare type PotentialSchemas = {
  [key: string]: any;
};

interface InputSchema extends Schema {
  schemaPath?: string;
}

class ProcessPatterns {
  patternsDict: patternsDict = {};
  originalPatterns: {
    [key: string]: Pattern;
  } = {};
  constructor() {}

  addPattern(pattern: Pattern, processed: ProcessedPattern) {
    this.originalPatterns[pattern.name] = pattern;
    this.patternsDict[pattern.name] = processed;
  }

  getProcessedPattern(name: string): ProcessedPattern {
    const pattern = this.patternsDict[name];
    if (!pattern) {
      throw new Error(`no pattern ${name}`);
    }
    return pattern;
  }

  getPatternFields(name: string): FieldMap {
    const pattern = this.originalPatterns[name];
    if (!pattern) {
      throw new Error(`no pattern ${name}`);
    }
    return pattern.fields;
  }

  hasPattern(name: string): boolean {
    return !!this.patternsDict[name];
  }
}

export async function parseSchema(
  potentialSchemas: PotentialSchemas,
  globalSchema?: GlobalSchema,
): Promise<Result> {
  const schemas: schemasDict = {};
  const processPatterns = new ProcessPatterns();
  let parsedGlobalSchema: ProcessedGlobalSchema | undefined;

  if (globalSchema) {
    parsedGlobalSchema = await parseGlobalSchema(globalSchema);
    // set this so that we can use it, if we're trying to process server default or anything
    // that ends up parsing,validating and formatting fields
    setGlobalSchema(globalSchema);
  }
  for (const key in potentialSchemas) {
    const value = potentialSchemas[key];
    let schema: InputSchema;
    const name = value.constructor.name;
    // named class e.g. new BaseEntSchema
    switch (name) {
      case "Function":
        schema = new value();
        break;
      default:
        // implicit schema or named class
        schema = value;
    }
    let processedSchema: ProcessedSchema = {
      fields: [],
      fieldOverrides: schema.fieldOverrides,
      schemaPath: schema.schemaPath,
      tableName: schema.tableName,
      enumTable: schema.enumTable,
      dbRows: schema.dbRows,
      constraints: schema.constraints,
      indices: schema.indices,
      hideFromGraphQL: schema.hideFromGraphQL,
      actions: schema.actions?.map((action) => processAction(action)) || [],
      assocEdges: [],
      assocEdgeGroups: [],
      customGraphQLInterfaces: schema.customGraphQLInterfaces,
      supportUpsert: schema.supportUpsert,
      showCanViewerSee: schema.showCanViewerSee,
      showCanViewerEdit: schema.showCanViewerEdit,
      hasDefaultActionPrivacy: schema.defaultActionPrivacy !== undefined,
    };
    // let's put patterns first just so we have id, created_at, updated_at first
    // ¯\_(ツ)_/¯
    let patternNames: string[] = [];
    if (schema.patterns) {
      for (const pattern of schema.patterns) {
        const ret = await processPattern(
          processPatterns,
          pattern,
          processedSchema,
        );
        patternNames.push(pattern.name);
        if (ret.transformsSelect) {
          if (processedSchema.transformsSelect) {
            throw new Error(
              `can only have one pattern which transforms default querying behavior`,
            );
          }
          processedSchema.transformsSelect = true;
          if (ret.transformsLoaderCodegen) {
            processedSchema.transformsLoaderCodegen =
              ret.transformsLoaderCodegen;
          }
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
    const fields = await processFields(schema.fields);
    processedSchema.fields.push(...fields);
    processedSchema.patternNames = patternNames;
    if (schema.edges) {
      const edges = processEdges(schema.edges);
      processedSchema.assocEdges.push(...edges);
    }
    if (schema.edgeGroups) {
      processEdgeGroups(processedSchema, schema.edgeGroups);
    }

    schemas[key] = processedSchema;
  }
  const biome = translatePrettier();

  return {
    schemas,
    patterns: processPatterns.patternsDict,
    globalSchema: parsedGlobalSchema,
    config: {
      rome: biome,
    },
  };
}

interface BiomeConfig {
  indentStyle?: string;
  lineWidth?: number;
  indentSize?: number;
  quoteStyle?: string;
  quoteProperties?: string;
  trailingComma?: string;
}

function translatePrettier(): BiomeConfig | undefined {
  const r = cosmiconfigSync("prettier").search();
  if (!r) {
    return;
  }
  const ret: BiomeConfig = {};
  if (r.config.printWidth !== undefined) {
    ret.lineWidth = parseInt(r.config.printWidth);
  }
  if (r.config.useTabs) {
    ret.indentStyle = "tab";
  } else {
    ret.indentStyle = "space";
  }
  if (r.config.tabWidth !== undefined) {
    ret.indentSize = parseInt(r.config.tabWidth);
  }
  if (r.config.singleQuote) {
    ret.quoteStyle = "single";
  } else {
    ret.quoteStyle = "double";
  }
  if (r.config.quoteProps !== undefined) {
    if (r.config.quoteProps === "consistent") {
      // biome doesn't support this
      ret.quoteProperties = "as-needed";
    } else {
      ret.quoteProperties = r.config.quoteProps;
    }
  }
  if (r.config.trailingComma !== undefined) {
    ret.trailingComma = r.config.trailingComma;
  }
  return ret;
}

interface ProcessedGlobalSchema {
  globalEdges: ProcessedAssocEdge[];
  extraEdgeFields: ProcessedField[];
  edgeIndices?: EdgeIndex[];
  init?: boolean;
  transformsEdges?: boolean;
  globalFields?: ProcessedField[];
}

async function parseGlobalSchema(
  s: GlobalSchema,
): Promise<ProcessedGlobalSchema> {
  const ret: ProcessedGlobalSchema = {
    globalEdges: [],
    extraEdgeFields: [],
    init:
      !!s.extraEdgeFields ||
      !!s.edgeIndices ||
      s.transformEdgeRead !== undefined ||
      s.transformEdgeWrite !== undefined ||
      s.fields !== undefined,
    transformsEdges: !!s.transformEdgeRead || !!s.transformEdgeWrite,
  };

  if (s.extraEdgeFields) {
    ret.extraEdgeFields = await processFields(s.extraEdgeFields);
  }

  if (s.edgeIndices) {
    ret.edgeIndices = s.edgeIndices;
  }

  if (s.edges) {
    ret.globalEdges = processEdges(s.edges);
  }

  if (s.fields) {
    ret.globalFields = await processFields(s.fields);
  }

  return ret;
}
