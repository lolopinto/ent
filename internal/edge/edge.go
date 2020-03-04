package edge

import (
	"errors"
	"fmt"
	"go/ast"
	"regexp"
	"strconv"
	"strings"

	"github.com/davecgh/go-spew/spew"
	"github.com/iancoleman/strcase"
	"github.com/jinzhu/inflection"
	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/depgraph"
	"github.com/lolopinto/ent/internal/schemaparser"
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

func (e *EdgeInfo) AddFieldEdgeFromFieldInfo(fieldName, configName string) {
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

func (e *AssociationEdge) PluralEdge() bool {
	return true
}

func (e *AssociationEdge) Singular() string {
	return inflection.Singular(e.EdgeName)
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

// http://goast.yuroyoro.net/ is really helpful to see the tree
func ParseEdgesFunc(packageName string, fn *ast.FuncDecl) *EdgeInfo {
	ret := NewEdgeInfo()

	elts := astparser.GetEltsInFunc(fn)

	for _, expr := range elts {
		// TODO change API for err

		//		keyValueExpr := astparser.GetExprToKeyValueExpr(expr)
		err := parseEdgeItem(ret, packageName, expr)

		if err != nil {
			panic(err)
		}
	}

	return ret
}

func parseEdgeItem(edgeInfo *EdgeInfo, containingPackageName string, expr ast.Expr) error {
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
	case "FieldEdge":
		return parseFieldEdgeItem(edgeInfo, value, edgeName)

	case "AssociationEdge":
		return parseAssociationEdgeItem(edgeInfo, containingPackageName, edgeName, value)

	case "AssociationEdgeGroup":
		return parseAssociationEdgeGroupItem(edgeInfo, containingPackageName, edgeName, value)

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
			// can't cast to parseEdgeItemFunc :(
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

func parseFieldEdgeItem(edgeInfo *EdgeInfo, result *astparser.Result, edgeName string) error {
	var fieldName string
	var inverseEdgeName string
	var entConfig schemaparser.EntConfigInfo
	g := initDepgraph(result, &entConfig)

	g.AddItem("FieldName", func(elem *astparser.Result) {
		fieldName = elem.Literal
	})

	g.AddItem("InverseEdge", func(elem *astparser.Result) {
		inverseEdgeName = elem.Literal
	})

	g.RunLoop()

	edgeInfo.addEdge(&FieldEdge{
		commonEdgeInfo:  getCommonEdgeInfo(edgeName, entConfig),
		FieldName:       fieldName,
		InverseEdgeName: inverseEdgeName,
	})
	return nil
}

func getCommonEdgeInfo(edgeName string, entConfig schemaparser.EntConfigInfo) commonEdgeInfo {
	return commonEdgeInfo{
		EdgeName:  edgeName,
		entConfig: entConfig,
		NodeInfo:  nodeinfo.GetNodeInfo(entConfig.PackageName),
	}
}

func parseInverseAssocEdge(entConfig schemaparser.EntConfigInfo, containingPackageName string, result *astparser.Result) *InverseAssocEdge {
	if result.GetTypeName() != "ent.InverseAssocEdge" {
		panic("invalid format")
	}

	ret := &InverseAssocEdge{}
	var edgeName string

	for _, elem := range result.Elems {
		switch elem.IdentName {
		case "EdgeName":
			edgeName = elem.Value.Literal
			break

		default:
			// we only support one key now so keeping it simple like this.
			// this is a perfetct usecase for run loop and depgraph eventually
			panic(fmt.Errorf("invalid identName %s in inverse assoc edge", elem.IdentName))
		}
	}

	if edgeName == "" {
		panic("no edge name provided for inverse assoc edge")
	}

	// add inverse const for this edge
	ret.EdgeConst = getEdgeCostName(entConfig.PackageName, edgeName)

	ret.commonEdgeInfo = getCommonEdgeInfo(
		edgeName,
		// need to create a new EntConfig for the inverse edge

		// take something like folder and create Folder and FolderConfig
		// TODO: probably want to pass this down instead of magically configuring this

		schemaparser.GetEntConfigFromName(containingPackageName),
	)
	return ret
}

func parseAssociationEdgeItem(edgeInfo *EdgeInfo, containingPackageName, edgeName string, result *astparser.Result) error {
	assocEdge := getParsedAssociationEdgeItem(containingPackageName, edgeName, result)

	tableNameParts := []string{
		containingPackageName,
		strings.ToLower(strcase.ToSnake(edgeName)),
		"edges",
	}
	assocEdge.TableName = getNameFromParts(tableNameParts)
	edgeInfo.addEdge(assocEdge)
	return nil
}

func getParsedAssociationEdgeItem(containingPackageName, edgeName string, result *astparser.Result) *AssociationEdge {
	var entConfig schemaparser.EntConfigInfo
	g := initDepgraph(result, &entConfig)

	assocEdge := &AssociationEdge{}

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
		spew.Dump("inverseEdge", elem)
		assocEdge.InverseEdge = parseInverseAssocEdge(entConfig, containingPackageName, elem)
	}, "EntConfig")

	g.RunLoop()

	assocEdge.EdgeConst = getEdgeCostName(containingPackageName, edgeName)

	assocEdge.commonEdgeInfo = getCommonEdgeInfo(edgeName, entConfig)
	return assocEdge
}

func parseAssociationEdgeGroupItem(edgeInfo *EdgeInfo, containingPackageName, groupKey string, result *astparser.Result) error {
	edgeGroup := &AssociationEdgeGroup{
		GroupName: groupKey,
		NodeInfo:  nodeinfo.GetNodeInfo(containingPackageName),
	}
	edgeGroup.Edges = make(map[string]*AssociationEdge)

	g := &parseEdgeGraph{result: result}

	tableNameParts := []string{
		containingPackageName,
		strings.ToLower(strcase.ToSnake(groupKey)),
		"edges",
	}
	tableName := getNameFromParts(tableNameParts)

	g.AddOptionalItem("CustomTableName", func(elem *astparser.Result) {
		tableName = elem.Literal
	})

	g.AddItem("EdgeGroups", func(elem *astparser.Result) {
		for _, elem := range elem.Elems {
			edgeName := elem.Key
			assocEdge := getParsedAssociationEdgeItem(containingPackageName, edgeName, elem.Value)
			assocEdge.TableName = tableName
			edgeInfo.addEdge(assocEdge)

			edgeGroup.Edges[edgeName] = assocEdge
		}
		// parse any custom table names before parsing the edge groups
	}, "CustomTableName")

	g.AddItem("GroupStatusName", func(elem *astparser.Result) {
		edgeGroup.GroupStatusName = elem.Literal
		edgeGroup.ConstType = edgeGroup.NodeInfo.Node + edgeGroup.GroupStatusName
	})

	g.AddItem("EdgeActions", func(elem *astparser.Result) {
		edgeGroup.EdgeActions = parseEdgeActions(elem)
	})

	g.AddItem("ActionEdges", func(elem *astparser.Result) {
		edgeGroup.AddActionEdges(astparser.GetStringList(elem))
	})

	g.RunLoop()
	edgeInfo.addEdgeGroup(edgeGroup)
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

func getEdgeCostName(packageName, edgeName string) string {
	// todo... need to support custom edges at some point...
	return strcase.ToCamel(packageName) + "To" + edgeName + "Edge"
}

// duplicated from db_schema.go
func getNameFromParts(nameParts []string) string {
	return strings.Join(nameParts, "_")
}
