package field

import (
	"errors"
	"fmt"
	"go/ast"
	"sync"

	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/syncerr"
	"golang.org/x/tools/go/packages"
)

func ParseFieldsFunc(pkg *packages.Package, fn *ast.FuncDecl) (*FieldInfo, error) {
	elts := astparser.GetEltsInFunc(fn)

	fieldInfo := newFieldInfo()

	var wg sync.WaitGroup
	wg.Add(len(elts))

	var sErr syncerr.Error

	// TODO this should be a singleton or passed in here so that we cache as needed across object types
	explorer := newPackageExplorer()

	for idx := range elts {
		go func(idx int) {
			defer wg.Done()
			expr := elts[idx]
			keyValueExpr := astparser.GetExprToKeyValueExpr(expr)

			f := newField(
				astparser.GetUnderylingStringFromLiteralExpr(keyValueExpr.Key),
			)

			callExpr, err := getCallExprFromKV(keyValueExpr.Value)
			if err != nil {
				sErr.Append(err)
				return
			}

			chanErr := parseField(f, pkg, callExpr, explorer)
			err = <-chanErr
			if err != nil {
				sErr.Append(err)
			}

			fieldInfo.addField(f)
		}(idx)
	}
	wg.Wait()
	return fieldInfo, sErr.Err()
}

type argFormat string

const (
	// field.Int
	functionFormat argFormat = "func"

	// &field.StringType{}
	typFormat argFormat = "type"
)

type argInfo struct {
	pkgName   string
	identName string
	fmt       argFormat
	expr      ast.Expr
}

func parseArg(arg ast.Expr) *argInfo {
	argCallExpr, ok := arg.(*ast.CallExpr)
	unaryExpr, ok2 := arg.(*ast.UnaryExpr)
	compLit, ok3 := arg.(*ast.CompositeLit)
	var sel *ast.SelectorExpr
	ret := &argInfo{expr: arg}
	if ok {
		// field.Int
		ret.fmt = functionFormat

		if ident, ok := argCallExpr.Fun.(*ast.Ident); ok {
			ret.identName = ident.Name
			return ret
		}
		sel = astparser.GetExprToSelectorExpr(argCallExpr.Fun)

	}

	if ok2 {
		compLit := astparser.GetExprToCompositeLit(unaryExpr.X)
		ident, ok := compLit.Type.(*ast.Ident)
		// copied from below. need to super nest this and handle these things
		//	compLitToIdent
		if ok {
			return &argInfo{
				pkgName:   "",
				identName: ident.Name,
				fmt:       typFormat,
			}
		}
		sel = astparser.GetExprToSelectorExpr(compLit.Type)

		// &field.StringType{]}
		ret.fmt = typFormat
	}

	if ok3 {
		// local type localStringType{}
		return &argInfo{
			pkgName:   "",
			identName: astparser.GetExprToIdent(compLit.Type).Name,
			fmt:       typFormat,
		}
	}

	if sel == nil {
		return nil
	}

	// hmm combine with astparser.GetTypeNameFromExpr?
	return parseTypeInfo(sel, ret)
}

func parseField(f *Field, pkg *packages.Package, callExpr *ast.CallExpr, explorer *packageExplorer) chan error {
	chanErr := make(chan error)
	go func() {
		var err error
		for idx, arg := range callExpr.Args {
			info := parseArg(arg)
			if info == nil {
				err = errors.New("invalid arg")
				break
			}

			if idx == 0 {
				// this is the real thing we're waiting for
				errChan := modifyFieldForDataType(f, pkg, explorer, info)
				err = <-errChan
				// don't continue parsing other things here
				if err != nil {
					break
				}
			} else {
				argCallExpr, ok := arg.(*ast.CallExpr)
				if !ok {
					err = errors.New("invalid arg")
					break
				}
				typeName := info.pkgName + "." + info.identName

				fn, ok := m[typeName]
				if ok {
					fn(f, argCallExpr.Args)
				} else {
					err = fmt.Errorf("unsupported configuration for field %s", typeName)
					break
				}
			}
		}
		// got here, we're done. succeeds if no error
		chanErr <- err
	}()
	return chanErr
}

// todo this needs to also work for local packages
// combine with astparser.GetFieldTypeInfo
func parseTypeInfo(sel *ast.SelectorExpr, info *argInfo) *argInfo {
	if ident, ok := sel.X.(*ast.Ident); ok {
		info.pkgName = ident.Name
		info.identName = sel.Sel.Name
		return info
	}

	if callExpr, ok := sel.X.(*ast.CallExpr); ok {
		if sel2, ok := callExpr.Fun.(*ast.SelectorExpr); ok {
			return parseTypeInfo(sel2, info)
		}
	}

	if parenExpr, ok := sel.X.(*ast.ParenExpr); ok {
		compLit := astparser.GetExprToCompositeLitAllowUnaryExpr(parenExpr.X)
		// has a type part involved, encode this
		// TODO: need to go nuts with astparser to handle these things if I’m going to keep using AST
		info.fmt = typFormat
		return parseTypeInfo(astparser.GetExprToSelectorExpr(compLit.Type), info)
	}
	panic("unsupported type for now")
}

func modifyFieldForDataType(
	f *Field,
	pkg *packages.Package,
	explorer *packageExplorer,
	info *argInfo,
) chan error {
	errChan := make(chan error)
	go func() {
		resChan := explorer.getTypeForInfo(pkg, info)
		res := <-resChan

		if res.entType != nil {
			f.entType = res.entType
			f.setFieldType(enttype.GetType(f.entType))
		}
		if res.pkgPath != "" {
			f.pkgPath = res.pkgPath
		}
		// return error or lack thereof from result
		errChan <- res.err
	}()
	return errChan
}

func getCallExprFromKV(expr ast.Expr) (*ast.CallExpr, error) {
	callExpr, ok := expr.(*ast.CallExpr)
	if !ok {
		return nil, errors.New("invalid expr")
	}
	sel := astparser.GetExprToSelectorExpr(callExpr.Fun)
	typeName := astparser.GetTypeNameFromExpr(sel)

	if typeName != "field.F" {
		return nil, errors.New("unsupported field type for now")
	}

	return callExpr, nil
}

type fn func(f *Field, args []ast.Expr) error

func verifyArgs(args []ast.Expr, expectedCount int, fn func()) error {
	if len(args) != expectedCount {
		return errors.New("invalid number of args")
	}
	fn()
	return nil
}

var m = map[string]fn{
	"field.DB": func(f *Field, args []ast.Expr) error {
		return verifyArgs(args, 1, func() {
			f.dbName = astparser.GetUnderylingStringFromLiteralExpr(args[0])
		})
	},
	"field.GraphQL": func(f *Field, args []ast.Expr) error {
		return verifyArgs(args, 1, func() {
			f.graphQLName = astparser.GetUnderylingStringFromLiteralExpr(args[0])
		})
	},
	"field.Nullable": func(f *Field, args []ast.Expr) error {
		return verifyArgs(args, 0, func() {
			f.nullable = true
			f.setFieldType(enttype.GetNullableType(f.entType, f.nullable))
		})
	},
	"field.Unique": func(f *Field, args []ast.Expr) error {
		return verifyArgs(args, 0, func() {
			f.unique = true
			f.setFieldType(enttype.GetNullableType(f.entType, f.nullable))
		})
	},
	"field.Index": func(f *Field, args []ast.Expr) error {
		return verifyArgs(args, 0, func() {
			f.index = true
		})
	},
	"field.ServerDefault": func(f *Field, args []ast.Expr) error {
		return verifyArgs(args, 1, func() {
			// TODO this shouldn't only be string...
			// TODO compare types with f.type
			f.defaultValue = astparser.GetUnderylingStringFromLiteralExpr(args[0])
		})
	},
	"field.HideFromGraphQL": func(f *Field, args []ast.Expr) error {
		return verifyArgs(args, 0, func() {
			f.hideFromGraphQL = true
		})
	},
	"field.ForeignKey": func(f *Field, args []ast.Expr) error {
		return verifyArgs(args, 2, func() {
			configName := astparser.GetUnderylingStringFromLiteralExpr(args[0])
			fieldName := astparser.GetUnderylingStringFromLiteralExpr(args[1])

			f.setForeignKeyInfoFromString(configName + "." + fieldName)
		})
	},
}
