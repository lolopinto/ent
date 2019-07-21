package codegen

import (
	"fmt"
	"go/ast"
	"regexp"

	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/util"
)

type EntConfigInfo struct {
	PackageName string
	ConfigName  string
}

func GetEntConfigFromExpr(expr ast.Expr) EntConfigInfo {
	lit := astparser.GetExprToCompositeLit(expr)
	// inlining getExprToSelectorExpr...
	typ, ok := lit.Type.(*ast.SelectorExpr)
	// This is when the EntConfig is of the form user.UserConfig
	// don't actually support this case right now since all the configs are local
	if ok {
		entIdent := astparser.GetExprToIdent(typ.X)
		return EntConfigInfo{
			PackageName: entIdent.Name,
			ConfigName:  typ.Sel.Name,
		}
	}

	// inlining getExprToIdent...
	// TODO figure out what we wanna do here
	// This supports when the EntConfig is local to the module
	entIdent, ok := lit.Type.(*ast.Ident)
	if ok {
		configName, err := getNodeNameFromEntConfig(entIdent.Name)
		util.Die(err)
		return EntConfigInfo{
			// return a fake packageName e.g. user, contact to be used
			// TODO fix places using this to return Node instead of fake packageName
			PackageName: configName,
			ConfigName:  entIdent.Name,
		}
	}
	panic("Invalid value for Expr. Could not get EntConfig from Expr")
}

func getNodeNameFromEntConfig(configName string) (string, error) {
	r := regexp.MustCompile("([A-Za-z]+)Config")
	match := r.FindStringSubmatch(configName)
	if len(match) == 2 {
		return match[1], nil
	}
	return "", fmt.Errorf("couldn't match EntConfig name")
}
