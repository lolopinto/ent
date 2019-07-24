package edge

import (
	"fmt"
	"go/ast"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/codegen"
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

type AssociationEdge struct {
	commonEdgeInfo
	EdgeConst   string
	Symmetric   bool
	InverseEdge bool
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
	typ := astparser.GetExprToSelectorExpr(value.Type)
	// ignore typ.X because for now it should always be models.FieldEdge or ent.FieldEdge...

	edgeType := typ.Sel.Name

	switch edgeType {
	case "FieldEdge":
		return parseFieldEdgeItem(value, edgeName)

	case "ForeignKeyEdge":
		return parseForeignKeyEdgeItem(value, edgeName)

	case "AssociationEdge":
		return parseAssociationEdgeItem(containingPackageName, edgeName, value)

	default:
		panic("unsupported edge type")

	}
}

type parseEdgeItemFunc func(expr ast.Expr, keyValueExprValue ast.Expr)

func initEdgeItemFunc(entConfig *codegen.EntConfigInfo) map[string]parseEdgeItemFunc {
	funcMap := make(map[string]parseEdgeItemFunc)

	funcMap["EntConfig"] = func(expr ast.Expr, keyValueExprValue ast.Expr) {
		*entConfig = codegen.GetEntConfigFromExpr(keyValueExprValue)
	}
	return funcMap
}

func parseFieldEdgeItem(lit *ast.CompositeLit, edgeName string) *FieldEdge {
	var fieldName string
	var entConfig codegen.EntConfigInfo
	funcMap := initEdgeItemFunc(&entConfig)

	funcMap["FieldName"] = func(expr ast.Expr, keyValueExprValue ast.Expr) {
		// TODO: this validates it's a string literal.
		// does not format it.
		// TODO make this
		_, ok := expr.(*ast.Ident)
		if ok {
			panic("invalid FieldName value. Should not use an expression. Should be a string literal")
		}
		fieldName = astparser.GetUnderylingStringFromLiteralExpr(keyValueExprValue)
	}

	parseEdgeItems(funcMap, lit)

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

func parseAssociationEdgeItem(containingPackageName, edgeName string, lit *ast.CompositeLit) *AssociationEdge {
	var entConfig codegen.EntConfigInfo
	funcMap := initEdgeItemFunc(&entConfig)

	ret := &AssociationEdge{}

	funcMap["Symmetric"] = func(expr ast.Expr, keyValueExprValue ast.Expr) {
		ret.Symmetric = astparser.GetBooleanValueFromExpr(keyValueExprValue)
	}

	funcMap["InverseEdge"] = func(expr ast.Expr, keyValueExprValue ast.Expr) {
		ret.InverseEdge = astparser.GetBooleanValueFromExpr(keyValueExprValue)
	}

	parseEdgeItems(funcMap, lit)

	// todo... need to support custom edge...
	ret.EdgeConst = strcase.ToCamel(containingPackageName) + "To" + edgeName + "Edge"

	ret.commonEdgeInfo = getCommonEdgeInfo(edgeName, entConfig)

	return ret
}

func parseEntConfigOnlyFromEdgeItemHelper(lit *ast.CompositeLit) codegen.EntConfigInfo {
	var entConfig codegen.EntConfigInfo

	funcMap := initEdgeItemFunc(&entConfig)
	parseEdgeItems(funcMap, lit)
	return entConfig
}

func parseEdgeItems(funcMap map[string]parseEdgeItemFunc, lit *ast.CompositeLit) {
	for _, expr := range lit.Elts {
		keyValueExpr := astparser.GetExprToKeyValueExpr(expr)
		ident := astparser.GetExprToIdent(keyValueExpr.Key)

		valueFunc, ok := funcMap[ident.Name]
		if !ok {
			panic(fmt.Errorf("invalid identifier %s for config", ident.Name))
		}
		valueFunc(expr, keyValueExpr.Value)
	}
}
