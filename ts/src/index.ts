export * from "./core/base.js";
export {
  loadEnt,
  loadCustomData,
  loadCustomEnts,
  loadCustomCount,
  loadEntX,
  loadEnts,
  CustomQuery,
  loadDerivedEnt,
  loadDerivedEntX,
  loadEntViaKey,
  loadEntXViaKey,
  performRawQuery,
  // even these 3 need to change...
  loadRowX,
  loadRow,
  loadRows,
  AssocEdge,
  AssocEdgeData,
  loadEdgeData,
  loadEdgeDatas,
  loadEdges,
  loadUniqueEdge,
  loadUniqueNode,
  loadRawEdgeCountX,
  loadEdgeForID2,
  loadNodesByEdge,
  getEdgeTypeInGroup,
} from "./core/ent.js";
// TODO should these even be exported from the root?
export {
  DataOperation,
  EditNodeOptions,
  EditNodeOperation,
  RawQueryOperation,
  EdgeOperation,
  DeleteNodeOperation,
  AssocEdgeInputOptions,
  AssocEdgeInput,
} from "./action/operations.js";
export { setGlobalSchema } from "./core/global_schema.js";
import DB from "./core/db.js";
export * from "./core/loaders/index.js";
export { DB };

// TODO figure out if this should be its own import path e.g. @snowtop/ent/privacy
export {
  EntPrivacyError,
  AlwaysAllowRule,
  AlwaysDenyRule,
  DenyIfLoggedInRule,
  DenyIfLoggedOutRule,
  AllowIfHasIdentity,
  AllowIfViewerRule,
  AllowIfFuncRule,
  AllowIfViewerIsRule,
  AllowIfViewerIsEntPropertyRule,
  AllowIfEntPropertyIsRule,
  DenyIfEntPropertyIsRule,
  AllowIfViewerEqualsRule,
  DenyIfViewerEqualsRule,
  AllowIfEdgeExistsRule,
  AllowIfViewerInboundEdgeExistsRule,
  AllowIfViewerOutboundEdgeExistsRule,
  DenyIfEdgeExistsRule,
  DenyIfViewerInboundEdgeExistsRule,
  DenyIfViewerOutboundEdgeExistsRule,
  DenyIfEdgeDoesNotExistRule,
  DenyIfViewerInboundEdgeDoesNotExistRule,
  DenyIfViewerOutboundEdgeDoesNotExistRule,
  AllowIfEntIsVisibleRule,
  AllowIfEntIsNotVisibleRule,
  DenyIfEntIsVisibleRule,
  DenyIfEntIsNotVisibleRule,
  AllowIfEntIsVisiblePolicy,
  DenyIfEntIsVisiblePolicy,
  DelayedResultRule,
  applyPrivacyPolicy,
  applyPrivacyPolicyX,
  AlwaysAllowPrivacyPolicy,
  AlwaysDenyPrivacyPolicy,
  AllowIfConditionAppliesRule,
  AllowIfSubPolicyAllowsRule,
  AllowIfViewerPrivacyPolicy,
  AllowIfViewerHasIdentityPrivacyPolicy,
} from "./core/privacy.js";
export * from "./core/query/index.js";
export * from "./core/query_impl.js";

export * from "./schema/index.js";
import * as q from "./core/clause.js";
export { Clause } from "./core/clause.js";
const query = {
  Eq: q.Eq,
  NotEq: q.NotEq,
  And: q.And,
  AndOptional: q.AndOptional,
  Or: q.Or,
  OrOptional: q.OrOptional,
  In: q.In,
  UuidIn: q.UuidIn,
  IntegerIn: q.IntegerIn,
  TextIn: q.TextIn,
  DBTypeIn: q.DBTypeIn,
  UuidNotIn: q.UuidNotIn,
  IntegerNotIn: q.IntegerNotIn,
  TextNotIn: q.TextNotIn,
  DBTypeNotIn: q.DBTypeNotIn,
  Greater: q.Greater,
  Less: q.Less,
  GreaterEq: q.GreaterEq,
  LessEq: q.LessEq,
  ArrayEq: q.ArrayEq,
  ArrayNotEq: q.ArrayNotEq,
  PostgresArrayContainsValue: q.PostgresArrayContainsValue,
  PostgresArrayContains: q.PostgresArrayContains,
  PostgresArrayNotContainsValue: q.PostgresArrayNotContainsValue,
  PostgresArrayNotContains: q.PostgresArrayNotContains,
  PostgresArrayOverlaps: q.PostgresArrayOverlaps,
  PostgresArrayNotOverlaps: q.PostgresArrayNotOverlaps,
  JSONPathValuePredicate: q.JSONPathValuePredicate,
  JSONObjectFieldKeyASJSON: q.JSONObjectFieldKeyASJSON,
  JSONObjectFieldKeyAsText: q.JSONObjectFieldKeyAsText,
  TsQuery: q.TsQuery,
  PlainToTsQuery: q.PlainToTsQuery,
  PhraseToTsQuery: q.PhraseToTsQuery,
  WebsearchToTsQuery: q.WebsearchToTsQuery,
  TsVectorColTsQuery: q.TsVectorColTsQuery,
  TsVectorPlainToTsQuery: q.TsVectorPlainToTsQuery,
  TsVectorPhraseToTsQuery: q.TsVectorPhraseToTsQuery,
  TsVectorWebsearchToTsQuery: q.TsVectorWebsearchToTsQuery,
};

export { query };

export { RequestContext, ContextCache } from "./core/context.js";

export { IDViewer, LoggedOutViewer, IDViewerOptions } from "./core/viewer.js";

export { loadConfig } from "./core/config.js";

export { setLogLevels } from "./core/logger.js";

export * from "./core/convert.js";
