package edge

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/jinzhu/inflection"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/enum"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/tsimport"
)

type EdgeInfo struct {
	// Note: look at CompareEdgeInfo in compare_edge as this changes

	// TODO hide FieldEdges etc
	// make them accessors since we want to control mutations
	FieldEdges   []*FieldEdge
	fieldEdgeMap map[string]*FieldEdge

	// new concepts: IndexedEdgeQueries
	// EdgeQueries that will be in _query_base.tmpl file

	// note: look at CompareEdgeInfo in compare_edge.go as this changes
	// indexedEdgeQueriesMap has both foreign key and index edges so only comparing
	// that. not comparing destinationEdgesMap as that only includes foreignKey edges
	// if this changes, logic there should change
	IndexedEdgeQueries    []IndexedConnectionEdge
	indexedEdgeQueriesMap map[string]IndexedConnectionEdge

	// DestinationEdges. edges that can be gotten from this node
	// foreign key edges + polymorphic indexed fields...
	// this doesn't include Assoc edges which are also connection edges...
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
		conflict, ok := edge.(EdgeWithNameConflict)
		if ok {
			err := conflict.ErrorMessage(e)
			if err != nil {
				return err
			}
		}
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

func (e *EdgeInfo) AddEdgeFromInverseFieldEdge(cfg codegenapi.Config, sourceSchemaName, destinationPackageName string, edge *input.InverseFieldEdge, patternName string) (*AssociationEdge, error) {
	var fns []func(*opts)
	// force polymorphic
	if patternName != "" {
		fns = append(fns, ForceEdgePolymorphic())
	}
	assocEge, err := AssocEdgeFromInput(cfg, destinationPackageName, &input.AssocEdge{
		Name:            edge.Name,
		TableName:       edge.TableName,
		EdgeConstName:   edge.EdgeConstName,
		HideFromGraphQL: edge.HideFromGraphQL,
		SchemaName:      sourceSchemaName,
	},
		fns...)

	if err != nil {
		return nil, err
	}
	if err := e.addEdge(assocEge); err != nil {
		return nil, err
	}
	return assocEge, err
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
	// DestinationEdges aren't returned here because there
	// should be a field edge already created them for which is
	// the accessor we need
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

func (e *EdgeInfo) AddFieldEdgeFromForeignKeyInfo(cfg codegenapi.Config, fieldName, nodeName string, nullable bool, fieldType enttype.Type, validSchema func(str string) bool,
) error {
	return e.AddFieldEdgeFromFieldEdgeInfo(cfg,
		fieldName,
		&base.FieldEdgeInfo{
			Schema: nodeName,
		},
		nullable,
		fieldType,
		validSchema)
}

func GetFieldEdge(cfg codegenapi.Config,
	fieldName string,
	fieldEdgeInfo *base.FieldEdgeInfo,
	nullable bool,
	fieldType enttype.Type,
) (*FieldEdge, error) {
	// TODO pass fieldType so we can check list or not...
	validSuffixes := map[string]string{
		"id":  "_id",
		"ID":  "ID",
		"IDs": "IDs",
		"ids": "_ids",
		"Ids": "Ids",
	}
	// well this is dumb
	// not an id field, do nothing
	// TODO we need a test for this
	// TODO #674
	foundSuffix := ""
	for suffix := range validSuffixes {
		if strings.HasSuffix(fieldName, suffix) {
			foundSuffix = suffix
			break
		}
	}
	if foundSuffix == "" {
		return nil, nil
	}
	trim := strings.TrimSuffix(fieldName, validSuffixes[foundSuffix])
	if trim == "" {
		trim = fieldName
	}

	// pluralize if list
	if enttype.IsListType(fieldType) {
		trim = inflection.Plural(trim)
		if fieldEdgeInfo.Polymorphic != nil {
			return nil, fmt.Errorf("field %s polymorphic list types not currently supported", fieldName)
		}
	}

	var config *EntConfigInfo
	if fieldEdgeInfo.Polymorphic == nil {
		config = GetEntConfigFromName(fieldEdgeInfo.Schema)
	}

	// Edge name: User from UserID field
	edgeInfo := getCommonEdgeInfo(
		cfg,
		trim,
		config,
	)

	return &FieldEdge{
		FieldName:      fieldName,
		TSFieldName:    strcase.ToLowerCamel(fieldName),
		commonEdgeInfo: edgeInfo,
		InverseEdge:    fieldEdgeInfo.InverseEdge,
		Nullable:       nullable,
		Polymorphic:    fieldEdgeInfo.Polymorphic,
		fieldType:      fieldType,
	}, nil
}

func (e *EdgeInfo) AddFieldEdgeFromFieldEdgeInfo(
	cfg codegenapi.Config,
	fieldName string,
	fieldEdgeInfo *base.FieldEdgeInfo,
	nullable bool,
	fieldType enttype.Type,
	validSchema func(str string) bool,
) error {
	edge, err := GetFieldEdge(cfg, fieldName, fieldEdgeInfo, nullable, fieldType)
	if err != nil || edge == nil {
		return err
	}
	if edge.Polymorphic == nil &&
		!validSchema(edge.commonEdgeInfo.NodeInfo.Node) {
		return fmt.Errorf("invalid schema %s", edge.commonEdgeInfo.NodeInfo.Node)
	}
	return e.addEdge(edge)
}

func GetForeignKeyEdge(cfg codegenapi.Config, dbColName, edgeName, nodeName, sourceNodeName string) *ForeignKeyEdge {
	return &ForeignKeyEdge{
		SourceNodeName: sourceNodeName,
		destinationEdge: destinationEdge{
			commonEdgeInfo: getCommonEdgeInfo(
				cfg,
				edgeName,
				GetEntConfigFromName(nodeName),
			),
			quotedDbColName: dbColName,
		},
	}
}

func (e *EdgeInfo) AddEdgeFromForeignKeyIndex(cfg codegenapi.Config, dbColName, edgeName, nodeName string) error {
	edge := GetForeignKeyEdge(cfg, dbColName, edgeName, nodeName, e.SourceNodeName)
	e.indexedEdgeQueriesMap[edgeName] = edge
	e.destinationEdgesMap[edgeName] = edge
	e.IndexedEdgeQueries = append(e.IndexedEdgeQueries, edge)
	e.DestinationEdges = append(e.DestinationEdges, edge)
	return e.addEdge(edge)
}

func (e *EdgeInfo) AddIndexedEdgeFromSource(cfg codegenapi.Config, tsFieldName, quotedDBColName, nodeName string, polymorphic *base.PolymorphicOptions) error {
	tsEdgeName := strcase.ToCamel(strings.TrimSuffix(tsFieldName, "ID"))
	edge := &IndexedEdge{
		tsEdgeName: tsEdgeName,
		destinationEdge: destinationEdge{
			commonEdgeInfo: getCommonEdgeInfo(
				cfg,
				// TODO this changes a bunch of things

				// it changes a bunch of things
				// so we need edge name to be the same but loader factory and query to change

				// TODO test multiple polymorphic fields on the same schema
				inflection.Plural(tsFieldName),
				// inflection.Plural(nodeName),
				GetEntConfigFromName(nodeName),
			),
			quotedDbColName: quotedDBColName,
			unique:          polymorphic.Unique,
		},
	}
	if polymorphic.HideFromInverseGraphQL {
		edge._HideFromGraphQL = true
	}
	edgeName := edge.GetEdgeName()
	// TODO this is being called twice  with different edge infos...
	e.indexedEdgeQueriesMap[edgeName] = edge
	e.IndexedEdgeQueries = append(e.IndexedEdgeQueries, edge)
	return e.addEdge(edge)
}

func GetIndexedEdge(cfg codegenapi.Config, tsFieldName, quotedDBColName, nodeName string, polymorphic *base.PolymorphicOptions, foreignNode string) *IndexedEdge {
	tsEdgeName := strcase.ToCamel(strings.TrimSuffix(tsFieldName, "ID"))
	edgeName := inflection.Plural(nodeName)
	if polymorphic != nil && polymorphic.Name != "" {
		edgeName = polymorphic.Name
	}
	edge := &IndexedEdge{
		tsEdgeName: tsEdgeName,
		destinationEdge: destinationEdge{
			commonEdgeInfo: getCommonEdgeInfo(
				cfg,
				edgeName,
				GetEntConfigFromName(nodeName),
			),
			quotedDbColName: quotedDBColName,
		},
		foreignNode: foreignNode,
	}
	if polymorphic != nil {
		edge._HideFromGraphQL = polymorphic.HideFromInverseGraphQL
		edge.unique = polymorphic.Unique
	}
	return edge
}

func (e *EdgeInfo) AddDestinationEdgeFromPolymorphicOptions(cfg codegenapi.Config, tsFieldName, quotedDBColName, nodeName string, polymorphic *base.PolymorphicOptions, foreignNode string) error {
	edge := GetIndexedEdge(cfg, tsFieldName, quotedDBColName, nodeName, polymorphic, foreignNode)
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
	// NOTE: update compareEdge if anything changes here
	GetEdgeName() string
	GetNodeInfo() nodeinfo.NodeInfo
	GetEntConfig() *EntConfigInfo
	GraphQLEdgeName() string
	CamelCaseEdgeName() string
	HideFromGraphQL() bool
	PolymorphicEdge() bool
	GetTSGraphQLTypeImports() []*tsimport.ImportPath
}

type EdgeWithNameConflict interface {
	Edge
	ErrorMessage(e *EdgeInfo) error
}

type ConnectionEdge interface {
	// NOTE: update compareConnectionEdge if anything changes here
	Edge
	// For custom edges...
	GetSourceNodeName() string
	GetGraphQLEdgePrefix() string
	GetGraphQLConnectionName() string
	GetGraphQLConnectionType() string
	TsEdgeQueryEdgeName() string
	TsEdgeQueryName() string
	UniqueEdge() bool
}

type IndexedConnectionEdge interface {
	// NOTE: update compareIndexedConnectionEdge if anything changes here
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
	// note that if anything is changed here, need to update commonEdgeInfoEqual() in compare_edge.go
	EdgeName         string
	graphQLEdgeName  string
	entConfig        *EntConfigInfo
	NodeInfo         nodeinfo.NodeInfo
	_HideFromGraphQL bool
}

func (e *commonEdgeInfo) GetEdgeName() string {
	return e.EdgeName
}

func (e *commonEdgeInfo) GetNodeInfo() nodeinfo.NodeInfo {
	return e.NodeInfo
}

func (e *commonEdgeInfo) GetEntConfig() *EntConfigInfo {
	return e.entConfig
}

func (e *commonEdgeInfo) CamelCaseEdgeName() string {
	return strcase.ToCamel(e.EdgeName)
}

func (e *commonEdgeInfo) GraphQLEdgeName() string {
	return e.graphQLEdgeName
}

func (e *commonEdgeInfo) HideFromGraphQL() bool {
	return e._HideFromGraphQL
}

type FieldEdge struct {
	commonEdgeInfo
	FieldName   string
	TSFieldName string
	//	InverseEdgeName string
	Nullable bool

	fieldType enttype.Type

	InverseEdge *input.InverseFieldEdge
	Polymorphic *base.PolymorphicOptions
}

func (edge *FieldEdge) PolymorphicEdge() bool {
	// TODO should this be true when polymorphic != nil
	return false
}

func (edge *FieldEdge) GetTSGraphQLTypeImports() []*tsimport.ImportPath {
	if edge.IsList() {
		if edge.Nullable {
			return []*tsimport.ImportPath{
				tsimport.NewGQLClassImportPath("GraphQLList"),
				tsimport.NewGQLClassImportPath("GraphQLNonNull"),
				tsimport.NewLocalGraphQLEntImportPath(edge.NodeInfo.Node),
			}
		}
		return []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLClassImportPath("GraphQLList"),
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewLocalGraphQLEntImportPath(edge.NodeInfo.Node),
		}
	}
	// TODO required and nullable eventually (options for the edges that is)
	if edge.Polymorphic != nil {
		return []*tsimport.ImportPath{
			tsimport.NewEntGraphQLImportPath("GraphQLNodeInterface"),
		}
	}
	return []*tsimport.ImportPath{
		tsimport.NewLocalGraphQLEntImportPath(edge.NodeInfo.Node),
	}
}

func (edge *FieldEdge) IsList() bool {
	return enttype.IsListType(edge.fieldType)
}

func (edge *FieldEdge) NonPolymorphicList() bool {
	return edge.Polymorphic == nil && !edge.IsList()
}

var _ Edge = &FieldEdge{}

type ForeignKeyEdge struct {
	// note that if anything is changed here, need to update foreignKeyEdgeEqual() in compare_edge.go
	SourceNodeName string
	destinationEdge
}

func (e *ForeignKeyEdge) PluralEdge() bool {
	return true
}

func (e *ForeignKeyEdge) PolymorphicEdge() bool {
	return false
}

func (e *ForeignKeyEdge) GetTSGraphQLTypeImports() []*tsimport.ImportPath {
	// return a connection
	return []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewLocalEntConnectionImportPath(e.GetGraphQLConnectionName()),
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

func (e *ForeignKeyEdge) GetGraphQLConnectionType() string {
	return fmt.Sprintf("%sTo%sConnectionType", e.SourceNodeName, strcase.ToCamel(e.EdgeName))
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

func (e *ForeignKeyEdge) ErrorMessage(edgeInfo *EdgeInfo) error {
	edgeName := e.GetEdgeName()
	// edge name is plural of destination node
	if edgeName != inflection.Plural(e.NodeInfo.Node) {
		return nil
	}
	fkey := edgeInfo.GetForeignKeyEdgeByName(e.GetEdgeName())
	if fkey == nil {
		return nil
	}
	return fmt.Errorf("To have multiple ForeignKey Edges pointing to %s, set the name on `foreignKey`", e.NodeInfo.Node)
}

var _ Edge = &ForeignKeyEdge{}
var _ PluralEdge = &ForeignKeyEdge{}
var _ ConnectionEdge = &ForeignKeyEdge{}
var _ IndexedConnectionEdge = &ForeignKeyEdge{}

type DestinationEdgeInterface interface {
	UniqueEdge() bool
	QuotedDBColName() string
	GetEntConfig() *EntConfigInfo
	GetNodeInfo() nodeinfo.NodeInfo
}

type destinationEdge struct {
	// note that if anything is changed here, need to update destinationEdgeEqual() in compare_edge.go
	commonEdgeInfo
	quotedDbColName string
	unique          bool
}

var _ DestinationEdgeInterface = &destinationEdge{}

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
	// note that if anything is changed here, need to update indexedEdgeEqual() in compare_edge.go
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

func (e *IndexedEdge) GetTSGraphQLTypeImports() []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewLocalEntConnectionImportPath(e.GetGraphQLConnectionName()),
	}
}

func (e *IndexedEdge) TsEdgeQueryName() string {
	return fmt.Sprintf("%sTo%sQuery", e.tsEdgeName, strcase.ToCamel(inflection.Plural(e.NodeInfo.Node)))
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
		return ""
		//		panic("cannot call GetGraphQLConnectionName when foreignNode is empty")
	}
	return fmt.Sprintf("%sTo%sConnection", e.foreignNode, strcase.ToCamel(inflection.Plural(e.NodeInfo.Node)))
}

func (e *IndexedEdge) GetGraphQLConnectionType() string {
	if e.foreignNode == "" {
		return ""
		//		panic("cannot call GetGraphQLConnectionType when foreignNode is empty")
	}
	return fmt.Sprintf("%sTo%sConnectionType", e.foreignNode, strcase.ToCamel(inflection.Plural(e.NodeInfo.Node)))
}

func (e *IndexedEdge) TsEdgeQueryEdgeName() string {
	// For IndexedEdge, we only use this with GraphQLConnectionType and the EdgeType is "Data"
	return "Data"
}

func (e *IndexedEdge) GetGraphQLEdgePrefix() string {
	if e.foreignNode == "" {
		return ""
		//		panic("cannot call GetGraphQLEdgePrefix when foreignNode is empty")
	}
	return fmt.Sprintf("%sTo%s", e.foreignNode, strcase.ToCamel(e.EdgeName))
}

func (e *IndexedEdge) tsEdgeConst() string {
	return fmt.Sprintf("%sTo%s", e.tsEdgeName, strcase.ToCamel(inflection.Plural(e.NodeInfo.Node)))
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
	// note that if anything is changed here, need to update inverseAssocEdgeEqual() in compare_edge.go
	commonEdgeInfo
	EdgeConst   string
	polymorphic bool
}

func (e *InverseAssocEdge) GetTSGraphQLTypeImports() []*tsimport.ImportPath {
	panic("TODO. no GraphQLImports for InverseAssocEdge")
}

func (e *InverseAssocEdge) PolymorphicEdge() bool {
	return e.polymorphic
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
	// note that if anything is changed here, need to update assocEdgeEqual() in compare_edge.go
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
	polymorphic          bool
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

func (e *AssociationEdge) AssocEdgeBaseImport(cfg codegenapi.Config) *tsimport.ImportPath {
	if e.patternEdgeConst != "" {
		return tsimport.NewLocalEntImportPath(fmt.Sprintf("%sEdge", e.patternEdgeConst))
	}
	return cfg.GetAssocEdgePath().GetImportPath()
}

func (e *AssociationEdge) PolymorphicEdge() bool {
	// not fully supported but implicitly supoorted via Patterns
	// TODO not ideal because it blocks Nodes called Object
	return e.polymorphic || e.NodeInfo.Node == "Object" || e.NodeInfo.Node == "Ent"
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

func (e *AssociationEdge) GetGraphQLConnectionType() string {
	if e.overridenGraphQLName != "" {
		return e.overridenGraphQLName + "Type"
	}
	// we need a unique graphql name
	// there's nothing stopping multiple edges of different types having the same connection and then there'll be a conflict here
	// so we use the UserToFoo names to have UserToFriendsConnection and UserToFriendsEdge names
	return fmt.Sprintf("%sConnectionType", e.TsEdgeConst)
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

func (edge *AssociationEdge) GetTSGraphQLTypeImports() []*tsimport.ImportPath {
	if edge.Unique {
		return []*tsimport.ImportPath{
			tsimport.NewLocalGraphQLEntImportPath(edge.NodeInfo.Node),
		}
	}
	// return a connection
	return []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewLocalEntConnectionImportPath(edge.GetGraphQLConnectionName()),
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
		TableName:      e.TableName,
		// if inverse is polymorphic, flag this as polymorphic too
		// polymorphic: inverseEdge.polymorphic,
	})
}

func (e *AssociationEdge) CloneWithCommonInfo(cfg codegenapi.Config, nodeName string) (*AssociationEdge, error) {
	config := GetEntConfigFromName(nodeName)

	return &AssociationEdge{
		EdgeConst:   e.EdgeConst,
		TsEdgeConst: e.TsEdgeConst,
		Symmetric:   e.Symmetric,
		Unique:      e.Unique,
		InverseEdge: e.InverseEdge,
		TableName:   e.TableName,
		EdgeActions: e.EdgeActions,
		commonEdgeInfo: getCommonEdgeInfo(
			cfg,
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
	ViewerBased       bool
	NullStateFn       string
	NullStates        []string
	actionEdges       map[string]bool
	statusEdges       []*AssociationEdge
	NodeInfo          nodeinfo.NodeInfo
}

func (edgeGroup *AssociationEdgeGroup) IsNullable() bool {
	return !edgeGroup.ViewerBased && len(edgeGroup.NullStates) == 0
}

func (edgeGroup *AssociationEdgeGroup) DefaultNullState() string {
	if len(edgeGroup.NullStates) == 0 {
		return "null"
	}
	return fmt.Sprintf("%s.%s", edgeGroup.ConstType, enum.GetTSEnumNameForVal(edgeGroup.NullStates[0]))
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
	values = append(values, edgeGroup.NullStates...)
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

func (edgeGroup *AssociationEdgeGroup) GetStatusMethodReturn() string {
	ret := edgeGroup.ConstType
	if edgeGroup.IsNullable() {
		ret = fmt.Sprintf("%s | null", ret)
	}
	return ret
}

func (edgeGroup *AssociationEdgeGroup) GetStatusMethod() string {
	if edgeGroup.ViewerBased {
		return fmt.Sprintf("viewer%s", strcase.ToCamel(edgeGroup.GroupStatusName))
	}
	return strcase.ToLowerCamel(edgeGroup.GroupStatusName) + "For"
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

func EdgeInfoFromInput(cfg codegenapi.Config, packageName string, node *input.Node) (*EdgeInfo, error) {
	edgeInfo := NewEdgeInfo(packageName)

	for _, edge := range node.AssocEdges {
		e, err := AssocEdgeFromInput(cfg, packageName, edge)
		if err != nil {
			return nil, err
		}
		edgeInfo.addEdge(e)
	}

	for _, edgeGroup := range node.AssocEdgeGroups {
		group, err := AssocEdgeGroupFromInput(cfg, packageName, node, edgeGroup, edgeInfo)
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
type opts struct {
	forcePolymorphic bool
}

func ForceEdgePolymorphic() func(*opts) {
	return func(o *opts) {
		o.forcePolymorphic = true
	}
}

func AssocEdgeFromInput(cfg codegenapi.Config, packageName string, edge *input.AssocEdge, fns ...func(*opts)) (*AssociationEdge, error) {
	assocEdge := &AssociationEdge{
		Symmetric:          edge.Symmetric,
		Unique:             edge.Unique,
		TableName:          edge.TableName,
		PatternName:        edge.PatternName,
		givenEdgeConstName: edge.EdgeConstName,
	}
	o := &opts{}
	for _, f := range fns {
		f(o)
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
			cfg,
			edgeName,
			// need to create a new EntConfig for the inverse edge

			// take something like folder and create Folder and FolderConfig
			// TODO: probably want to pass this down instead of magically configuring this
			GetEntConfigFromName(configPkgName),
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

	if o.forcePolymorphic {
		assocEdge.commonEdgeInfo = getCommonEdgeInfo(
			cfg,
			edge.Name,
			GetEntConfigFromName("ent"),
		)
	} else {
		assocEdge.commonEdgeInfo = getCommonEdgeInfo(
			cfg,
			edge.Name,
			GetEntConfigFromName(edge.SchemaName),
		)
	}
	assocEdge._HideFromGraphQL = edge.HideFromGraphQL

	return assocEdge, nil
}

func AssocEdgeGroupFromInput(cfg codegenapi.Config, packageName string, node *input.Node, edgeGroup *input.AssocEdgeGroup, edgeInfo *EdgeInfo) (*AssociationEdgeGroup, error) {
	assocEdgeGroup := &AssociationEdgeGroup{
		GroupName:         edgeGroup.Name,
		GroupStatusName:   edgeGroup.GroupStatusName,
		TSGroupStatusName: strcase.ToLowerCamel(edgeGroup.GroupStatusName),
		NodeInfo:          nodeinfo.GetNodeInfo(packageName),
		StatusEnums:       edgeGroup.StatusEnums,
		NullStateFn:       edgeGroup.NullStateFn,
		NullStates:        edgeGroup.NullStates,
		ViewerBased:       edgeGroup.ViewerBased,
	}

	if assocEdgeGroup.ViewerBased && len(assocEdgeGroup.NullStates) == 0 {
		return nil, fmt.Errorf("ViewerBased edge group must have NullStates")
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
	if assocEdgeGroup.NullStateFn != "" && len(assocEdgeGroup.NullStates) == 0 {
		return nil, fmt.Errorf("cannot have null state fn with no null states")
	}

	var statusEdges []*AssociationEdge

	for _, edge := range edgeGroup.AssocEdges {
		// if input edge doesn't have its own tableName, use group tableName
		if edge.TableName == "" {
			edge.TableName = tableName
		}
		assocEdge, err := AssocEdgeFromInput(cfg, packageName, edge)
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

func GetCommonEdgeInfoForTest(edgeName string,
	entConfig *EntConfigInfo,
) commonEdgeInfo {
	return getCommonEdgeInfo(
		&codegenapi.DummyConfig{}, edgeName, entConfig,
	)
}

func getCommonEdgeInfo(
	cfg codegenapi.Config,
	edgeName string,
	entConfig *EntConfigInfo,
) commonEdgeInfo {

	ret := commonEdgeInfo{
		EdgeName:        edgeName,
		entConfig:       entConfig,
		graphQLEdgeName: codegenapi.GraphQLName(cfg, edgeName),
	}
	if entConfig != nil {
		ret.NodeInfo = nodeinfo.GetNodeInfo(entConfig.PackageName)
	}
	return ret
}

func getDefaultTableName(packageName, groupName string) string {
	tableNameParts := []string{
		packageName,
		base.GetSnakeCaseName(groupName),
		"edges",
	}
	return base.GetNameFromParts(tableNameParts)
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

func getEdgeConstName(packageName, edgeName string) string {
	//don't end up with something like UserToUserTo
	if strings.HasPrefix(strcase.ToCamel(edgeName), strcase.ToCamel(packageName)+"To") {
		return strcase.ToCamel(edgeName) + "Edge"
	}
	// todo... need to support custom edges at some point...
	return strcase.ToCamel(packageName) + "To" + strcase.ToCamel(edgeName) + "Edge"
}
