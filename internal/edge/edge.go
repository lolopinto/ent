package edge

import (
	"fmt"
	"go/ast"
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/depgraph"
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
}

func NewEdgeInfo() *EdgeInfo {
	ret := &EdgeInfo{}
	ret.fieldEdgeMap = make(map[string]*FieldEdge)
	ret.foreignKeyMap = make(map[string]*ForeignKeyEdge)
	ret.assocMap = make(map[string]*AssociationEdge)
	ret.assocGroupsMap = make(map[string]*AssociationEdgeGroup)
	return ret
}

func (e *EdgeInfo) HasAssociationEdges() bool {
	return len(e.Associations) > 0
}

func (e *EdgeInfo) addEdge(edge Edge) {
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

type Edge interface {
	GetEdgeName() string
	GetNodeInfo() codegen.NodeInfo
	GetEntConfig() codegen.EntConfigInfo
}

// marker interface
type PluralEdge interface {
	Edge
	PluralEdge() bool
}

type commonEdgeInfo struct {
	EdgeName  string
	entConfig codegen.EntConfigInfo
	NodeInfo  codegen.NodeInfo
}

func (e *commonEdgeInfo) GetEdgeName() string {
	return e.EdgeName
}

func (e *commonEdgeInfo) GetNodeInfo() codegen.NodeInfo {
	return e.NodeInfo
}

func (e *commonEdgeInfo) GetEntConfig() codegen.EntConfigInfo {
	return e.entConfig
}

type FieldEdge struct {
	commonEdgeInfo
	FieldName       string
	InverseEdgeName string
}

var _ Edge = &FieldEdge{}

// TODO we need a FieldName in ent.ForeignKeyEdge and a sensible way to pass the field
// down. Right now, it's depending on the fact that it aligns with the "package name"
type ForeignKeyEdge struct {
	commonEdgeInfo
}

func (e *ForeignKeyEdge) PluralEdge() bool {
	return true
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
	InverseEdge   *InverseAssocEdge
	IsInverseEdge bool
	TableName     string // TableName will be gotten from the GroupName if part of a group or derived from each edge
	// will eventually be made configurable to the user
}

func (e *AssociationEdge) PluralEdge() bool {
	return true
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

type AssociationEdgeGroup struct {
	GroupName       string                      // this is the name of the edge which is different from the name of the status. confusing
	GroupStatusName string                      // should be something like RsvpStatus
	ConstType       string                      // and then this becomes EventRsvpStatus
	Edges           map[string]*AssociationEdge // TODO...
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
	// TODO need NodeData.Node
	return "Event" + edgeName
}

// http://goast.yuroyoro.net/ is really helpful to see the tree
func ParseEdgesFunc(packageName string, fn *ast.FuncDecl) *EdgeInfo {
	ret := NewEdgeInfo()

	elts := astparser.GetEltsInFunc(fn)

	for _, expr := range elts {
		keyValueExpr := astparser.GetExprToKeyValueExpr(expr)
		err := parseEdgeItem(ret, packageName, keyValueExpr)

		if err != nil {
			panic(err)
		}
	}

	return ret
}

func parseEdgeItem(edgeInfo *EdgeInfo, containingPackageName string, keyValueExpr *ast.KeyValueExpr) error {
	edgeName := astparser.GetUnderylingStringFromLiteralExpr(keyValueExpr.Key)
	//fmt.Println("EdgeName: ", edgeName)

	// if it's ent.FieldEdge or &ent.FieldEdge, we should allow it
	// need to allow tests for this
	// ent.FieldEdge is CompositLit
	// &ent.FieldEdge is CompositLit in an unary expresion
	value := astparser.GetExprToCompositeLitAllowUnaryExpr(keyValueExpr.Value)
	edgeType := astparser.GetTypeNameFromExpr(value.Type)

	switch edgeType {
	case "ent.FieldEdge":
		return parseFieldEdgeItem(edgeInfo, value, edgeName)

	case "ent.ForeignKeyEdge":
		return parseForeignKeyEdgeItem(edgeInfo, value, edgeName)

	case "ent.AssociationEdge":
		return parseAssociationEdgeItem(edgeInfo, containingPackageName, edgeName, value)

	case "ent.AssociationEdgeGroup":
		return parseAssociationEdgeGroupItem(edgeInfo, containingPackageName, edgeName, value)

	default:
		panic("unsupported edge type")

	}
}

type parseEdgeItemFunc func(expr ast.Expr, keyValueExprValue ast.Expr)

type parseEdgeGraph struct {
	depgraph.Depgraph
	lit *ast.CompositeLit
}

func initDepgraph(lit *ast.CompositeLit, entConfig *codegen.EntConfigInfo) *parseEdgeGraph {
	//map[string]parseEdgeItemFunc {
	g := &parseEdgeGraph{lit: lit}
	g.AddItem("EntConfig", func(expr ast.Expr, keyValueExprValue ast.Expr) {
		*entConfig = codegen.GetEntConfigFromExpr(keyValueExprValue)
	})
	return g
}

func (g *parseEdgeGraph) RunLoop() {
	for _, expr := range g.lit.Elts {
		keyValueExpr := astparser.GetExprToKeyValueExpr(expr)
		ident := astparser.GetExprToIdent(keyValueExpr.Key)

		g.CheckAndQueue(ident.Name, func(item interface{}) {
			// can't cast to parseEdgeItemFunc :(
			valueFunc, ok := item.(func(ast.Expr, ast.Expr))
			if !ok {
				panic("invalid func passed")
			}
			valueFunc(expr, keyValueExpr.Value)
		})
	}
	g.RunQueuedUpItems()
}

func parseFieldEdgeItem(edgeInfo *EdgeInfo, lit *ast.CompositeLit, edgeName string) error {
	var fieldName string
	var inverseEdgeName string
	var entConfig codegen.EntConfigInfo
	g := initDepgraph(lit, &entConfig)

	g.AddItem("FieldName", func(expr ast.Expr, keyValueExprValue ast.Expr) {
		fieldName = astparser.GetUnderylingStringFromLiteralExpr(keyValueExprValue)
	})

	g.AddItem("InverseEdge", func(expr ast.Expr, keyValueExprValue ast.Expr) {
		inverseEdgeName = astparser.GetUnderylingStringFromLiteralExpr(keyValueExprValue)
	})

	g.RunLoop()

	edgeInfo.addEdge(&FieldEdge{
		commonEdgeInfo:  getCommonEdgeInfo(edgeName, entConfig),
		FieldName:       fieldName,
		InverseEdgeName: inverseEdgeName,
	})
	return nil
}

func getCommonEdgeInfo(edgeName string, entConfig codegen.EntConfigInfo) commonEdgeInfo {
	return commonEdgeInfo{
		EdgeName:  edgeName,
		entConfig: entConfig,
		NodeInfo:  codegen.GetNodeInfo(entConfig.PackageName),
	}
}

func parseForeignKeyEdgeItem(edgeInfo *EdgeInfo, lit *ast.CompositeLit, edgeName string) error {
	entConfig := parseEntConfigOnlyFromEdgeItemHelper(lit)

	edgeInfo.addEdge(&ForeignKeyEdge{
		commonEdgeInfo: getCommonEdgeInfo(edgeName, entConfig),
	})
	return nil
}

func parseInverseAssocEdge(entConfig codegen.EntConfigInfo, containingPackageName string, keyValueExprValue ast.Expr) *InverseAssocEdge {
	compositLit := astparser.GetComposeLitInUnaryExpr(keyValueExprValue)
	if astparser.GetTypeNameFromExpr(compositLit.Type) != "ent.InverseAssocEdge" {
		panic("invalid inverse assoc edge")
	}

	ret := &InverseAssocEdge{}

	var edgeName string
	for _, expr := range compositLit.Elts {
		kve := astparser.GetExprToKeyValueExpr(expr)

		key := astparser.GetExprToIdent(kve.Key)
		if key.Name != "EdgeName" {
			// we only support one key now so keeping it simple like this.
			// this is a perfetct usecase for run loop and depgraph eventually
			panic("invalid key in inverse assco edge")
		}
		edgeName = astparser.GetUnderylingStringFromLiteralExpr(kve.Value)
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

		codegen.GetEntConfigFromName(containingPackageName),
	)
	return ret
}

func parseAssociationEdgeItem(edgeInfo *EdgeInfo, containingPackageName, edgeName string, lit *ast.CompositeLit) error {
	assocEdge := getParsedAssociationEdgeItem(containingPackageName, edgeName, lit)

	tableNameParts := []string{
		containingPackageName,
		strings.ToLower(strcase.ToSnake(edgeName)),
		"edges",
	}
	assocEdge.TableName = getNameFromParts(tableNameParts)
	edgeInfo.addEdge(assocEdge)
	return nil
}

func getParsedAssociationEdgeItem(containingPackageName, edgeName string, lit *ast.CompositeLit) *AssociationEdge {
	var entConfig codegen.EntConfigInfo
	g := initDepgraph(lit, &entConfig)

	assocEdge := &AssociationEdge{}

	g.AddItem("Symmetric", func(expr ast.Expr, keyValueExprValue ast.Expr) {
		assocEdge.Symmetric = astparser.GetBooleanValueFromExpr(keyValueExprValue)
	})

	g.AddItem("InverseEdge", func(expr ast.Expr, keyValueExprValue ast.Expr) {
		// EntConfig is a pre-requisite so indicate as much since we don't wanna parse it twice

		assocEdge.InverseEdge = parseInverseAssocEdge(entConfig, containingPackageName, keyValueExprValue)
	},
		"EntConfig")

	g.RunLoop()

	assocEdge.EdgeConst = getEdgeCostName(containingPackageName, edgeName)

	assocEdge.commonEdgeInfo = getCommonEdgeInfo(edgeName, entConfig)
	return assocEdge
}

func parseAssociationEdgeGroupItem(edgeInfo *EdgeInfo, containingPackageName, groupKey string, lit *ast.CompositeLit) error {
	edgeGroup := &AssociationEdgeGroup{
		GroupName: groupKey,
	}
	edgeGroup.Edges = make(map[string]*AssociationEdge)

	g := &parseEdgeGraph{lit: lit}

	tableNameParts := []string{
		containingPackageName,
		strings.ToLower(strcase.ToSnake(groupKey)),
		"edges",
	}
	tableName := getNameFromParts(tableNameParts)

	g.AddItem("EdgeGroups", func(expr ast.Expr, keyValueExprValue ast.Expr) {
		elts := astparser.GetExprToCompositeLit(keyValueExprValue).Elts

		for _, expr2 := range elts {
			kve := astparser.GetExprToKeyValueExpr(expr2)
			edgeName := astparser.GetUnderylingStringFromLiteralExpr(kve.Key)

			lit2 := astparser.GetExprToCompositeLitAllowUnaryExpr(kve.Value)
			assocEdge := getParsedAssociationEdgeItem(containingPackageName, edgeName, lit2)

			// all the edges in a group have the same table name
			assocEdge.TableName = tableName
			edgeInfo.addEdge(assocEdge)

			edgeGroup.Edges[edgeName] = assocEdge
		}
	})

	g.AddItem("GroupStatusName", func(expr ast.Expr, keyValueExprValue ast.Expr) {
		edgeGroup.GroupStatusName = astparser.GetUnderylingStringFromLiteralExpr(keyValueExprValue)
		edgeGroup.ConstType = codegen.GetNodeInfo(containingPackageName).Node + edgeGroup.GroupStatusName
	})

	g.RunLoop()
	edgeInfo.addEdgeGroup(edgeGroup)
	return nil
}

func getEdgeCostName(packageName, edgeName string) string {
	// todo... need to support custom edges at some point...
	return strcase.ToCamel(packageName) + "To" + edgeName + "Edge"
}

func parseEntConfigOnlyFromEdgeItemHelper(lit *ast.CompositeLit) codegen.EntConfigInfo {
	var entConfig codegen.EntConfigInfo

	g := initDepgraph(lit, &entConfig)
	g.RunLoop()
	return entConfig
}

// duplicated from db_schema.go
func getNameFromParts(nameParts []string) string {
	return strings.Join(nameParts, "_")
}
