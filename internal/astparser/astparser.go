package astparser

import (
	"fmt"
	"go/ast"
	"strconv"

	"go/token"

	"github.com/lolopinto/ent/internal/util"
)

func GetLastReturnStmtExpr(fn *ast.FuncDecl) ast.Expr {
	// fn.Body is an instance of *ast.BlockStmt
	lastStmt := GetLastStatement(fn.Body.List)

	// to handle the case where we have variables used to return something
	// not really a valid case but handle it anyways
	returnStmt, ok := lastStmt.(*ast.ReturnStmt)
	if !ok {
		util.GoSchemaKill("last statement in function was not a return statement. ")
	}

	if len(returnStmt.Results) != 1 {
		util.GoSchemaKill("invalid number or format of return statement")
	}

	return GetLastExpr(returnStmt.Results)
}

func GetCompositeStmtInFunc(fn *ast.FuncDecl) *ast.CompositeLit {
	lastExpr := GetLastReturnStmtExpr(fn)
	compositeListStmt := GetExprToCompositeLit(lastExpr)
	return compositeListStmt
}

// given a function node, it gets the list of elts in the func
// works for both edges in GetEdges() func and list of privacy rules in Rules
func GetEltsInFunc(fn *ast.FuncDecl) []ast.Expr {
	return GetCompositeStmtInFunc(fn).Elts
}

func GetLastStatement(stmts []ast.Stmt) ast.Stmt {
	length := len(stmts)
	lastStmt := stmts[length-1]
	return lastStmt
}

func GetLastExpr(exprs []ast.Expr) ast.Expr {
	length := len(exprs)
	lastExpr := exprs[length-1]
	return lastExpr
}

func GetExprToCompositeLit(expr ast.Expr) *ast.CompositeLit {
	value, ok := expr.(*ast.CompositeLit)
	if !ok {
		util.GoSchemaKill("invalid value for Expr. Expr was not of type CompositeLit")
	}
	return value
}

func GetExprToBasicLit(expr ast.Expr) *ast.BasicLit {
	value, ok := expr.(*ast.BasicLit)
	if !ok {
		util.GoSchemaKill("invalid value for Expr. Expr was not of type BasicLit")
	}
	return value
}

func GetExprToSelectorExpr(expr ast.Expr) *ast.SelectorExpr {
	value, ok := expr.(*ast.SelectorExpr)
	if !ok {
		util.GoSchemaKill("invalid value for Expr. Expr was not of type SelectorExpr")
	}
	return value
}

func GetExprToKeyValueExpr(expr ast.Expr) *ast.KeyValueExpr {
	value, ok := expr.(*ast.KeyValueExpr)
	if !ok {
		util.GoSchemaKill("invalid value for Expr. Expr was not of type KeyValueExpr")
	}
	return value
}

func GetExprToIdent(expr ast.Expr) *ast.Ident {
	value, ok := expr.(*ast.Ident)
	if !ok {
		util.GoSchemaKill("invalid value for Expr. Expr was not of type Ident")
	}
	return value
}

func GetExprToUnaryExpr(expr ast.Expr) *ast.UnaryExpr {
	value, ok := expr.(*ast.UnaryExpr)
	if !ok {
		util.GoSchemaKill("invalid value for Expr. Expr was not of type UnaryExpr")
	}
	return value
}

func GetComposeLitInUnaryExpr(expr ast.Expr) *ast.CompositeLit {
	uExpr := GetExprToUnaryExpr(expr)
	return GetExprToCompositeLit(uExpr.X)
}

func GetExprToCompositeLitAllowUnaryExpr(expr ast.Expr) *ast.CompositeLit {
	unaryExpr, ok := expr.(*ast.UnaryExpr)
	if ok {
		return GetComposeLitInUnaryExpr(unaryExpr)
	}
	return GetExprToCompositeLit(expr)
}

// GetTypeNameFromExpr takes an ast Expr and returns the underlying type
// Given the following Expr:
// (*ast.SelectorExpr)(0xc000256440)({
//	X: (*ast.Ident)(0xc000256400)(ent),
//	Sel: (*ast.Ident)(0xc000256420)(ActionConfig)
//  }),
// function returns ent.ActionConfig
func GetTypeNameFromExpr(expr ast.Expr) string {
	// handle ent.NodeType and ent.EdgeType
	typ, ok := expr.(*ast.SelectorExpr)
	if ok {
		typIdent := GetExprToIdent(typ.X)
		return typIdent.Name + "." + typ.Sel.Name
	}

	// handle local constants
	ident := GetExprToIdent(expr)
	return ident.Name
}

// Takes an Expr and converts it to the underlying string without quotes
// For example: in the GetEdges method below,
// return ent.EdgeMap{
// 	"User": ent.AssociationEdgeGroup{
//    GroupStatusName: "Rsvp",
// ...
// 	},
// }
// Calling this with the "User" Expr returns `User` and calling it with
// the "Rsvp" Expr returns `Rsvp`
func GetUnderylingStringFromLiteralExpr(expr ast.Expr) string {
	key, ok := expr.(*ast.BasicLit)
	if !ok || key.Kind != token.STRING {
		util.GoSchemaKill("invalid string literal in basic lit")
	}
	str, err := strconv.Unquote(key.Value)
	if err != nil {
		util.GoSchemaKill(fmt.Sprintf("%s is formatted weirdly as a string literal err %s", key.Value, err))
	}
	return str
}

func GetBooleanValueFromExpr(expr ast.Expr) bool {
	ident := GetExprToIdent(expr)
	return ident.Name == "true"
}

func GetStringListFromExpr(expr ast.Expr) []string {
	var list []string
	compositLit := GetExprToCompositeLit(expr)
	for _, elt := range compositLit.Elts {
		list = append(list, GetUnderylingStringFromLiteralExpr(elt))
	}
	return list
}
