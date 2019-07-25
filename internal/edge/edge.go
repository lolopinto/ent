package edge

import (
	"go/ast"

	"github.com/davecgh/go-spew/spew"
	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/depgraph"
)

type EdgeInfo struct {
	// TODO hide FieldEdges etc
	// make them accessors since we want to control mutations
	FieldEdges    []*FieldEdge
	fieldEdgeMap  map[string]*FieldEdge
	ForeignKeys   []*ForeignKeyEdge
	foreignKeyMap map[string]*ForeignKeyEdge
	Associations  []*AssociationEdge
	assocMap      map[string]*AssociationEdge
}

func newEdgeInfo() *EdgeInfo {
	ret := &EdgeInfo{}
	ret.fieldEdgeMap = make(map[string]*FieldEdge)
	ret.foreignKeyMap = make(map[string]*ForeignKeyEdge)
	ret.assocMap = make(map[string]*AssociationEdge)
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

func (e *EdgeInfo) GetFieldEdgeByName(edgeName string) *FieldEdge {
	return e.fieldEdgeMap[edgeName]
}

func (e *EdgeInfo) GetForeignKeyEdgeByName(edgeName string) *ForeignKeyEdge {
	return e.foreignKeyMap[edgeName]
}

func (e *EdgeInfo) GetAssociationEdgeByName(edgeName string) *AssociationEdge {
	return e.assocMap[edgeName]
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
	FieldName string
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
	EdgeConst   string
	Symmetric   bool
	InverseEdge *InverseAssocEdge
}

func (e *AssociationEdge) PluralEdge() bool {
	return true
}

var _ Edge = &AssociationEdge{}
var _ PluralEdge = &AssociationEdge{}

// http://goast.yuroyoro.net/ is really helpful to see the tree
func ParseEdgesFunc(packageName string, fn *ast.FuncDecl) *EdgeInfo {
	ret := newEdgeInfo()

	elts := astparser.GetEltsInFunc(fn)

	// get the edges in the function
	for _, expr := range elts {
		keyValueExpr := astparser.GetExprToKeyValueExpr(expr)
		//fmt.Println(keyValueExpr)
		// get the edge as needed
		edgeItem := parseEdgeItem(packageName, keyValueExpr)

		ret.addEdge(edgeItem)
	}

	return ret
}

func parseEdgeItem(containingPackageName string, keyValueExpr *ast.KeyValueExpr) Edge {
	edgeName := astparser.GetUnderylingStringFromLiteralExpr(keyValueExpr.Key)
	//fmt.Println("EdgeName: ", edgeName)

	value := astparser.GetExprToCompositeLit(keyValueExpr.Value)
	edgeType := astparser.GetTypeNameFromExpr(value.Type)

	switch edgeType {
	case "ent.FieldEdge":
		return parseFieldEdgeItem(value, edgeName)

	case "ent.ForeignKeyEdge":
		return parseForeignKeyEdgeItem(value, edgeName)

	case "ent.AssociationEdge":
		return parseAssociationEdgeItem(containingPackageName, edgeName, value)

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

func parseFieldEdgeItem(lit *ast.CompositeLit, edgeName string) *FieldEdge {
	var fieldName string
	var entConfig codegen.EntConfigInfo
	g := initDepgraph(lit, &entConfig)

	g.AddItem("FieldName", func(expr ast.Expr, keyValueExprValue ast.Expr) {
		// TODO: this validates it's a string literal.
		// does not format it.
		// TODO make this
		_, ok := expr.(*ast.Ident)
		if ok {
			panic("invalid FieldName value. Should not use an expression. Should be a string literal")
		}
		fieldName = astparser.GetUnderylingStringFromLiteralExpr(keyValueExprValue)
	})

	g.RunLoop()

	return &FieldEdge{
		commonEdgeInfo: getCommonEdgeInfo(edgeName, entConfig),
		FieldName:      fieldName,
	}
}

func getCommonEdgeInfo(edgeName string, entConfig codegen.EntConfigInfo) commonEdgeInfo {
	return commonEdgeInfo{
		EdgeName:  edgeName,
		entConfig: entConfig,
		NodeInfo:  codegen.GetNodeInfo(entConfig.PackageName),
	}
}

func parseForeignKeyEdgeItem(lit *ast.CompositeLit, edgeName string) *ForeignKeyEdge {
	entConfig := parseEntConfigOnlyFromEdgeItemHelper(lit)

	return &ForeignKeyEdge{
		commonEdgeInfo: getCommonEdgeInfo(edgeName, entConfig),
	}
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

func parseAssociationEdgeItem(containingPackageName, edgeName string, lit *ast.CompositeLit) *AssociationEdge {
	var entConfig codegen.EntConfigInfo
	g := initDepgraph(lit, &entConfig)

	ret := &AssociationEdge{}

	g.AddItem("Symmetric", func(expr ast.Expr, keyValueExprValue ast.Expr) {
		ret.Symmetric = astparser.GetBooleanValueFromExpr(keyValueExprValue)
	})

	g.AddItem("InverseEdge", func(expr ast.Expr, keyValueExprValue ast.Expr) {
		//
		// EntConfig is a pre-requisite so indicate as much since we don't wanna parse it twice

		ret.InverseEdge = parseInverseAssocEdge(entConfig, containingPackageName, keyValueExprValue)
	},
		"EntConfig")

	g.RunLoop()

	ret.EdgeConst = getEdgeCostName(containingPackageName, edgeName)

	ret.commonEdgeInfo = getCommonEdgeInfo(edgeName, entConfig)

	spew.Dump(ret)
	return ret
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
