package field

import (
	"errors"
	"go/ast"
	"path/filepath"

	"github.com/davecgh/go-spew/spew"
	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/enttype"
	"golang.org/x/tools/go/packages"
)

func ParseFieldsFunc(pkg *packages.Package, fn *ast.FuncDecl) (*FieldInfo, error) {
	elts := astparser.GetEltsInFunc(fn)

	fieldInfo := newFieldInfo()

	for _, expr := range elts {
		keyValueExpr := astparser.GetExprToKeyValueExpr(expr)

		f := newField(
			astparser.GetUnderylingStringFromLiteralExpr(keyValueExpr.Key),
		)

		callExpr, err := getCallExprFromKV(keyValueExpr.Value)
		if err != nil {
			return nil, err
		}

		parseField(f, pkg, callExpr)

		fieldInfo.addField(f)
	}
	spew.Dump(fieldInfo.Fields)
	return fieldInfo, nil
}

func parseField(f *Field, pkg *packages.Package, callExpr *ast.CallExpr) error {
	for idx, arg := range callExpr.Args {
		argCallExpr, ok := arg.(*ast.CallExpr)
		if !ok {
			return errors.New("invalid arg")
		}

		// TODO should also work for not function calls
		//			e.g.  field.StringType{name:}?
		// doesn't work for things with private types anyways
		argSel := astparser.GetExprToSelectorExpr(argCallExpr.Fun)

		if idx == 0 {
			modifyFieldForDataType(f, pkg, argSel)
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
				return errors.New("unsupported ")
			}
			//			spew.Dump(arg)
		}
	}
	return nil
}

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

func getImportedPackageThatMatchesFunction(
	pkg *packages.Package,
	pkgBase, fnName string,
) *packages.Package {
	for path, importedPkg := range pkg.Imports {
		base := filepath.Base(path)

		if base == pkgBase {
			return importedPkg
		}
	}
	panic("couldn't find the right package for function. shouldn't get here")
}

func modifyFieldForDataType(f *Field, pkg *packages.Package, dataTypeSelector *ast.SelectorExpr) {
	pkgBase, fnName := functionName(dataTypeSelector)
	importedPkg := getImportedPackageThatMatchesFunction(pkg, pkgBase, fnName)

	// get the type from an imported package. try both types and parsing structs
	//	getTypeFromPackage(f, importedPkg, fnName, true)

	//func getTypeFromPackage(f *Field, pkg *packages.Package, fnName string, parseStruct bool) {
	for _, file := range importedPkg.Syntax {
		if result := findFunctionWithName(file, fnName); result != nil {
			if getTypeFromReceiver(f, file, importedPkg, result.Name) {
				break
			}
		}

		if f.fieldType == nil {
			parseStructForType(f, file, importedPkg)
		}
	}
}

func getTypeFromReceiverInPackages(f *Field, pkg *packages.Package, structName string) bool {
	for _, file := range pkg.Syntax {
		if getTypeFromReceiver(f, file, pkg, structName) {
			return true
		}
	}
	return false
}

func findFunctionWithName(file *ast.File, fnName string) *astparser.FieldTypeInfo {
	for _, decl := range file.Decls {
		if fn, ok := decl.(*ast.FuncDecl); ok {
			if fn.Name.Name == fnName {

				results := fn.Type.Results

				if len(results.List) != 1 {
					panic("invalid number of results")
				}

				result := astparser.GetFieldTypeInfo(results.List[0])
				return &result

			}
		}
	}
	return nil
}

func getTypeFromReceiver(
	f *Field,
	file *ast.File,
	importedPkg *packages.Package,
	structName string,
) bool {

	for _, decl := range file.Decls {
		if fn, ok := decl.(*ast.FuncDecl); ok {
			if fn.Name.Name == "Type" {

				if fn.Recv == nil {
					continue
				}
				recv := astparser.GetFieldTypeInfo(fn.Recv.List[0])

				if recv.Name != structName {
					continue
				}

				retStmt := astparser.GetLastReturnStmtExpr(fn)
				f.entType = importedPkg.TypesInfo.TypeOf(retStmt)
				f.setFieldType(enttype.GetType(f.entType))
				return true
			}
		}
	}
	return false
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

func parseStructForType(
	field *Field,
	file *ast.File,
	importedPkg *packages.Package) {
	ast.Inspect(file, func(node ast.Node) bool {

		if t, ok := node.(*ast.TypeSpec); ok && t.Type != nil {
			s, ok := t.Type.(*ast.StructType)
			//			s.
			if !ok {
				return true
			}

			for _, f := range s.Fields.List {
				// we only care about fields that are being inherited
				if len(f.Names) != 0 {
					continue
				}

				fieldTypeInfo := astparser.GetFieldTypeInfo(f)

				// in the same package so find it...
				if fieldTypeInfo.PackageName == "" {
					if getTypeFromReceiver(
						field,
						file,
						importedPkg,
						fieldTypeInfo.Name,
					) {
						break
					}
				} else {
					importedPkg2 := getImportedPackageThatMatchesFunction(
						importedPkg, fieldTypeInfo.PackageName, fieldTypeInfo.Name)

					// find the String
					if !getTypeFromReceiverInPackages(
						field,
						importedPkg2,
						fieldTypeInfo.Name,
					) {
						// TODO need to keep coming
						// double nested in another struct...
						// TODO need to change this and just keep going as we see these things
						spew.Dump("need to fix this")
					}
				}
			}
		}

		return true
	})
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
