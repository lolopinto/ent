package field

import (
	"errors"
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

func parseField(f *Field, pkg *packages.Package, callExpr *ast.CallExpr, explorer *packageExplorer) chan error {
	chanErr := make(chan error)
	go func() {
		var err error
		for idx, arg := range callExpr.Args {
			argCallExpr, ok := arg.(*ast.CallExpr)
			if !ok {
				chanErr <- errors.New("invalid arg")
				return
			}

			// TODO should also work for not function calls
			//			e.g.  field.StringType{name:}?
			// doesn't work for things with private types anyways
			argSel := astparser.GetExprToSelectorExpr(argCallExpr.Fun)

			if idx == 0 {
				// this is the real thing we're waiting for
				errChan := modifyFieldForDataType(f, pkg, explorer, argSel)
				err = <-errChan
				// don't continue parsing other things here
				if err != nil {
					break
				}
			} else {
				//			sel := astparser.GetExprToSelectorExpr(argCallExpr.Fun)
				// TODO this and the other one don't work if aliased...
				typeName := astparser.GetTypeNameFromExpr(argSel)

				//			spew.Dump(argSel)
				fn, ok := m[typeName]
				//		spew.Dump(typeName, fn)
				if ok {
					fn(f, argCallExpr.Args)
				} else {
					err = errors.New("unsupported ")
					break
				}
				//			spew.Dump(arg)
			}
		}
		// got here, we're done. succeeds if no error
		chanErr <- err
	}()
	return chanErr
}

// todo this needs to also work for local packages
// combine with astparser.GetFieldTypeInfo
func functionName(sel *ast.SelectorExpr) (string, string) {
	if ident, ok := sel.X.(*ast.Ident); ok {
		pkg := ident.Name
		methodName := sel.Sel.Name
		return pkg, methodName
	}

	if callExpr, ok := sel.X.(*ast.CallExpr); ok {
		if sel2, ok := callExpr.Fun.(*ast.SelectorExpr); ok {
			return functionName(sel2)
		}
	}
	panic("unsupported type for now")
}

func modifyFieldForDataType(
	f *Field,
	pkg *packages.Package,
	explorer *packageExplorer,
	dataTypeSelector *ast.SelectorExpr,
) chan error {
	errChan := make(chan error)
	go func() {
		pkgBase, fnName := functionName(dataTypeSelector)

		resChan := explorer.getTypeForFunction(pkgBase, fnName, pkg)
		res := <-resChan

		if res.entType != nil {
			f.entType = res.entType
			f.setFieldType(enttype.GetType(f.entType))
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
