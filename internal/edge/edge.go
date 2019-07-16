package edge

import (
	"go/ast"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/codegen"
)

type EdgeInfo struct {
	FieldEdges   []*FieldEdge
	ForeignKeys  []*ForeignKeyEdge
	Associations []*AssociationEdge
}

func newEdgeInfo() *EdgeInfo {
	ret := &EdgeInfo{}
	ret.FieldEdges = make([]*FieldEdge, 0)
	ret.ForeignKeys = make([]*ForeignKeyEdge, 0)
	ret.Associations = make([]*AssociationEdge, 0)
	return ret
}

func (e *EdgeInfo) HasAssociationEdges() bool {
	return len(e.Associations) > 0
}

func (e *EdgeInfo) addEdge(edge Edge) {
	fieldEdge, ok := edge.(*FieldEdge)
	if ok {
		e.FieldEdges = append(e.FieldEdges, fieldEdge)
		return
	}
	fkeyEdge, ok := edge.(*ForeignKeyEdge)
	if ok {
		e.ForeignKeys = append(e.ForeignKeys, fkeyEdge)
		return
	}
	assocEdge, ok := edge.(*AssociationEdge)
	if ok {
		e.Associations = append(e.Associations, assocEdge)
	}
}

type Edge interface {
	GetEdgeName() string
	GetNodeInfo() codegen.NodeInfo
	GetEntConfig() codegen.EntConfigInfo
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

var _ Edge = &ForeignKeyEdge{}

type AssociationEdge struct {
	commonEdgeInfo
	EdgeConst string
}

var _ Edge = &AssociationEdge{}

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

func parseFieldEdgeItem(lit *ast.CompositeLit, edgeName string) *FieldEdge {
	done := make(chan bool)
	var fieldName string
	var entConfig codegen.EntConfigInfo

	closure := func(identName string, keyValueExprValue ast.Expr, expr ast.Expr) {
		switch identName {
		case "FieldName":
			// TODO: this validates it's a string literal.
			// does not format it.
			// TODO make this
			_, ok := expr.(*ast.Ident)
			if ok {
				panic("invalid FieldName value. Should not use an expression. Should be a string literal")
			}
			fieldName = astparser.GetUnderylingStringFromLiteralExpr(keyValueExprValue)
			//fmt.Println("Field name:", fieldName)

		case "EntConfig":
			entConfig = codegen.GetEntConfigFromExpr(keyValueExprValue)

		default:
			panic("invalid identifier for field config")
		}
	}

	go parseEdgeItemHelper(lit, closure, done)
	<-done

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
	entConfig := parseEntConfigOnlyFromEdgeItemHelper(lit)

	// todo...
	// need to support custom edge...
	edgeConst := strcase.ToCamel(containingPackageName) + "To" + edgeName + "Edge"

	return &AssociationEdge{
		commonEdgeInfo: getCommonEdgeInfo(edgeName, entConfig),
		EdgeConst:      edgeConst,
	}
}

func parseEntConfigOnlyFromEdgeItemHelper(lit *ast.CompositeLit) codegen.EntConfigInfo {
	done := make(chan bool)
	var entConfig codegen.EntConfigInfo

	closure := func(identName string, keyValueExprValue ast.Expr, _ ast.Expr) {
		switch identName {
		case "EntConfig":
			entConfig = codegen.GetEntConfigFromExpr(keyValueExprValue)

		default:
			panic("invalid identifier for field config")
		}
	}

	go parseEdgeItemHelper(lit, closure, done)
	<-done
	return entConfig
}

func parseEdgeItemHelper(lit *ast.CompositeLit, valueFunc func(identName string, keyValueExprValue ast.Expr, expr ast.Expr), done chan<- bool) {
	for _, expr := range lit.Elts {
		keyValueExpr := astparser.GetExprToKeyValueExpr(expr)
		ident := astparser.GetExprToIdent(keyValueExpr.Key)

		valueFunc(ident.Name, keyValueExpr.Value, expr)
	}
	done <- true
}
