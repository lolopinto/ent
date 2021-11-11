package edge

import (
	"errors"
	"fmt"
	"go/ast"
	"regexp"
	"strconv"
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/jinzhu/inflection"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/depgraph"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/enum"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/lolopinto/ent/internal/util"
)

type EdgeInfo struct {
	// TODO hide FieldEdges etc
	// make them accessors since we want to control mutations
	FieldEdges   []*FieldEdge
	fieldEdgeMap map[string]*FieldEdge

	// new concepts: IndexedEdgeQueries
	// EdgeQueries that will be in _query_base.tmpl file

	IndexedEdgeQueries    []IndexedConnectionEdge
	indexedEdgeQueriesMap map[string]IndexedConnectionEdge

	// DestinationEdges. edges that can be gotten from this node
	// foreign key edges + polymorphic indexed fields...
	DestinationEdges    []ConnectionEdge
	destinationEdgesMap map[string]ConnectionEdge

	Associations      []*AssociationEdge
	assocMap          map[string]*AssociationEdge
	AssocGroups       []*AssociationEdgeGroup
	assocGroupsMap    map[string]*AssociationEdgeGroup
	SourcePackageName string
	SourceNodeName    string

	// don't want name overlap even when being added programmatically because we use those names in all kinds of places even graphql
	keys map[string]bool
}

func NewEdgeInfo(packageName string) *EdgeInfo {
	ret := &EdgeInfo{}
	ret.SourcePackageName = packageName
	ret.SourceNodeName = strcase.ToCamel(packageName)
	ret.fieldEdgeMap = make(map[string]*FieldEdge)
	ret.assocMap = make(map[string]*AssociationEdge)
	ret.assocGroupsMap = make(map[string]*AssociationEdgeGroup)
	ret.indexedEdgeQueriesMap = make(map[string]IndexedConnectionEdge)
	ret.destinationEdgesMap = make(map[string]ConnectionEdge)
	ret.keys = make(map[string]bool)
	return ret
}

func (e *EdgeInfo) HasAssociationEdges() bool {
	return len(e.Associations) > 0
}

func (e *EdgeInfo) addEdge(edge Edge) error {
	if e.keys[edge.GetEdgeName()] {
		return fmt.Errorf("tried to add a new edge named %s to node %s when name already taken", edge.GetEdgeName(), e.SourcePackageName)
	}
	e.keys[edge.GetEdgeName()] = true

	fieldEdge, ok := edge.(*FieldEdge)
	if ok {
		e.FieldEdges = append(e.FieldEdges, fieldEdge)
		e.fieldEdgeMap[fieldEdge.EdgeName] = fieldEdge
		return nil
	}
	assocEdge, ok := edge.(*AssociationEdge)
	if ok {
		e.Associations = append(e.Associations, assocEdge)
		e.assocMap[assocEdge.EdgeName] = assocEdge
	}

	// other edge types are handled separately
	return nil
}

// this is not an edge so doesn't implement Edge interface
func (e *EdgeInfo) addEdgeGroup(assocEdgeGroup *AssociationEdgeGroup) {
	e.AssocGroups = append(e.AssocGroups, assocEdgeGroup)
	e.assocGroupsMap[assocEdgeGroup.GroupStatusName] = assocEdgeGroup
}

func (e *EdgeInfo) GetFieldEdgeByName(edgeName string) *FieldEdge {
	return e.fieldEdgeMap[edgeName]
}

func (e *EdgeInfo) GetForeignKeyEdgeByName(edgeName string) *ForeignKeyEdge {
	edge := e.destinationEdgesMap[edgeName]
	fkey, ok := edge.(*ForeignKeyEdge)
	if ok {
		return fkey
	}
	return nil
}

func (e *EdgeInfo) GetDestinationEdgeByName(edgeName string) ConnectionEdge {
	return e.destinationEdgesMap[edgeName]
}

func (e *EdgeInfo) GetAssociationEdgeByName(edgeName string) *AssociationEdge {
	return e.assocMap[edgeName]
}

func (e *EdgeInfo) GetIndexedEdgeByName(edgeName string) *IndexedEdge {
	edge := e.destinationEdgesMap[edgeName]
	iEdge, ok := edge.(*IndexedEdge)
	if ok {
		return iEdge
	}
	return nil
}

func (e *EdgeInfo) GetEdgeQueryIndexedEdgeByName(edgeName string) *IndexedEdge {
	edge := e.indexedEdgeQueriesMap[edgeName]
	iEdge, ok := edge.(*IndexedEdge)
	if ok {
		return iEdge
	}
	return nil
}

func (e *EdgeInfo) GetAssociationEdgeGroupByStatusName(groupStatusName string) *AssociationEdgeGroup {
	return e.assocGroupsMap[groupStatusName]
}

func (e *EdgeInfo) AddFieldEdgeFromForeignKeyInfo(fieldName, configName string, nullable bool) error {
	return e.addFieldEdgeFromInfo(fieldName, configName, "", nil, nullable)
}

func (e *EdgeInfo) AddFieldEdgeFromFieldEdgeInfo(fieldName string, fieldEdgeInfo *base.FieldEdgeInfo, nullable bool) error {
	return e.addFieldEdgeFromInfo(fieldName, fieldEdgeInfo.Schema+"Config", fieldEdgeInfo.EdgeName, fieldEdgeInfo.Polymorphic, nullable)
}

func (e *EdgeInfo) GetConnectionEdges() []ConnectionEdge {
	var ret []ConnectionEdge

	for _, edge := range e.Associations {
		if edge.Unique {
			continue
		}
		ret = append(ret, edge)
	}

	for _, edge := range e.DestinationEdges {
		if edge.UniqueEdge() {
			continue
		}
		ret = append(ret, edge)
	}

	return ret
}

func (e *EdgeInfo) GetSingularEdges() []Edge {
	var ret []Edge

	for _, edge := range e.Associations {
		if edge.Unique {
			ret = append(ret, edge)
		}
	}
	for _, edge := range e.DestinationEdges {
		if edge.UniqueEdge() {
			ret = append(ret, edge)
		}
	}
	return ret
}

func (e *EdgeInfo) GetEdgesForIndexLoader() []IndexedConnectionEdge {
	return e.IndexedEdgeQueries
}

func (e *EdgeInfo) CreateEdgeBaseFile() bool {
	if len(e.indexedEdgeQueriesMap) > 0 {
		return true
	}

	for _, edge := range e.Associations {
		// CreateEdge is false because we want inverse edges here...
		if edge.PatternName == "" {
			return true
		}
	}
	return false
}

func (e *EdgeInfo) addFieldEdgeFromInfo(fieldName, configName, inverseEdgeName string, polymorphic *base.PolymorphicOptions, nullable bool) error {
	// not an id field, do nothing
	// TODO we need a test for this
	if !strings.HasSuffix(fieldName, "ID") {
		return nil
	}
	trim := strings.TrimSuffix(fieldName, "ID")
	if trim == "" {
		trim = fieldName
	}

	var edgeInfo commonEdgeInfo
	if polymorphic == nil {
		config, err := schemaparser.GetEntConfigFromEntConfig(configName)
		if err != nil {
			return err
		}

		// Edge name: User from UserID field
		edgeInfo = getCommonEdgeInfo(
			trim,
			config,
		)
	} else {
		edgeInfo = commonEdgeInfo{
			EdgeName: trim,
		}
	}

	edge := &FieldEdge{
		FieldName:       fieldName,
		TSFieldName:     strcase.ToLowerCamel(fieldName),
		commonEdgeInfo:  edgeInfo,
		InverseEdgeName: inverseEdgeName,
		Nullable:        nullable,
		Polymorphic:     polymorphic,
	}

	return e.addEdge(edge)
}

func (e *EdgeInfo) AddEdgeFromForeignKeyIndex(dbColName, edgeName, nodeName string) error {
	edge := &ForeignKeyEdge{
		SourceNodeName: e.SourceNodeName,
		destinationEdge: destinationEdge{
			commonEdgeInfo: getCommonEdgeInfo(
				edgeName,
				schemaparser.GetEntConfigFromName(nodeName),
			),
			quotedDbColName: dbColName,
		},
	}
	e.indexedEdgeQueriesMap[edgeName] = edge
	e.destinationEdgesMap[edgeName] = edge
	e.IndexedEdgeQueries = append(e.IndexedEdgeQueries, edge)
	e.DestinationEdges = append(e.DestinationEdges, edge)
	return e.addEdge(edge)
}

func (e *EdgeInfo) AddIndexedEdgeFromSource(tsFieldName, quotedDBColName, nodeName string, polymorphic *base.PolymorphicOptions) error {
	tsEdgeName := strcase.ToCamel(strings.TrimSuffix(tsFieldName, "ID"))
	edge := &IndexedEdge{
		tsEdgeName: tsEdgeName,
		destinationEdge: destinationEdge{
			commonEdgeInfo: getCommonEdgeInfo(
				inflection.Plural(nodeName),
				schemaparser.GetEntConfigFromName(nodeName),
			),
			quotedDbColName: quotedDBColName,
			unique:          polymorphic.Unique,
		},
	}
	if polymorphic.HideFromInverseGraphQL {
		edge._HideFromGraphQL = true
	}
	edgeName := edge.GetEdgeName()
	e.indexedEdgeQueriesMap[edgeName] = edge
	e.IndexedEdgeQueries = append(e.IndexedEdgeQueries, edge)
	return e.addEdge(edge)
}

func (e *EdgeInfo) AddDestinationEdgeFromPolymorphicOptions(tsFieldName, quotedDBColName, nodeName string, polymorphic *base.PolymorphicOptions, foreignNode string) error {
	tsEdgeName := strcase.ToCamel(strings.TrimSuffix(tsFieldName, "ID"))
	edge := &IndexedEdge{
		tsEdgeName: tsEdgeName,
		destinationEdge: destinationEdge{
			commonEdgeInfo: getCommonEdgeInfo(
				inflection.Plural(nodeName),
				schemaparser.GetEntConfigFromName(nodeName),
			),
			quotedDbColName: quotedDBColName,
			unique:          polymorphic.Unique,
		},
		foreignNode: foreignNode,
	}
	if polymorphic.HideFromInverseGraphQL {
		edge._HideFromGraphQL = true
	}
	edgeName := edge.GetEdgeName()
	e.destinationEdgesMap[edgeName] = edge
	e.DestinationEdges = append(e.DestinationEdges, edge)
	return e.addEdge(edge)
}

// ActionableEdge indicates an edge that can be used in an action.
// This provides the edge identifier that can be used in edge action
// PS: why am I so bad at names?
type ActionableEdge interface {
	EdgeIdentifier() string
}

type Edge interface {
	GetEdgeName() string
	GetNodeInfo() nodeinfo.NodeInfo
	GetEntConfig() *schemaparser.EntConfigInfo
	GraphQLEdgeName() string
	CamelCaseEdgeName() string
	HideFromGraphQL() bool
	PolymorphicEdge() bool
	GetTSGraphQLTypeImports() []enttype.FileImport
}

type ConnectionEdge interface {
	Edge
	// For custom edges...
	GetSourceNodeName() string
	GetGraphQLEdgePrefix() string
	GetGraphQLConnectionName() string
	TsEdgeQueryEdgeName() string
	TsEdgeQueryName() string
	UniqueEdge() bool
}

type IndexedConnectionEdge interface {
	ConnectionEdge
	SourceIsPolymorphic() bool
	QuotedDBColName() string
}

// marker interface
type PluralEdge interface {
	Edge
	PluralEdge() bool
	Singular() string
}

type commonEdgeInfo struct {
	EdgeName         string
	entConfig        *schemaparser.EntConfigInfo
	NodeInfo         nodeinfo.NodeInfo
	_HideFromGraphQL bool
}

func (e *commonEdgeInfo) GetEdgeName() string {
	return e.EdgeName
}

func (e *commonEdgeInfo) GetNodeInfo() nodeinfo.NodeInfo {
	return e.NodeInfo
}

func (e *commonEdgeInfo) GetEntConfig() *schemaparser.EntConfigInfo {
	return e.entConfig
}

func (e *commonEdgeInfo) CamelCaseEdgeName() string {
	return strcase.ToCamel(e.EdgeName)
}

func (e *commonEdgeInfo) GraphQLEdgeName() string {
	return strcase.ToLowerCamel(e.EdgeName)
}

func (e *commonEdgeInfo) HideFromGraphQL() bool {
	return e._HideFromGraphQL
}

type FieldEdge struct {
	commonEdgeInfo
	FieldName       string
	TSFieldName     string
	InverseEdgeName string
	Nullable        bool

	Polymorphic *base.PolymorphicOptions
}

func (edge *FieldEdge) PolymorphicEdge() bool {
	// TODO should this be true when polymorphic != nil
	return false
}

func (edge *FieldEdge) GetTSGraphQLTypeImports() []enttype.FileImport {
	// TODO required and nullable eventually (options for the edges that is)
	if edge.Polymorphic != nil {
		return []enttype.FileImport{
			{
				// node type
				ImportType: enttype.EntGraphQL,
				Type:       "GraphQLNodeInterface",
			},
		}
	}
	return []enttype.FileImport{
		{
			ImportType: enttype.Node,
			Type:       edge.NodeInfo.Node,
		},
	}
}

var _ Edge = &FieldEdge{}

type ForeignKeyEdge struct {
	SourceNodeName string
	destinationEdge
}

func (e *ForeignKeyEdge) PluralEdge() bool {
	return true
}

func (e *ForeignKeyEdge) PolymorphicEdge() bool {
	return false
}

func (e *ForeignKeyEdge) GetTSGraphQLTypeImports() []enttype.FileImport {
	// return a connection
	return []enttype.FileImport{
		enttype.NewGQLFileImport("GraphQLNonNull"),
		{
			ImportType: enttype.Connection,
			Type:       e.GetGraphQLConnectionName(),
		},
	}
}

func (e *ForeignKeyEdge) GetSourceNodeName() string {
	return e.SourceNodeName
}

func (e *ForeignKeyEdge) SourceIsPolymorphic() bool {
	return false
}

func (e *ForeignKeyEdge) TsEdgeQueryName() string {
	return fmt.Sprintf("%sTo%sQuery", e.SourceNodeName, strcase.ToCamel(e.EdgeName))
}

func (e *ForeignKeyEdge) GetGraphQLConnectionName() string {
	return fmt.Sprintf("%sTo%sConnection", e.SourceNodeName, strcase.ToCamel(e.EdgeName))
}

func (e *ForeignKeyEdge) TsEdgeQueryEdgeName() string {
	// For ForeignKeyEdge, we only use this with GraphQLConnectionType and the EdgeType is "Data"
	return "Data"
}

func (e *ForeignKeyEdge) GetGraphQLEdgePrefix() string {
	return fmt.Sprintf("%sTo%s", e.SourceNodeName, strcase.ToCamel(e.EdgeName))
}

func (e *ForeignKeyEdge) tsEdgeConst() string {
	return fmt.Sprintf("%sTo%s", e.SourceNodeName, strcase.ToCamel(e.EdgeName))
}

func (e *ForeignKeyEdge) GetCountFactoryName() string {
	return strcase.ToLowerCamel(fmt.Sprintf("%sCountLoaderFactory", e.tsEdgeConst()))
}

func (e *ForeignKeyEdge) GetDataFactoryName() string {
	return strcase.ToLowerCamel(fmt.Sprintf("%sDataLoaderFactory", e.tsEdgeConst()))
}

var _ Edge = &ForeignKeyEdge{}
var _ PluralEdge = &ForeignKeyEdge{}
var _ ConnectionEdge = &ForeignKeyEdge{}
var _ IndexedConnectionEdge = &ForeignKeyEdge{}

type destinationEdge struct {
	commonEdgeInfo
	quotedDbColName string
	unique          bool
}

func (e destinationEdge) Singular() string {
	return inflection.Singular(e.EdgeName)
}

func (e destinationEdge) EdgeIdentifier() string {
	return e.Singular()
}

func (e *destinationEdge) UniqueEdge() bool {
	return e.unique
}

func (e *destinationEdge) QuotedDBColName() string {
	return e.quotedDbColName
}

// this is like a foreign key edge except different
// refers to a field that's indexed but doesn't want to reference it as a foreign key
// currently best use case is as a polymorphic field but nothing stopping this from being non-polymorphic
type IndexedEdge struct {
	SourceNodeName string
	tsEdgeName     string
	foreignNode    string
	destinationEdge
}

func (e *IndexedEdge) PluralEdge() bool {
	return !e.unique
}

func (e *IndexedEdge) PolymorphicEdge() bool {
	return false
}

func (e *IndexedEdge) GetTSGraphQLTypeImports() []enttype.FileImport {
	return []enttype.FileImport{
		enttype.NewGQLFileImport("GraphQLNonNull"),
		{
			ImportType: enttype.Connection,
			Type:       e.GetGraphQLConnectionName(),
		},
	}
}

func (e *IndexedEdge) TsEdgeQueryName() string {
	return fmt.Sprintf("%sTo%sQuery", e.tsEdgeName, strcase.ToCamel(e.EdgeName))
}

func (e *IndexedEdge) GetSourceNodeName() string {
	// hmm. what generates this? why is it always ent?
	return "Ent"
}

func (e *IndexedEdge) SourceIsPolymorphic() bool {
	return true
}

func (e *IndexedEdge) GetGraphQLConnectionName() string {
	if e.foreignNode == "" {
		panic("cannot call GetGraphQLConnectionName when foreignNode is empty")
	}
	return fmt.Sprintf("%sTo%sConnection", e.foreignNode, strcase.ToCamel(e.EdgeName))
}

func (e *IndexedEdge) TsEdgeQueryEdgeName() string {
	// For IndexedEdge, we only use this with GraphQLConnectionType and the EdgeType is "Data"
	return "Data"
}

func (e *IndexedEdge) GetGraphQLEdgePrefix() string {
	if e.foreignNode == "" {
		panic("cannot call GetGraphQLEdgePrefix when foreignNode is empty")
	}
	return fmt.Sprintf("%sTo%s", e.foreignNode, strcase.ToCamel(e.EdgeName))
}

func (e *IndexedEdge) tsEdgeConst() string {
	return fmt.Sprintf("%sTo%s", e.tsEdgeName, strcase.ToCamel(e.EdgeName))
}

func (e *IndexedEdge) GetCountFactoryName() string {
	return strcase.ToLowerCamel(fmt.Sprintf("%sCountLoaderFactory", e.tsEdgeConst()))
}

func (e *IndexedEdge) GetDataFactoryName() string {
	return strcase.ToLowerCamel(fmt.Sprintf("%sDataLoaderFactory", e.tsEdgeConst()))
}

var _ Edge = &IndexedEdge{}
var _ PluralEdge = &IndexedEdge{}
var _ ConnectionEdge = &IndexedEdge{}
var _ IndexedConnectionEdge = &IndexedEdge{}

type InverseAssocEdge struct {
	commonEdgeInfo
	EdgeConst string
}

func (e *InverseAssocEdge) GetTSGraphQLTypeImports() []enttype.FileImport {
	panic("TODO. no GraphQLImports for InverseAssocEdge")
}

func (e *InverseAssocEdge) PolymorphicEdge() bool {
	return false
}

var edgeRegexp = regexp.MustCompile(`(\w+)Edge`)

func TsEdgeConst(constName string) (string, error) {
	match := edgeRegexp.FindStringSubmatch(constName)

	if len(match) != 2 {
		return "", fmt.Errorf("%s is not a valid edge type", constName)
	}

	return match[1], nil
}

type AssociationEdge struct {
	commonEdgeInfo
	EdgeConst     string
	TsEdgeConst   string
	Symmetric     bool
	Unique        bool
	InverseEdge   *InverseAssocEdge
	IsInverseEdge bool
	TableName     string // TableName will be gotten from the GroupName if part of a group or derived from each edge
	// will eventually be made configurable to the user
	EdgeActions []*EdgeAction

	givenEdgeConstName   string
	patternEdgeConst     string
	overridenQueryName   string
	overridenEdgeName    string
	overridenGraphQLName string
	PatternName          string
}

func (e *AssociationEdge) CreateEdge() bool {
	if e.IsInverseEdge {
		return false
	}
	if e.PatternName != "" {
		return false
	}

	return true
}

func (e *AssociationEdge) GenerateSourceLoadEntOptions() bool {
	// when there's a pattern edge, need to provide the getSourceLoadEntOptions method
	return e.PatternName != ""
}

func (e *AssociationEdge) GenerateBase() bool {
	// only generate base when edge is not from a pattern
	return e.PatternName == ""
}

func (e *AssociationEdge) EdgeQueryBase() string {
	if e.patternEdgeConst != "" {
		return fmt.Sprintf("%sQuery", e.patternEdgeConst)
	}
	return e.TsEdgeQueryName() + "Base"
}

func (e *AssociationEdge) AssocEdgeBase() string {
	if e.patternEdgeConst != "" {
		return fmt.Sprintf("%sEdge", e.patternEdgeConst)
	}
	return "AssocEdge"
}

func (e *AssociationEdge) PolymorphicEdge() bool {
	// not fully supported but implicitly supoorted via Patterns
	// TODO not ideal because it blocks Nodes called Object
	return e.NodeInfo.Node == "Object" || e.NodeInfo.Node == "Ent"
}

func (e *AssociationEdge) TsEdgeQueryName() string {
	if e.overridenQueryName != "" {
		return e.overridenQueryName
	}
	return fmt.Sprintf("%sQuery", e.TsEdgeConst)
}

func (e *AssociationEdge) GetGraphQLEdgePrefix() string {
	if e.overridenQueryName != "" {
		// return this with connection removed
		return strings.TrimSuffix(e.overridenQueryName, "Query")
	}
	return e.TsEdgeConst
}

func (e *AssociationEdge) TsEdgeQueryEdgeName() string {
	if e.overridenEdgeName != "" {
		return e.overridenEdgeName
	}
	return fmt.Sprintf("%sEdge", e.TsEdgeConst)
}

func (e *AssociationEdge) GetGraphQLConnectionName() string {
	if e.overridenGraphQLName != "" {
		return e.overridenGraphQLName
	}
	// we need a unique graphql name
	// there's nothing stopping multiple edges of different types having the same connection and then there'll be a conflict here
	// so we use the UserToFoo names to have UserToFriendsConnection and UserToFriendsEdge names
	return fmt.Sprintf("%sConnection", e.TsEdgeConst)
}

func (e *AssociationEdge) GetSourceNodeName() string {
	// we currently don't use this. do we know the source?
	return "Ent"
}

func (e *AssociationEdge) PluralEdge() bool {
	return true
}

func (e *AssociationEdge) Singular() string {
	return inflection.Singular(e.CamelCaseEdgeName())
}

func (e *AssociationEdge) EdgeIdentifier() string {
	return e.Singular()
}

func (edge *AssociationEdge) GetTSGraphQLTypeImports() []enttype.FileImport {
	if edge.Unique {
		return []enttype.FileImport{
			{
				ImportType: enttype.Node,
				Type:       edge.NodeInfo.Node,
			},
		}
	}
	// return a connection
	return []enttype.FileImport{
		enttype.NewGQLFileImport("GraphQLNonNull"),
		{
			ImportType: enttype.Connection,
			Type:       edge.GetGraphQLConnectionName(),
		},
	}
}

func (e *AssociationEdge) AddInverseEdge(inverseEdgeInfo *EdgeInfo) error {
	inverseEdge := e.InverseEdge
	if inverseEdge == nil {
		return nil
	}

	inverseAssocEdge := inverseEdgeInfo.GetAssociationEdgeByName(inverseEdge.EdgeName)
	if inverseAssocEdge != nil {
		return fmt.Errorf(
			"trying to add inverse assoc edge with name %s when edge already exists",
			inverseEdge.EdgeName,
		)
	}

	tsConst, err := TsEdgeConst(inverseEdge.EdgeConst)
	if err != nil {
		return err
	}
	return inverseEdgeInfo.addEdge(&AssociationEdge{
		EdgeConst:      inverseEdge.EdgeConst,
		TsEdgeConst:    tsConst,
		commonEdgeInfo: inverseEdge.commonEdgeInfo,
		IsInverseEdge:  true,
	})
}

func (e *AssociationEdge) CloneWithCommonInfo(configName string) (*AssociationEdge, error) {
	config, err := schemaparser.GetEntConfigFromEntConfig(configName)
	if err != nil {
		return nil, err
	}

	return &AssociationEdge{
		EdgeConst:   e.EdgeConst,
		TsEdgeConst: e.TsEdgeConst,
		Symmetric:   e.Symmetric,
		Unique:      e.Unique,
		InverseEdge: e.InverseEdge,
		TableName:   e.TableName,
		EdgeActions: e.EdgeActions,
		commonEdgeInfo: getCommonEdgeInfo(
			e.EdgeName,
			config,
		),
	}, nil
}

func (e *AssociationEdge) GetCountFactoryName() string {
	return strcase.ToLowerCamel(fmt.Sprintf("%sCountLoaderFactory", e.TsEdgeConst))
}

func (e *AssociationEdge) GetDataFactoryName() string {
	return strcase.ToLowerCamel(fmt.Sprintf("%sDataLoaderFactory", e.TsEdgeConst))
}

func (e *AssociationEdge) UniqueEdge() bool {
	return e.Unique
}

var _ Edge = &AssociationEdge{}
var _ PluralEdge = &AssociationEdge{}
var _ ConnectionEdge = &AssociationEdge{}

// EdgeAction holds as little data as possible about the edge action
// and depends on action to take that information, process it and generate the
// action specific metadata
type EdgeAction struct {
	Action            string
	CustomActionName  string
	CustomGraphQLName string
	ExposeToGraphQL   bool
	ActionOnlyFields  []*input.ActionField
}

type AssociationEdgeGroup struct {
	GroupName         string // this is the name of the edge which is different from the name of the status. confusing
	GroupStatusName   string // should be something like RsvpStatus
	TSGroupStatusName string // changes RsvpStatus to rsvpStatus
	DestNodeInfo      nodeinfo.NodeInfo
	ConstType         string                      // and then this becomes EventRsvpStatus
	Edges             map[string]*AssociationEdge // TODO...
	EdgeActions       []*EdgeAction
	StatusEnums       []string
	NullStateFn       string
	NullStates        []string
	actionEdges       map[string]bool
	statusEdges       []*AssociationEdge
	NodeInfo          nodeinfo.NodeInfo
}

func (edgeGroup *AssociationEdgeGroup) DefaultNullState() string {
	return enum.GetTSEnumNameForVal(edgeGroup.NullStates[0])
}

func (edgeGroup *AssociationEdgeGroup) GetStatusMap() map[string]string {
	m := make(map[string]string)
	for _, edge := range edgeGroup.statusEdges {
		m[enum.GetTSEnumNameForVal(edge.EdgeName)] = edge.TsEdgeConst
	}
	return m
}

func (edgeGroup *AssociationEdgeGroup) GetStatusEdges() []*AssociationEdge {
	return edgeGroup.statusEdges
}

func (edgeGroup *AssociationEdgeGroup) GetEnumValues() []string {
	// enum status values
	values := edgeGroup.GetStatusValues()
	// and then null state for deterministic order
	for _, v := range edgeGroup.NullStates {
		values = append(values, v)
	}
	return values
}

func (edgeGroup *AssociationEdgeGroup) GetStatusValues() []string {
	var values []string
	for _, v := range edgeGroup.statusEdges {
		values = append(values, v.EdgeName)
	}
	return values
}

func (edgeGroup *AssociationEdgeGroup) GetIDArg() string {
	return strcase.ToLowerCamel(edgeGroup.DestNodeInfo.Node + "ID")
}

func (edgeGroup *AssociationEdgeGroup) GetStatusMethod() string {
	return fmt.Sprintf("viewer%s", strcase.ToCamel(edgeGroup.GroupStatusName))
}

func (edgeGroup *AssociationEdgeGroup) GetStatusMapMethod() string {
	return fmt.Sprintf("get%sMap", strcase.ToCamel(edgeGroup.ConstType))
}

func (edgeGroup *AssociationEdgeGroup) EdgeIdentifier() string {
	return edgeGroup.GroupStatusName
}

func (edgeGroup *AssociationEdgeGroup) GetAssociationByName(edgeName string) *AssociationEdge {
	return edgeGroup.Edges[edgeName]
}

func (edgeGroup *AssociationEdgeGroup) GetStatusFuncName() string {
	return "Viewer" + edgeGroup.GroupStatusName
}

func (edgeGroup *AssociationEdgeGroup) GetStatusFieldName() string {
	return "viewer" + edgeGroup.GroupStatusName
}

func (edgeGroup *AssociationEdgeGroup) GetConstNameForEdgeName(edgeName string) string {
	return edgeGroup.NodeInfo.Node + edgeName
}

func (edgeGroup *AssociationEdgeGroup) GetConstNameForUnknown() string {
	// TODO don't hardcode to unknown. Allow this to be customizable
	return edgeGroup.NodeInfo.Node + "Unknown"
}

func (edgeGroup *AssociationEdgeGroup) GetQuotedConstNameForEdgeName(edgeName string) string {
	return strconv.Quote(edgeGroup.GetConstNameForEdgeName(edgeName))
}

func (edgeGroup *AssociationEdgeGroup) AddActionEdges(list []string) {
	if len(list) == 0 {
		return
	}
	edgeGroup.actionEdges = make(map[string]bool)
	for _, edge := range list {
		edgeGroup.actionEdges[edge] = true
	}
}

func (edgeGroup *AssociationEdgeGroup) UseEdgeInStatusAction(edgeName string) bool {
	// no custom edges. nothing to do here
	if edgeGroup.actionEdges == nil {
		return true
	}
	return edgeGroup.actionEdges[edgeName]
}

func ParseEdgesFunc(packageName string, fn *ast.FuncDecl) (*EdgeInfo, error) {

	elts := astparser.GetEltsInFunc(fn)

	node := &input.Node{}
	for _, expr := range elts {

		if err := parseEdgeItem(node, packageName, expr); err != nil {
			return nil, err
		}
	}

	return EdgeInfoFromInput(packageName, node)
}

func EdgeInfoFromInput(packageName string, node *input.Node) (*EdgeInfo, error) {
	edgeInfo := NewEdgeInfo(packageName)

	for _, edge := range node.AssocEdges {
		e, err := AssocEdgeFromInput(packageName, edge)
		if err != nil {
			return nil, err
		}
		edgeInfo.addEdge(e)
	}

	for _, edgeGroup := range node.AssocEdgeGroups {
		group, err := assocEdgeGroupFromInput(packageName, node, edgeGroup, edgeInfo)
		if err != nil {
			return nil, err
		}
		edgeInfo.addEdgeGroup(group)
	}
	return edgeInfo, nil
}

func edgeActionsFromInput(actions []*input.EdgeAction) ([]*EdgeAction, error) {
	if actions == nil {
		return nil, nil
	}
	ret := make([]*EdgeAction, len(actions))
	for idx, action := range actions {
		a, err := getTypeNameActionOperationFromTypeName(action.Operation)
		if err != nil {
			return nil, err
		}
		ret[idx] = &EdgeAction{
			ExposeToGraphQL:   !action.HideFromGraphQL,
			CustomActionName:  action.CustomActionName,
			CustomGraphQLName: action.CustomGraphQLName,
			Action:            a,
			ActionOnlyFields:  action.ActionOnlyFields,
		}
	}
	return ret, nil
}

// packageName == "object" for edges from patterns
func AssocEdgeFromInput(packageName string, edge *input.AssocEdge) (*AssociationEdge, error) {
	assocEdge := &AssociationEdge{
		Symmetric:          edge.Symmetric,
		Unique:             edge.Unique,
		TableName:          edge.TableName,
		PatternName:        edge.PatternName,
		givenEdgeConstName: edge.EdgeConstName,
	}

	// name wasn't specified? get default one
	if assocEdge.TableName == "" {
		tableNameParts := []string{
			packageName,
			base.GetSnakeCaseName(edge.Name),
			"edges",
		}
		assocEdge.TableName = base.GetNameFromParts(tableNameParts)
	}

	var err error
	assocEdge.EdgeActions, err = edgeActionsFromInput(edge.EdgeActions)
	if err != nil {
		return nil, err
	}

	if edge.InverseEdge != nil {
		inverseEdge := &InverseAssocEdge{}

		edgeName := edge.InverseEdge.Name
		inversePackageName := edge.SchemaName
		if inversePackageName == "" {
			inversePackageName = edge.EntConfig.PackageName
		}
		if edge.InverseEdge.EdgeConstName != "" {
			inverseEdge.EdgeConst = edge.InverseEdge.EdgeConstName + "Edge"
		} else {
			inverseEdge.EdgeConst = getEdgeConstName(inversePackageName, edgeName)
		}

		// use ent instead of object for this so that when we useImport Ent everywhere it works
		configPkgName := packageName
		if packageName == "object" {
			configPkgName = "ent"
		}
		inverseEdge.commonEdgeInfo = getCommonEdgeInfo(
			edgeName,
			// need to create a new EntConfig for the inverse edge

			// take something like folder and create Folder and FolderConfig
			// TODO: probably want to pass this down instead of magically configuring this
			schemaparser.GetEntConfigFromName(configPkgName),
		)
		assocEdge.InverseEdge = inverseEdge
	}

	if edge.EdgeConstName == "" {
		assocEdge.EdgeConst = getEdgeConstName(packageName, edge.Name)
		// It transforms UserToFriendsEdge to UserToFriends since that's in an enum
		edgeConst, err := TsEdgeConst(assocEdge.EdgeConst)
		if err != nil {
			return nil, err
		}
		assocEdge.TsEdgeConst = edgeConst

		if edge.PatternName != "" {
			oldEdgeConst := assocEdge.TsEdgeConst
			assocEdge.patternEdgeConst = assocEdge.TsEdgeConst
			assocEdge.EdgeConst = getEdgeConstName("object", edge.Name)
			// It transforms UserToFriendsEdge to UserToFriends since that's in an enum
			edgeConst, err := TsEdgeConst(assocEdge.EdgeConst)
			if err != nil {
				return nil, err
			}
			assocEdge.TsEdgeConst = edgeConst
			assocEdge.patternEdgeConst = edgeConst
			assocEdge.overridenQueryName = fmt.Sprintf("%sQuery", oldEdgeConst)
			assocEdge.overridenEdgeName = fmt.Sprintf("%sEdge", oldEdgeConst)
			assocEdge.overridenGraphQLName = fmt.Sprintf("%sConnection", oldEdgeConst)
		}
	} else {
		assocEdge.EdgeConst = edge.EdgeConstName + "Edge"
		assocEdge.TsEdgeConst = edge.EdgeConstName

		// todo we need to test this when pattern doesn't provide this
		if edge.PatternName != "" {
			assocEdge.patternEdgeConst = assocEdge.TsEdgeConst
			assocEdge.EdgeConst = getEdgeConstName(packageName, edge.Name)
			// It transforms UserToFriendsEdge to UserToFriends since that's in an enum
			edgeConst, err := TsEdgeConst(assocEdge.EdgeConst)
			if err != nil {
				return nil, err
			}
			assocEdge.overridenQueryName = fmt.Sprintf("%sQuery", edgeConst)
			assocEdge.overridenEdgeName = fmt.Sprintf("%sEdge", edgeConst)
			assocEdge.overridenGraphQLName = fmt.Sprintf("%sConnection", edgeConst)
		}
	}

	// golang
	if edge.EntConfig != nil {
		assocEdge.commonEdgeInfo = getCommonEdgeInfo(edge.Name, edge.EntConfig)
	} else { // typescript
		assocEdge.commonEdgeInfo = getCommonEdgeInfo(
			edge.Name,
			schemaparser.GetEntConfigFromName(edge.SchemaName),
		)
	}
	assocEdge._HideFromGraphQL = edge.HideFromGraphQL

	return assocEdge, nil
}

func assocEdgeGroupFromInput(packageName string, node *input.Node, edgeGroup *input.AssocEdgeGroup, edgeInfo *EdgeInfo) (*AssociationEdgeGroup, error) {
	assocEdgeGroup := &AssociationEdgeGroup{
		GroupName:         edgeGroup.Name,
		GroupStatusName:   edgeGroup.GroupStatusName,
		TSGroupStatusName: strcase.ToLowerCamel(edgeGroup.GroupStatusName),
		NodeInfo:          nodeinfo.GetNodeInfo(packageName),
	}

	// no overriden table name, get default one
	tableName := edgeGroup.TableName
	if tableName == "" {
		tableName = getDefaultTableName(packageName, edgeGroup.Name)
	}

	assocEdgeGroup.Edges = make(map[string]*AssociationEdge)

	var err error
	if edgeGroup.EdgeAction != nil {
		assocEdgeGroup.EdgeActions, err = edgeActionsFromInput([]*input.EdgeAction{edgeGroup.EdgeAction})
		if err != nil {
			return nil, err
		}
	} else {
		assocEdgeGroup.EdgeActions, err = edgeActionsFromInput(edgeGroup.EdgeActions)
		if err != nil {
			return nil, err
		}
	}
	assocEdgeGroup.StatusEnums = edgeGroup.StatusEnums
	assocEdgeGroup.NullStateFn = edgeGroup.NullStateFn
	assocEdgeGroup.NullStates = edgeGroup.NullStates
	if assocEdgeGroup.NullStateFn != "" && len(assocEdgeGroup.NullStates) == 0 {
		return nil, fmt.Errorf("cannot have null state fn with no null states")
	}

	var statusEdges []*AssociationEdge

	for _, edge := range edgeGroup.AssocEdges {
		// if input edge doesn't have its own tableName, use group tableName
		if edge.TableName == "" {
			edge.TableName = tableName
		}
		assocEdge, err := AssocEdgeFromInput(packageName, edge)
		if err != nil {
			return nil, err
		}
		assocEdgeGroup.Edges[edge.Name] = assocEdge
		// if assocEdge.InverseEdge != nil {
		// TODO should we add inverse edges to this map?
		// need to audit everything related to assoc groups anyways
		// }
		if err := edgeInfo.addEdge(assocEdge); err != nil {
			return nil, err
		}

		// do it in the order this was written
		if len(assocEdgeGroup.StatusEnums) == 0 {
			statusEdges = append(statusEdges, assocEdge)
		}
	}

	if len(assocEdgeGroup.StatusEnums) != 0 {
		for _, v := range edgeGroup.StatusEnums {
			edge := assocEdgeGroup.GetAssociationByName(v)
			if edge == nil {
				return nil, fmt.Errorf("invalid assoc %s in group %s", v, assocEdgeGroup.GroupName)
			}
			statusEdges = append(statusEdges, edge)
		}
	}
	assocEdgeGroup.statusEdges = statusEdges
	edgeMap := make(map[string]bool)
	for _, v := range statusEdges {
		nodeName := v.NodeInfo.Node
		edgeMap[nodeName] = true
	}

	if len(edgeMap) != 1 {
		return nil, fmt.Errorf("AssocEdgeGroup with mismatched edges. All edges in Group should have the same Schema Name")
	}

	for k := range edgeMap {
		assocEdgeGroup.DestNodeInfo = nodeinfo.GetNodeInfo(k)
	}

	assocEdgeGroup.AddActionEdges(edgeGroup.ActionEdges)

	assocEdgeGroup.ConstType = strcase.ToCamel(assocEdgeGroup.NodeInfo.Node + strcase.ToCamel(edgeGroup.GroupStatusName))

	return assocEdgeGroup, nil
}

func parseEdgeItem(node *input.Node, containingPackageName string, expr ast.Expr) error {
	result, parseErr := astparser.Parse(expr)
	if parseErr != nil {
		return parseErr
	}

	if result.Key == "" {
		return errors.New("invalid item. expected an item with a key")
	}
	edgeName := result.Key
	if result.Value == nil {
		return errors.New("invalid item")
	}
	value := result.Value
	if value.PkgName != "ent" {
		return errors.New("expected ent.AssociationEdgeGroup, ent.AssociationEdge etc")
	}

	switch value.IdentName {
	case "AssociationEdge":
		return parseAssociationEdgeItem(node, containingPackageName, edgeName, value)

	case "AssociationEdgeGroup":
		return parseAssociationEdgeGroupItem(node, containingPackageName, edgeName, value)

	default:
		return fmt.Errorf("unsupported edge type %s", value.PkgName)
	}
}

type parseEdgeGraph struct {
	depgraph.Depgraph
	result *astparser.Result
}

func initDepgraph(result *astparser.Result, entConfig *schemaparser.EntConfigInfo) *parseEdgeGraph {
	g := &parseEdgeGraph{result: result}
	g.AddItem("EntConfig", func(elem *astparser.Result) {
		g, err := schemaparser.GetEntConfigFromEntConfig(elem.IdentName)
		if err != nil {
			util.GoSchemaKill(err)
		}
		*entConfig = *g
	})
	return g
}

func (g *parseEdgeGraph) RunLoop() error {
	for idx := range g.result.Elems {
		elem := g.result.Elems[idx]
		if elem.IdentName == "" {
			return fmt.Errorf("invalid elem")
		}

		if err := g.CheckAndQueue(elem.IdentName, func(item interface{}) error {
			valueFunc, ok := item.(func(*astparser.Result))
			if !ok {
				return fmt.Errorf("invalid func passed")
			}
			valueFunc(elem.Value)
			return nil
		}); err != nil {
			return err
		}
	}
	g.ClearOptionalItems()
	return g.RunQueuedUpItems()
}

func getCommonEdgeInfo(edgeName string, entConfig *schemaparser.EntConfigInfo) commonEdgeInfo {
	return commonEdgeInfo{
		EdgeName:  edgeName,
		entConfig: entConfig,
		NodeInfo:  nodeinfo.GetNodeInfo(entConfig.PackageName),
	}
}

func parseInverseAssocEdge(entConfig schemaparser.EntConfigInfo, containingPackageName string, result *astparser.Result) (*input.InverseAssocEdge, error) {
	if result.GetTypeName() != "ent.InverseAssocEdge" {
		return nil, fmt.Errorf("invalid format")
	}

	var edgeName string

	if len(result.Elems) == 1 {
		if elem := result.Elems[0]; elem.IdentName == "EdgeName" {
			edgeName = elem.Value.Literal
		}
	}

	// we only support one key now so keeping it simple like this.
	if edgeName == "" {
		return nil, fmt.Errorf("no edge name provided for inverse assoc edge")
	}

	return &input.InverseAssocEdge{
		Name: edgeName,
	}, nil
}

func parseAssociationEdgeItem(node *input.Node, containingPackageName, edgeName string, result *astparser.Result) error {
	assocEdge, err := getParsedAssociationEdgeItem(containingPackageName, edgeName, result)
	if err != nil {
		return err
	}

	node.AddAssocEdge(assocEdge)
	return nil
}

func getParsedAssociationEdgeItem(containingPackageName, edgeName string, result *astparser.Result) (*input.AssocEdge, error) {
	var entConfig schemaparser.EntConfigInfo
	g := initDepgraph(result, &entConfig)

	assocEdge := &input.AssocEdge{
		Name: edgeName,
	}

	g.AddItem("Symmetric", func(elem *astparser.Result) {
		assocEdge.Symmetric = astparser.IsTrueBooleanResult(elem)
	})

	g.AddItem("Unique", func(elem *astparser.Result) {
		assocEdge.Unique = astparser.IsTrueBooleanResult(elem)
	})

	g.AddItem("EdgeActions", func(elem *astparser.Result) {
		var err error
		assocEdge.EdgeActions, err = parseEdgeActions(elem)
		if err != nil {
			util.GoSchemaKill(err)
		}
	})

	g.AddItem("InverseEdge", func(elem *astparser.Result) {
		// EntConfig is a pre-requisite so indicate as much since we don't wanna parse it twice
		var err error
		assocEdge.InverseEdge, err = parseInverseAssocEdge(entConfig, containingPackageName, elem)
		if err != nil {
			util.GoSchemaKill(err)
		}
	}, "EntConfig")

	if err := g.RunLoop(); err != nil {
		return nil, err
	}
	assocEdge.EntConfig = &entConfig

	return assocEdge, nil
}

func getDefaultTableName(packageName, groupName string) string {
	tableNameParts := []string{
		packageName,
		base.GetSnakeCaseName(groupName),
		"edges",
	}
	return base.GetNameFromParts(tableNameParts)
}

func parseAssociationEdgeGroupItem(node *input.Node, containingPackageName, groupKey string, result *astparser.Result) error {
	edgeGroup := &input.AssocEdgeGroup{
		Name: groupKey,
	}

	g := &parseEdgeGraph{result: result}

	g.AddOptionalItem("CustomTableName", func(elem *astparser.Result) {
		edgeGroup.TableName = elem.Literal
	})

	g.AddItem("EdgeGroups", func(elem *astparser.Result) {
		for _, elem := range elem.Elems {
			edgeName := elem.Key
			assocEdge, err := getParsedAssociationEdgeItem(containingPackageName, edgeName, elem.Value)
			if err != nil {
				util.GoSchemaKill(err)
			}
			edgeGroup.AddAssocEdge(assocEdge)
		}
	})

	g.AddItem("GroupStatusName", func(elem *astparser.Result) {
		edgeGroup.GroupStatusName = elem.Literal
	})

	g.AddItem("EdgeActions", func(elem *astparser.Result) {
		var err error
		edgeGroup.EdgeActions, err = parseEdgeActions(elem)
		if err != nil {
			util.GoSchemaKill(err)
		}
	})

	g.AddItem("ActionEdges", func(elem *astparser.Result) {
		edgeGroup.ActionEdges = astparser.GetStringList(elem)
	})

	if err := g.RunLoop(); err != nil {
		return err
	}
	node.AddAssocEdgeGroup(edgeGroup)
	return nil
}

func parseEdgeActions(result *astparser.Result) ([]*input.EdgeAction, error) {
	edgeActions := make([]*input.EdgeAction, len(result.Elems))
	for idx, elem := range result.Elems {
		var err error
		edgeActions[idx], err = parseEdgeAction(elem)
		if err != nil {
			return nil, err
		}
	}
	return edgeActions, nil
}

// copied from internal/action/action.go
func getActionOperationFromTypeName(typeName string) (ent.ActionOperation, error) {
	switch typeName {
	case "ent.CreateAction":
		return ent.CreateAction, nil
	case "ent.EditAction":
		return ent.EditAction, nil
	case "ent.DeleteAction":
		return ent.DeleteAction, nil
	case "ent.MutationsAction":
		return ent.MutationsAction, nil
	case "ent.AddEdgeAction":
		return ent.AddEdgeAction, nil
	case "ent.RemoveEdgeAction":
		return ent.RemoveEdgeAction, nil
	case "ent.EdgeGroupAction":
		return ent.EdgeGroupAction, nil
	}
	return 0, fmt.Errorf("invalid action type passed %s", typeName)
}

func getTypeNameActionOperationFromTypeName(op ent.ActionOperation) (string, error) {
	switch op {
	case ent.CreateAction:
		return "ent.CreateAction", nil
	case ent.EditAction:
		return "ent.EditAction", nil
	case ent.DeleteAction:
		return "ent.DeleteAction", nil
	case ent.MutationsAction:
		return "ent.MutationsAction", nil
	case ent.AddEdgeAction:
		return "ent.AddEdgeAction", nil
	case ent.RemoveEdgeAction:
		return "ent.RemoveEdgeAction", nil
	case ent.EdgeGroupAction:
		return "ent.EdgeGroupAction", nil
	}
	return "", fmt.Errorf("invalid action type passed %v", op)
}

func parseEdgeAction(elem *astparser.Result) (*input.EdgeAction, error) {
	if elem.GetTypeName() != "ent.EdgeActionConfig" {
		return nil, fmt.Errorf("invalid format")
	}
	ret := &input.EdgeAction{
		HideFromGraphQL: false,
	}

	for _, elem := range elem.Elems {
		switch elem.IdentName {
		case "Action":
			var err error
			ret.Operation, err = getActionOperationFromTypeName(elem.Value.GetTypeName())
			if err != nil {
				return nil, err
			}

		case "CustomActionName":
			ret.CustomActionName = elem.Value.Literal

		case "CustomGraphQLName":
			ret.CustomGraphQLName = elem.Value.Literal

		case "HideFromGraphQL":
			ret.HideFromGraphQL = astparser.IsTrueBooleanResult(elem.Value)
		}
	}

	return ret, nil
}

func getEdgeConstName(packageName, edgeName string) string {
	//don't end up with something like UserToUserTo
	if strings.HasPrefix(strcase.ToCamel(edgeName), strcase.ToCamel(packageName)+"To") {
		return strcase.ToCamel(edgeName) + "Edge"
	}
	// todo... need to support custom edges at some point...
	return strcase.ToCamel(packageName) + "To" + strcase.ToCamel(edgeName) + "Edge"
}
