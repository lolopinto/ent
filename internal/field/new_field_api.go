package field

import (
	"errors"
	"fmt"
	"go/ast"
	"sync"

	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/syncerr"
	"golang.org/x/tools/go/packages"
)

func ParseFieldsFunc(pkg *packages.Package, fn *ast.FuncDecl) (*FieldInfo, error) {
	elts := astparser.GetEltsInFunc(fn)

	var wg sync.WaitGroup
	wg.Add(len(elts))

	var sErr syncerr.Error

	// TODO this should be a singleton or passed in here so that we cache as needed across object types
	explorer := newPackageExplorer()

	fields := make([]*input.Field, len(elts))

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

			f := &input.Field{
				Name: result.Key,
			}

			chanErr := parseField(f, pkg, result.Value, explorer)
			err = <-chanErr
			if err != nil {
				sErr.Append(err)
			}

			fields[idx] = f
		}(idx)
	}
	wg.Wait()

	if err := sErr.Err(); err != nil {
		return nil, err
	}

	fieldInfo, err := NewFieldInfoFromInputs(fields, &Options{
		AddBaseFields: true,
		SortFields:    true,
	})
	if fieldInfo != nil {
		fieldInfo.getFieldsFn = true
	}

	return fieldInfo, err
}

func parseField(f *input.Field, pkg *packages.Package, result *astparser.Result, explorer *packageExplorer) chan error {
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
	f *input.Field,
	pkg *packages.Package,
	explorer *packageExplorer,
	info *astparser.Result,
) chan error {
	errChan := make(chan error)

	go func() {
		resChan := explorer.getTypeForInfo(pkg, info)
		res := <-resChan

		if res.entType != nil {
			f.GoType = res.entType
		}
		if res.pkgPath != "" {
			f.PkgPath = res.pkgPath
		}
		// if the datatype is specifically private, field makes it private
		if res.private {
			f.Private = true
		}

		f.DataTypePkgPath = getImportedPackageThatMatchesIdent(pkg, info.PkgName, info.IdentName).PkgPath

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

type fn func(f *input.Field, args astparser.Results) error

func verifyArgs(args []*astparser.Result, expectedCount int, fn func()) error {
	if len(args) != expectedCount {
		return errors.New("invalid number of args")
	}
	fn()
	return nil
}

var m = map[string]fn{
	"field.DB": func(f *input.Field, args astparser.Results) error {
		return verifyArgs(args, 1, func() {
			f.StorageKey = args[0].Literal
		})
	},
	"field.GraphQL": func(f *input.Field, args astparser.Results) error {
		return verifyArgs(args, 1, func() {
			f.GraphQLName = args[0].Literal
		})
	},
	"field.Nullable": func(f *input.Field, args astparser.Results) error {
		return verifyArgs(args, 0, func() {
			f.Nullable = true
		})
	},
	"field.Unique": func(f *input.Field, args astparser.Results) error {
		return verifyArgs(args, 0, func() {
			f.Unique = true
		})
	},
	"field.Index": func(f *input.Field, args astparser.Results) error {
		return verifyArgs(args, 0, func() {
			f.Index = true
		})
	},
	"field.ServerDefault": func(f *input.Field, args astparser.Results) error {
		return verifyArgs(args, 1, func() {
			// TODO compare types with f.type
			f.ServerDefault = args[0].Literal
		})
	},
	"field.HideFromGraphQL": func(f *input.Field, args astparser.Results) error {
		return verifyArgs(args, 0, func() {
			f.HideFromGraphQL = true
		})
	},
	"field.ForeignKey": func(f *input.Field, args astparser.Results) error {
		return verifyArgs(args, 2, func() {
			configName := args[0].Literal
			fieldName := args[1].Literal

			f.ForeignKey = &input.ForeignKey{Schema: configName, Column: fieldName}
		})
	},
	"field.FieldEdge": func(f *input.Field, args astparser.Results) error {
		return verifyArgs(args, 2, func() {
			configName := args[0].Literal
			edgeName := args[1].Literal

			f.FieldEdge = &input.FieldEdge{Schema: configName, InverseEdge: edgeName}
		})
	},
}
