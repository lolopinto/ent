package astparser

import (
	"fmt"
	"go/ast"
	"strconv"

	"go/token"
)

func GetLastReturnStmtExpr(fn *ast.FuncDecl) ast.Expr {
	// fn.Body is an instance of *ast.BlockStmt
	lastStmt := GetLastStatement(fn.Body.List)

	//fmt.Println(length)
	// to handle the case where we have variables used to return something
	// not really a valid case but handle it anyways
	returnStmt, ok := lastStmt.(*ast.ReturnStmt)
	if !ok {
		panic("last statement in function was not a return statement. ")
	}

	//fmt.Println(len(returnStmt.Results))

	if len(returnStmt.Results) != 1 {
		panic("invalid number or format of return statement")
	}

	return GetLastExpr(returnStmt.Results)
}

func GetCompositeStmtsInFunc(fn *ast.FuncDecl) *ast.CompositeLit {
	lastExpr := GetLastReturnStmtExpr(fn)
	compositeListStmt := GetExprToCompositeLit(lastExpr)
	return compositeListStmt
}

// given a function node, it gets the list of elts in the func
// works for both edges in GetEdges() func and list of privacy rules in Rules
func GetEltsInFunc(fn *ast.FuncDecl) []ast.Expr {
	return GetCompositeStmtsInFunc(fn).Elts
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
		panic("invalid value for Expr. Expr was not of type CompositeLit")
	}
	return value
}

func GetExprToBasicLit(expr ast.Expr) *ast.BasicLit {
	value, ok := expr.(*ast.BasicLit)
	if !ok {
		panic("invalid value for Expr. Expr was not of type BasicLit")
	}
	return value
}

func GetExprToSelectorExpr(expr ast.Expr) *ast.SelectorExpr {
	value, ok := expr.(*ast.SelectorExpr)
	if !ok {
		panic("invalid value for Expr. Expr was not of type SelectorExpr")
	}
	return value
}

func GetExprToKeyValueExpr(expr ast.Expr) *ast.KeyValueExpr {
	value, ok := expr.(*ast.KeyValueExpr)
	if !ok {
		panic("invalid value for Expr. Expr was not of type KeyValueExpr")
	}
	return value
}

func GetExprToIdent(expr ast.Expr) *ast.Ident {
	value, ok := expr.(*ast.Ident)
	if !ok {
		panic("invalid value for Expr. Expr was not of type Ident")
	}
	return value
}

func GetExprToUnaryExpr(expr ast.Expr) *ast.UnaryExpr {
	value, ok := expr.(*ast.UnaryExpr)
	if !ok {
		panic("invalid value for Expr. Expr was not of type UnaryExpr")
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
	typ := GetExprToSelectorExpr(expr)
	typIdent := GetExprToIdent(typ.X)

	// todo this can probably be an ident.
	// handle that if and when we get there...
	return typIdent.Name + "." + typ.Sel.Name
}

// Takes an Expr and converts it to the underlying string without quotes
// For example: in the GetEdges method below,
// return map[string]interface{}{
// 	"User": ent.FieldEdge{
// 		FieldName: "UserID",
// 		EntConfig: UserConfig{},
// 	},
// }
// Calling this with the "User" Expr returns User and calling it with
// the "UserID" Expr returns UserID
func GetUnderylingStringFromLiteralExpr(expr ast.Expr) string {
	key, ok := expr.(*ast.BasicLit)
	if !ok || key.Kind != token.STRING {
		panic("invalid string literal in basic lit")
	}
	str, err := strconv.Unquote(key.Value)
	if err != nil {
		panic(fmt.Sprintf("%s is formatted weirdly as a string literal err %s", key.Value, err))
	}
	return str
}

func GetBooleanValueFromExpr(expr ast.Expr) bool {
	ident := GetExprToIdent(expr)
	return ident.Name == "true"
}
