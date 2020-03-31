package astparser

import (
	"go/ast"
	"go/token"
	"strconv"
	"strings"
)

// Format indicates whether identName in Result is a function or type
type Format string

const (
	// FunctionFormat is for declarations like field.IntType()
	FunctionFormat Format = "func"

	// TypFormat is for declarations like &field.StringDataType{}
	TypFormat Format = "type"
)

// Results is a named type for a list of Results
type Results []*Result

// Result is returned by Parse after parsing an AST. It encodes the tree in a more-friendly way
// It's not exhaustive and only supports what has currently been tested
type Result struct {
	ContainsMap bool
	Slice       bool
	PkgName     string
	IdentName   string
	Format      Format
	Literal     string
	LiteralKind token.Token
	Pointer     bool

	Key   string  // key if Result is a Map
	Value *Result // Value if Result is a Map

	Elems      Results // Sub-elements in a slice or map
	Args       Results // Arguments to a function
	Attributes Results // Attributes/configurations on the object.

	Expr ast.Expr
	// e.g. (&field.StringDataType{}).MaxLen(5)
	// or field.StringType().MaxLen(5)
	selectParent *ast.SelectorExpr
	parent       ast.Expr
}

func (result *Result) IsScalarType(name string) bool {
	parts := strings.Split(name, ".")
	var identName, pkgName string
	if len(parts) == 2 {
		pkgName = parts[0]
		identName = parts[1]
	} else {
		// we assume one and fail liberally otherwise
		identName = parts[0]
	}
	if result.IdentName != identName {
		return false
	}
	if result.PkgName != pkgName {
		return false
	}
	return (result.ContainsMap == false &&
		!result.Slice &&
		!result.Pointer &&
		result.Format == "" &&
		result.Literal == "" &&
		result.Key == "" &&
		result.Value == nil &&
		len(result.Elems) == 0 &&
		len(result.Attributes) == 0 &&
		result.selectParent == nil &&
		result.parent == nil)
}

func (result *Result) GetTypeName() string {
	if result.PkgName == "" {
		return result.IdentName
	}
	// todo verify
	return result.PkgName + "." + result.IdentName
}

func IsTrueBooleanResult(result *Result) bool {
	if result == nil {
		return false
	}
	return result.IsScalarType("true")
}

func IsFalseBooleanResult(result *Result) bool {
	if result == nil {
		return false
	}
	return result.IsScalarType("false")
}

func GetStringList(result *Result) []string {
	results := make([]string, len(result.Elems))
	for idx, elem := range result.Elems {
		results[idx] = elem.Literal
	}
	return results
}

func newResult(expr ast.Expr) *Result {
	return &Result{Expr: expr}
}

// Parse takes an element received from an AST tree and parses it into a more-friendly format
func Parse(expr ast.Expr) (*Result, error) {
	ret := newResult(expr)
	err := parse(expr, ret, nil)
	if err != nil {
		return nil, err
	}
	return ret, err
}

// ParseFieldType is a helper function to parse the type of a field
func ParseFieldType(field *ast.Field) (*Result, error) {
	return Parse(field.Type)
}

func parse(expr ast.Expr, ret *Result, parent ast.Expr) error {
	compLit, ok := expr.(*ast.CompositeLit)
	if ok {
		ret.Format = TypFormat
		if len(compLit.Elts) != 0 {
			for idx, elt := range compLit.Elts {

				elem := newResult(elt)
				if err := parse(elt, elem, expr); err != nil {
					return err
				}

				// assume all slice or all map for now so only check first element
				if idx == 0 && elem.Key != "" {
					ret.ContainsMap = true
				} else {
					ret.Slice = true
				}
				ret.Elems = append(ret.Elems, elem)
			}
		}
		if err := parse(compLit.Type, ret, expr); err != nil {
			return err
		}
	}

	arrayType, ok := expr.(*ast.ArrayType)
	if ok {
		ret.Slice = true
		if err := parse(arrayType.Elt, ret, arrayType); err != nil {
			return err
		}
	}

	// need to handle basicLit on its own as a ret and then get the result of it
	basicLit, ok := expr.(*ast.BasicLit)
	if ok {
		ret.LiteralKind = basicLit.Kind
		ret.Literal = basicLit.Value
		// need to unquote string to be helpful
		if basicLit.Kind == token.STRING {
			var err error
			ret.Literal, err = strconv.Unquote(basicLit.Value)
			if err != nil {
				return err
			}
		}
	}

	kve, ok := expr.(*ast.KeyValueExpr)
	if ok {
		key := newResult(kve.Key)
		// spew.Dump(kve.Key)
		// spew.Dump(key)
		if err := parse(kve.Key, key, expr); err != nil {
			return err
		}
		// get some fields from the key
		if key.Literal != "" {
			ret.Key = key.Literal
		} else {
			ret.PkgName = key.PkgName
			ret.IdentName = key.IdentName
		}

		ret.Value = newResult(kve.Value)
		if err := parse(kve.Value, ret.Value, expr); err != nil {
			return err
		}
	}

	callExpr, ok := expr.(*ast.CallExpr)
	if ok {
		sel, ok := callExpr.Fun.(*ast.SelectorExpr)

		// if child is a selectorExpr
		// chained e.g. foo().bar().baz("1")
		if ok {
			_, ok := sel.X.(*ast.Ident)
			if !ok {
				elem := newResult(sel.X)
				if err := parse(sel.X, elem, callExpr); err != nil {
					return err
				}

				attr := newResult(sel.Sel)
				attr.IdentName = sel.Sel.Name
				attr.Format = FunctionFormat
				for _, arg := range callExpr.Args {
					argElem := newResult(arg)
					if err := parse(arg, argElem, callExpr); err != nil {
						return err
					}
					attr.Args = append(attr.Args, argElem)
				}
				elem.Attributes = append(elem.Attributes, attr)
				// assign ret to elem
				*ret = *elem
				return nil
			}
		}

		ret.Format = FunctionFormat
		if err := parse(callExpr.Fun, ret, expr); err != nil {
			return err
		}

		// this needs to somehow go on attributes of child object in some scenarios
		for _, arg := range callExpr.Args {
			elem := newResult(arg)
			if err := parse(arg, elem, expr); err != nil {
				return err
			}

			ret.Args = append(ret.Args, elem)
		}
	}

	ident, ok := expr.(*ast.Ident)
	if ok {
		if ret.selectParent != nil {
			ret.PkgName = ident.Name
			ret.IdentName = ret.selectParent.Sel.Name
		} else {
			ret.IdentName = ident.Name
		}
	}

	sel, ok := expr.(*ast.SelectorExpr)
	if ok {
		// TODO may need to put more sel information
		// may need specific selector path?
		// or a parent object passed?
		ret.selectParent = sel
		if err := parse(sel.X, ret, expr); err != nil {
			return err
		}
		ret.selectParent = nil
	}

	unary, ok := expr.(*ast.UnaryExpr)
	if ok {
		ret.Pointer = true
		ret.Format = TypFormat
		if err := parse(unary.X, ret, expr); err != nil {
			return err
		}
	}

	paren, ok := expr.(*ast.ParenExpr)
	if ok {
		if err := parse(paren.X, ret, expr); err != nil {
			return err
		}
	}

	star, ok := expr.(*ast.StarExpr)
	if ok {
		ret.Pointer = true
		ret.Format = TypFormat
		if err := parse(star.X, ret, expr); err != nil {
			return err
		}
	}
	return nil
}
