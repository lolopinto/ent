package field

import (
	"errors"
	"fmt"
	"go/ast"
	"sort"
	"sync"

	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/syncerr"
	"golang.org/x/tools/go/packages"
)

func ParseFieldsFunc(pkg *packages.Package, fn *ast.FuncDecl) (*FieldInfo, error) {
	elts := astparser.GetEltsInFunc(fn)

	fieldInfo := newFieldInfo()
	fieldInfo.getFieldsFn = true

	var wg sync.WaitGroup
	wg.Add(len(elts))

	var sErr syncerr.Error

	// TODO this should be a singleton or passed in here so that we cache as needed across object types
	explorer := newPackageExplorer()

	for idx := range elts {
		go func(idx int) {
			defer wg.Done()
			expr := elts[idx]
			result, err := astparser.Parse(expr)
			if err != nil {
				sErr.Append(err)
				return
			}

			if err := validateFieldResult(result); err != nil {
				sErr.Append(err)
				return
			}

			f := newField(result.Key)

			chanErr := parseField(f, pkg, result.Value, explorer)
			err = <-chanErr
			if err != nil {
				sErr.Append(err)
			}

			fieldInfo.addField(f)
		}(idx)
	}
	wg.Wait()

	// sort fields
	sort.Slice(fieldInfo.Fields, func(i, j int) bool {
		// sort lexicographically but put ID first
		if fieldInfo.Fields[i].FieldName == "ID" {
			return true
		}
		if fieldInfo.Fields[j].FieldName == "ID" {
			return false
		}

		return fieldInfo.Fields[i].FieldName < fieldInfo.Fields[j].FieldName
	})

	return fieldInfo, sErr.Err()
}

func parseField(f *Field, pkg *packages.Package, result *astparser.Result, explorer *packageExplorer) chan error {
	chanErr := make(chan error)
	go func() {
		var err error
		for idx, arg := range result.Args {

			if idx == 0 {
				// this is the real thing we're waiting for
				errChan := modifyFieldForDataType(f, pkg, explorer, arg)
				err = <-errChan
				// don't continue parsing other things here
				if err != nil {
					break
				}
			} else {
				typeName := arg.PkgName + "." + arg.IdentName

				fn, ok := m[typeName]
				if ok {
					fn(f, arg.Args)
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

func modifyFieldForDataType(
	f *Field,
	pkg *packages.Package,
	explorer *packageExplorer,
	info *astparser.Result,
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

		f.dataTypePkgPath = getImportedPackageThatMatchesIdent(pkg, info.PkgName, info.IdentName).PkgPath

		// return error or lack thereof from result
		errChan <- res.err
	}()
	return errChan
}

func validateFieldResult(result *astparser.Result) error {
	if result.Key == "" {
		return errors.New("expected a non-empty, didn't get one")
	}

	if result.Value == nil {
		return errors.New("expected parsed result to have a non-nil value")
	}

	if result.Value.PkgName != "field" || result.Value.IdentName != "F" {
		return fmt.Errorf("unsupported field type for now. expected field.F, got %s.%s instead", result.PkgName, result.IdentName)
	}

	return nil
}

type fn func(f *Field, args astparser.Results) error

func verifyArgs(args []*astparser.Result, expectedCount int, fn func()) error {
	if len(args) != expectedCount {
		return errors.New("invalid number of args")
	}
	fn()
	return nil
}

var m = map[string]fn{
	"field.DB": func(f *Field, args astparser.Results) error {
		return verifyArgs(args, 1, func() {
			f.setDBName(args[0].Literal)
		})
	},
	"field.GraphQL": func(f *Field, args astparser.Results) error {
		return verifyArgs(args, 1, func() {
			f.graphQLName = args[0].Literal
		})
	},
	"field.Nullable": func(f *Field, args astparser.Results) error {
		return verifyArgs(args, 0, func() {
			f.nullable = true
			f.setFieldType(enttype.GetNullableType(f.entType, f.nullable))
		})
	},
	"field.Unique": func(f *Field, args astparser.Results) error {
		return verifyArgs(args, 0, func() {
			f.unique = true
			f.setFieldType(enttype.GetNullableType(f.entType, f.nullable))
		})
	},
	"field.Index": func(f *Field, args astparser.Results) error {
		return verifyArgs(args, 0, func() {
			f.index = true
		})
	},
	"field.ServerDefault": func(f *Field, args astparser.Results) error {
		return verifyArgs(args, 1, func() {
			// TODO compare types with f.type
			f.defaultValue = args[0].Literal
		})
	},
	"field.HideFromGraphQL": func(f *Field, args astparser.Results) error {
		return verifyArgs(args, 0, func() {
			f.hideFromGraphQL = true
		})
	},
	"field.ForeignKey": func(f *Field, args astparser.Results) error {
		return verifyArgs(args, 2, func() {
			configName := args[0].Literal
			fieldName := args[1].Literal

			f.setForeignKeyInfoFromString(configName + "." + fieldName)
		})
	},
}
