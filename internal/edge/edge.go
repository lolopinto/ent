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
	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/depgraph"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/lolopinto/ent/internal/util"
)

type EdgeInfo struct {
	// TODO hide FieldEdges etc
	// make them accessors since we want to control mutations
	FieldEdges     []*FieldEdge
	fieldEdgeMap   map[string]*FieldEdge
	ForeignKeys    []*ForeignKeyEdge
	foreignKeyMap  map[string]*ForeignKeyEdge
	Associations   []*AssociationEdge
	assocMap       map[string]*AssociationEdge
	AssocGroups    []*AssociationEdgeGroup
	assocGroupsMap map[string]*AssociationEdgeGroup

	// don't want name overlap even when being added programmatically because we use those names in all kinds of places even graphql
	keys map[string]bool
}

func NewEdgeInfo() *EdgeInfo {
	ret := &EdgeInfo{}
	ret.fieldEdgeMap = make(map[string]*FieldEdge)
	ret.foreignKeyMap = make(map[string]*ForeignKeyEdge)
	ret.assocMap = make(map[string]*AssociationEdge)
	ret.assocGroupsMap = make(map[string]*AssociationEdgeGroup)
	ret.keys = make(map[string]bool)
	return ret
}

func (e *EdgeInfo) HasAssociationEdges() bool {
	return len(e.Associations) > 0
}

func (e *EdgeInfo) addEdge(edge Edge) {
	if e.keys[edge.GetEdgeName()] {
		panic(fmt.Errorf("tried to add a new edge named %s when name already taken", edge.GetEdgeName()))
	}
	e.keys[edge.GetEdgeName()] = true
	fieldEdge, ok := edge.(*FieldEdge)
	if ok {
		e.FieldEdges = append(e.FieldEdges, fieldEdge)
		e.fieldEdgeMap[fieldEdge.EdgeName] = fieldEdge
		return
	}
	fkeyEdge, ok := edge.(*ForeignKeyEdge)
	if ok {
		e.ForeignKeys = append(e.ForeignKeys, fkeyEdge)
		e.foreignKeyMap[fkeyEdge.EdgeName] = fkeyEdge
		return
	}
	assocEdge, ok := edge.(*AssociationEdge)
	if ok {
		e.Associations = append(e.Associations, assocEdge)
		e.assocMap[assocEdge.EdgeName] = assocEdge
	}
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
	return e.foreignKeyMap[edgeName]
}

func (e *EdgeInfo) GetAssociationEdgeByName(edgeName string) *AssociationEdge {
	return e.assocMap[edgeName]
}

func (e *EdgeInfo) GetAssociationEdgeGroupByStatusName(groupStatusName string) *AssociationEdgeGroup {
	return e.assocGroupsMap[groupStatusName]
}

func (e *EdgeInfo) AddFieldEdgeFromForeignKeyInfo(fieldName, configName string) {
	e.addFieldEdgeFromInfo(fieldName, configName, "")
}

func (e *EdgeInfo) AddFieldEdgeFromFieldEdgeInfo(fieldName, configName, inverseEdgeName string) {
	e.addFieldEdgeFromInfo(fieldName, configName, inverseEdgeName)
}

func (e *EdgeInfo) addFieldEdgeFromInfo(fieldName, configName, inverseEdgeName string) {
	r := regexp.MustCompile("([A-Za-z]+)ID")
	match := r.FindStringSubmatch(fieldName)

	if len(match) != 2 {
		// TODO make this more flexible...
		panic("expected field name to end with ID")
	}

	edge := &FieldEdge{
		FieldName: fieldName,
		// Edge name: User from UserID field
		commonEdgeInfo: getCommonEdgeInfo(
			match[1],
			schemaparser.GetEntConfigFromEntConfig(configName),
		),
		InverseEdgeName: inverseEdgeName,
	}

	e.addEdge(edge)
}

func (e *EdgeInfo) AddForeignKeyEdgeFromInverseFieldInfo(dbColName, nodeName string) {
	edge := &ForeignKeyEdge{
		QuotedDBColName: dbColName,
		commonEdgeInfo: getCommonEdgeInfo(
			inflection.Plural(nodeName),
			schemaparser.GetEntConfigFromName(nodeName),
		),
	}
	e.addEdge(edge)
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
	GetEntConfig() schemaparser.EntConfigInfo
}

// marker interface
type PluralEdge interface {
	Edge
	PluralEdge() bool
	Singular() string
}

type commonEdgeInfo struct {
	EdgeName  string
	entConfig schemaparser.EntConfigInfo
	NodeInfo  nodeinfo.NodeInfo
}

func (e *commonEdgeInfo) GetEdgeName() string {
	return e.EdgeName
}

func (e *commonEdgeInfo) GetNodeInfo() nodeinfo.NodeInfo {
	return e.NodeInfo
}

func (e *commonEdgeInfo) GetEntConfig() schemaparser.EntConfigInfo {
	return e.entConfig
}

func (e *commonEdgeInfo) CamelCaseEdgeName() string {
	return strcase.ToCamel(e.EdgeName)
}

type FieldEdge struct {
	commonEdgeInfo
	FieldName       string
	InverseEdgeName string
}

var _ Edge = &FieldEdge{}

type ForeignKeyEdge struct {
	QuotedDBColName string
	commonEdgeInfo
}

func (e *ForeignKeyEdge) PluralEdge() bool {
	return true
}

func (e *ForeignKeyEdge) Singular() string {
	return inflection.Singular(e.EdgeName)
}

func (e *ForeignKeyEdge) EdgeIdentifier() string {
	return e.Singular()
}

var _ Edge = &ForeignKeyEdge{}
var _ PluralEdge = &ForeignKeyEdge{}

type InverseAssocEdge struct {
	commonEdgeInfo
	EdgeConst string
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
	Symmetric     bool
	Unique        bool
	InverseEdge   *InverseAssocEdge
	IsInverseEdge bool
	TableName     string // TableName will be gotten from the GroupName if part of a group or derived from each edge
	// will eventually be made configurable to the user
	EdgeActions []*EdgeAction
}

// TsEdgeConst returns the Edge const as used in typescript.
// It transforms UserToFriends Edge to UserToFriends since that's 
// in an enum
// will evntually fix at edge creation
func (e *AssociationEdge) TsEdgeConst() string {
	edgeConst, err := TsEdgeConst(e.EdgeConst)
	util.Die(err)
	return edgeConst
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

func (e *AssociationEdge) AddInverseEdge(inverseEdgeInfo *EdgeInfo) {
	inverseEdge := e.InverseEdge
	if inverseEdge == nil {
		return
	}

	inverseAssocEdge := inverseEdgeInfo.GetAssociationEdgeByName(inverseEdge.EdgeName)
	if inverseAssocEdge != nil {
		panic(
			fmt.Errorf(
				"trying to add inverse assoc edge with name %s when edge already exists",
				inverseEdge.EdgeName,
			),
		)
	}

	inverseEdgeInfo.addEdge(&AssociationEdge{
		EdgeConst:      inverseEdge.EdgeConst,
		commonEdgeInfo: inverseEdge.commonEdgeInfo,
		IsInverseEdge:  true,
	})
}

var _ Edge = &AssociationEdge{}
var _ PluralEdge = &AssociationEdge{}

// EdgeAction holds as little data as possible about the edge action
// and depends on action to take that information, process it and generate the
// action specific metadata
type EdgeAction struct {
	Action            string
	CustomActionName  string
	CustomGraphQLName string
	ExposeToGraphQL   bool
}

type AssociationEdgeGroup struct {
	GroupName       string                      // this is the name of the edge which is different from the name of the status. confusing
	GroupStatusName string                      // should be something like RsvpStatus
	ConstType       string                      // and then this becomes EventRsvpStatus
	Edges           map[string]*AssociationEdge // TODO...
	EdgeActions     []*EdgeAction
	actionEdges     map[string]bool
	NodeInfo        nodeinfo.NodeInfo
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
	edgeInfo := NewEdgeInfo()

	for _, edge := range node.AssocEdges {
		edgeInfo.addEdge(assocEdgeFromInput(packageName, node, edge))
	}

	for _, edgeGroup := range node.AssocEdgeGroups {
		assocEdgeGroupFromInput(packageName, node, edgeGroup, edgeInfo)
	}
	return edgeInfo, nil
}

func assocEdgeFromInput(packageName string, node *input.Node, edge *input.AssocEdge) *AssociationEdge {
	assocEdge := &AssociationEdge{
		Symmetric: edge.Symmetric,
		Unique:    edge.Unique,
		TableName: edge.TableName,
	}

	// name wasn't specified? get default one
	if assocEdge.TableName == "" {
		tableNameParts := []string{
			packageName,
			strings.ToLower(strcase.ToSnake(edge.Name)),
			"edges",
		}
		assocEdge.TableName = getNameFromParts(tableNameParts)
	}

	if edge.EdgeActions != nil {
		assocEdge.EdgeActions = edge.EdgeActions.([]*EdgeAction)
	}

	if edge.InverseEdge != nil {
		inverseEdge := &InverseAssocEdge{}

		edgeName := edge.InverseEdge.Name
		inversePackageName := edge.SchemaName
		if inversePackageName == "" {
			inversePackageName = edge.EntConfig.PackageName
		}
		inverseEdge.EdgeConst = getEdgeConstName(inversePackageName, edgeName)

		inverseEdge.commonEdgeInfo = getCommonEdgeInfo(
			edgeName,
			// need to create a new EntConfig for the inverse edge

			// take something like folder and create Folder and FolderConfig
			// TODO: probably want to pass this down instead of magically configuring this
			schemaparser.GetEntConfigFromName(packageName),
		)
		assocEdge.InverseEdge = inverseEdge
	}

	assocEdge.EdgeConst = getEdgeConstName(packageName, edge.Name)

	// golang
	if edge.EntConfig != nil {
		assocEdge.commonEdgeInfo = getCommonEdgeInfo(edge.Name, *edge.EntConfig)
	} else { // typescript
		assocEdge.commonEdgeInfo = getCommonEdgeInfo(
			edge.Name,
			schemaparser.GetEntConfigFromName(edge.SchemaName),
		)
	}

	return assocEdge
}

func assocEdgeGroupFromInput(packageName string, node *input.Node, edgeGroup *input.AssocEdgeGroup, edgeInfo *EdgeInfo) *AssociationEdgeGroup {
	assocEdgeGroup := &AssociationEdgeGroup{
		GroupName:       edgeGroup.Name,
		GroupStatusName: edgeGroup.GroupStatusName,
		NodeInfo:        nodeinfo.GetNodeInfo(packageName),
	}

	// no overriden table name, get default one
	tableName := edgeGroup.TableName
	if tableName == "" {
		tableName = getDefaultTableName(packageName, edgeGroup.Name)
	}

	assocEdgeGroup.Edges = make(map[string]*AssociationEdge)

	if edgeGroup.EdgeActions != nil {
		assocEdgeGroup.EdgeActions = edgeGroup.EdgeActions.([]*EdgeAction)
	}

	for _, edge := range edgeGroup.AssocEdges {
		// if input edge doesn't have its own tableName, use group tableName
		if edge.TableName == "" {
			edge.TableName = tableName
		}
		assocEdge := assocEdgeFromInput(packageName, node, edge)
		assocEdgeGroup.Edges[edge.Name] = assocEdge
		// if assocEdge.InverseEdge != nil {
		// TODO should we add inverse edges to this map?
		// need to audit everything related to assoc groups anyways
		// }
		edgeInfo.addEdge(assocEdge)
	}

	assocEdgeGroup.AddActionEdges(edgeGroup.ActionEdges)

	assocEdgeGroup.ConstType = assocEdgeGroup.NodeInfo.Node + edgeGroup.GroupStatusName
	edgeInfo.addEdgeGroup(assocEdgeGroup)

	return assocEdgeGroup
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
		*entConfig = schemaparser.GetEntConfigFromEntConfig(elem.IdentName)
	})
	return g
}

func (g *parseEdgeGraph) RunLoop() {
	for idx := range g.result.Elems {
		elem := g.result.Elems[idx]
		if elem.IdentName == "" {
			panic("invalid elem")
		}

		g.CheckAndQueue(elem.IdentName, func(item interface{}) {
			valueFunc, ok := item.(func(*astparser.Result))
			if !ok {
				panic("invalid func passed")
			}
			valueFunc(elem.Value)
		})
	}
	g.ClearOptionalItems()
	g.RunQueuedUpItems()
}

func getCommonEdgeInfo(edgeName string, entConfig schemaparser.EntConfigInfo) commonEdgeInfo {
	return commonEdgeInfo{
		EdgeName:  edgeName,
		entConfig: entConfig,
		NodeInfo:  nodeinfo.GetNodeInfo(entConfig.PackageName),
	}
}

func parseInverseAssocEdge(entConfig schemaparser.EntConfigInfo, containingPackageName string, result *astparser.Result) *input.InverseAssocEdge {
	if result.GetTypeName() != "ent.InverseAssocEdge" {
		panic("invalid format")
	}

	var edgeName string

	if len(result.Elems) == 1 {
		if elem := result.Elems[0]; elem.IdentName == "EdgeName" {
			edgeName = elem.Value.Literal
		}
	}

	// we only support one key now so keeping it simple like this.
	if edgeName == "" {
		panic("no edge name provided for inverse assoc edge")
	}

	return &input.InverseAssocEdge{
		Name: edgeName,
	}
}

func parseAssociationEdgeItem(node *input.Node, containingPackageName, edgeName string, result *astparser.Result) error {
	assocEdge := getParsedAssociationEdgeItem(containingPackageName, edgeName, result)

	node.AddAssocEdge(assocEdge)
	return nil
}

func getParsedAssociationEdgeItem(containingPackageName, edgeName string, result *astparser.Result) *input.AssocEdge {
	var entConfig schemaparser.EntConfigInfo
	g := initDepgraph(result, &entConfig)

	assocEdge := &input.AssocEdge{
		Name: edgeName,
	}

	g.AddItem("Symmetric", func(elem *astparser.Result) {
		assocEdge.Symmetric = astparser.IsBooleanResult(elem)
	})

	g.AddItem("Unique", func(elem *astparser.Result) {
		assocEdge.Unique = astparser.IsBooleanResult(elem)
	})

	g.AddItem("EdgeActions", func(elem *astparser.Result) {
		assocEdge.EdgeActions = parseEdgeActions(elem)
	})

	g.AddItem("InverseEdge", func(elem *astparser.Result) {
		// EntConfig is a pre-requisite so indicate as much since we don't wanna parse it twice
		assocEdge.InverseEdge = parseInverseAssocEdge(entConfig, containingPackageName, elem)
	}, "EntConfig")

	g.RunLoop()
	assocEdge.EntConfig = &entConfig

	return assocEdge
}

func getDefaultTableName(packageName, groupName string) string {
	tableNameParts := []string{
		packageName,
		strings.ToLower(strcase.ToSnake(groupName)),
		"edges",
	}
	return getNameFromParts(tableNameParts)
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
			assocEdge := getParsedAssociationEdgeItem(containingPackageName, edgeName, elem.Value)
			edgeGroup.AddAssocEdge(assocEdge)
		}
	})

	g.AddItem("GroupStatusName", func(elem *astparser.Result) {
		edgeGroup.GroupStatusName = elem.Literal
	})

	g.AddItem("EdgeActions", func(elem *astparser.Result) {
		edgeGroup.EdgeActions = parseEdgeActions(elem)
	})

	g.AddItem("ActionEdges", func(elem *astparser.Result) {
		edgeGroup.ActionEdges = astparser.GetStringList(elem)
	})

	g.RunLoop()
	node.AddAssocEdgeGroup(edgeGroup)
	return nil
}

func parseEdgeActions(result *astparser.Result) []*EdgeAction {
	edgeActions := make([]*EdgeAction, len(result.Elems))
	for idx, elem := range result.Elems {
		edgeActions[idx] = parseEdgeAction(elem)
	}
	return edgeActions
}

func parseEdgeAction(elem *astparser.Result) *EdgeAction {
	if elem.GetTypeName() != "ent.EdgeActionConfig" {
		panic("invalid format")
	}
	ret := &EdgeAction{
		ExposeToGraphQL: true,
	}

	for _, elem := range elem.Elems {
		switch elem.IdentName {
		case "Action":
			ret.Action = elem.Value.GetTypeName()
			break

		case "CustomActionName":
			ret.CustomActionName = elem.Value.Literal
			break

		case "CustomGraphQLName":
			ret.CustomGraphQLName = elem.Value.Literal
			break

		case "HideFromGraphQL":
			ret.ExposeToGraphQL = !astparser.IsBooleanResult(elem.Value)
		}
	}

	return ret
}

func getEdgeConstName(packageName, edgeName string) string {
	// todo... need to support custom edges at some point...
	return strcase.ToCamel(packageName) + "To" + strcase.ToCamel(edgeName) + "Edge"
}

// duplicated from db_schema.go
func getNameFromParts(nameParts []string) string {
	return strings.Join(nameParts, "_")
}
