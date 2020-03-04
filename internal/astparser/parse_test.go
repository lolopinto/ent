package astparser_test

import (
	"go/token"
	"testing"

	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInlineType(t *testing.T) {
	loadCode(t,
		`package configs

	import "github.com/lolopinto/ent/ent"
	import "github.com/lolopinto/ent/ent/field"


	func f() ent.FieldMap {
		return ent.FieldMap {
			"Username": field.F(
				&field.StringDataType{},
				field.GraphQL("username"),
			),
		}
	}`,
		&astparser.Result{
			PkgName:     "ent",
			IdentName:   "FieldMap",
			Format:      astparser.TypFormat,
			ContainsMap: true,
			Elems: []*astparser.Result{
				&astparser.Result{
					Key: "Username",
					Value: &astparser.Result{
						PkgName:   "field",
						IdentName: "F",
						Format:    astparser.FunctionFormat,
						Args: []*astparser.Result{
							&astparser.Result{
								Pointer:   true,
								PkgName:   "field",
								IdentName: "StringDataType",
								Format:    astparser.TypFormat,
							},
							&astparser.Result{
								PkgName:   "field",
								IdentName: "GraphQL",
								Format:    astparser.FunctionFormat,
								Args: []*astparser.Result{
									&astparser.Result{
										Literal:     "username",
										LiteralKind: token.STRING,
									},
								},
							},
						},
					},
				},
			},
		},
	)
}

func TestInlineTypeWithSingleCall(t *testing.T) {
	loadCode(t,
		`package configs

	import "github.com/lolopinto/ent/ent"
	import "github.com/lolopinto/ent/ent/field"


	func f() ent.FieldMap {
		return ent.FieldMap {
			"Username": field.F(
				(&field.StringDataType{}).MinLen(5), 
				field.GraphQL("username"),
			),
		}
	}`,
		&astparser.Result{
			PkgName:     "ent",
			IdentName:   "FieldMap",
			ContainsMap: true,
			Format:      astparser.TypFormat,
			Elems: []*astparser.Result{
				&astparser.Result{
					Key: "Username",
					Value: &astparser.Result{
						PkgName:   "field",
						IdentName: "F",
						Format:    astparser.FunctionFormat,
						Args: []*astparser.Result{
							&astparser.Result{
								Pointer:   true,
								PkgName:   "field",
								IdentName: "StringDataType",
								Format:    astparser.TypFormat,
								Attributes: []*astparser.Result{
									&astparser.Result{
										IdentName: "MinLen",
										Format:    astparser.FunctionFormat,
										Args: []*astparser.Result{
											&astparser.Result{
												Literal:     "5",
												LiteralKind: token.INT,
											},
										},
									},
								},
							},
							&astparser.Result{
								PkgName:   "field",
								IdentName: "GraphQL",
								Format:    astparser.FunctionFormat,
								Args: []*astparser.Result{
									&astparser.Result{
										Literal:     "username",
										LiteralKind: token.STRING,
									},
								},
							},
						},
					},
				},
			},
		},
	)
}

func TestInlineTypeWithMultiCall(t *testing.T) {
	loadCode(t,
		`package configs

	import "regexp"
	import "github.com/lolopinto/ent/ent"
	import "github.com/lolopinto/ent/ent/field"


	func f() ent.FieldMap {
		return ent.FieldMap {
			"Username": field.F(
				(&field.StringDataType{}).MinLen(5).ToLower().TrimSpace().Match(regexp.MustCompile("^[a-zA-Z0-9_-]{5,20}$")), 
				field.GraphQL("username"),
			),
		}
	}`,
		&astparser.Result{
			PkgName:     "ent",
			IdentName:   "FieldMap",
			ContainsMap: true,
			Format:      astparser.TypFormat,
			Elems: []*astparser.Result{
				&astparser.Result{
					Key: "Username",
					Value: &astparser.Result{
						PkgName:   "field",
						IdentName: "F",
						Format:    astparser.FunctionFormat,
						Args: []*astparser.Result{
							&astparser.Result{
								Pointer:   true,
								PkgName:   "field",
								IdentName: "StringDataType",
								Format:    astparser.TypFormat,
								Attributes: []*astparser.Result{
									&astparser.Result{
										IdentName: "MinLen",
										Format:    astparser.FunctionFormat,
										Args: []*astparser.Result{
											&astparser.Result{
												Literal:     "5",
												LiteralKind: token.INT,
											},
										},
									},
									&astparser.Result{
										IdentName: "ToLower",
										Format:    astparser.FunctionFormat,
									},
									&astparser.Result{
										IdentName: "TrimSpace",
										Format:    astparser.FunctionFormat,
									},
									&astparser.Result{
										IdentName: "Match",
										Format:    astparser.FunctionFormat,
										Args: []*astparser.Result{
											&astparser.Result{
												PkgName:   "regexp",
												IdentName: "MustCompile",
												Format:    astparser.FunctionFormat,
												Args: []*astparser.Result{
													&astparser.Result{
														Literal:     "^[a-zA-Z0-9_-]{5,20}$",
														LiteralKind: token.STRING,
													},
												},
											},
										},
									},
								},
							},
							&astparser.Result{
								PkgName:   "field",
								IdentName: "GraphQL",
								Format:    astparser.FunctionFormat,
								Args: []*astparser.Result{
									&astparser.Result{
										Literal:     "username",
										LiteralKind: token.STRING,
									},
								},
							},
						},
					},
				},
			},
		},
	)
}

func TestFuncCall(t *testing.T) {
	loadCode(t,
		`package configs

	import "github.com/lolopinto/ent/ent"
	import "github.com/lolopinto/ent/ent/field"


	func f() ent.FieldMap {
		return ent.FieldMap {
			"Username": field.F(
				field.StringType().MinLen(5).ToLower().TrimSpace(),
				field.GraphQL("username"),
				field.Unique(),
			),
		}
	}`,
		&astparser.Result{
			PkgName:     "ent",
			IdentName:   "FieldMap",
			ContainsMap: true,
			Format:      astparser.TypFormat,
			Elems: []*astparser.Result{
				&astparser.Result{
					Key: "Username",
					Value: &astparser.Result{
						PkgName:   "field",
						IdentName: "F",
						Format:    astparser.FunctionFormat,
						Args: []*astparser.Result{
							&astparser.Result{
								PkgName:   "field",
								IdentName: "StringType",
								Format:    astparser.FunctionFormat,
								Attributes: []*astparser.Result{
									&astparser.Result{
										IdentName: "MinLen",
										Format:    astparser.FunctionFormat,
										Args: []*astparser.Result{
											&astparser.Result{
												Literal:     "5",
												LiteralKind: token.INT,
											},
										},
									},
									&astparser.Result{
										IdentName: "ToLower",
										Format:    astparser.FunctionFormat,
									},
									&astparser.Result{
										IdentName: "TrimSpace",
										Format:    astparser.FunctionFormat,
									},
								},
							},
							&astparser.Result{
								PkgName:   "field",
								IdentName: "GraphQL",
								Format:    astparser.FunctionFormat,
								Args: []*astparser.Result{
									&astparser.Result{
										Literal:     "username",
										LiteralKind: token.STRING,
									},
								},
							},
							&astparser.Result{
								PkgName:   "field",
								IdentName: "Unique",
								Format:    astparser.FunctionFormat,
							},
						},
					},
				},
			},
		},
	)
}

func TestSlice(t *testing.T) {
	loadCode(t,
		`package configs

	import "github.com/lolopinto/ent/ent/field"

	func f() []*field.Field {
		return []*field.Field {
			field.F(
				field.StringType().MinLen(5).ToLower().TrimSpace(),
				field.GraphQL("username"),
				field.Unique(),
			),
			field.F(
				field.IntType(),
			),
		}
	}`,
		&astparser.Result{
			PkgName:   "field",
			IdentName: "Field",
			Pointer:   true,
			Format:    astparser.TypFormat,
			Slice:     true,
			Elems: []*astparser.Result{
				&astparser.Result{
					PkgName:   "field",
					IdentName: "F",
					Format:    astparser.FunctionFormat,
					Args: []*astparser.Result{
						&astparser.Result{
							PkgName:   "field",
							IdentName: "StringType",
							Format:    astparser.FunctionFormat,
							Attributes: []*astparser.Result{
								&astparser.Result{
									IdentName: "MinLen",
									Format:    astparser.FunctionFormat,
									Args: []*astparser.Result{
										&astparser.Result{
											Literal:     "5",
											LiteralKind: token.INT,
										},
									},
								},
								&astparser.Result{
									IdentName: "ToLower",
									Format:    astparser.FunctionFormat,
								},
								&astparser.Result{
									IdentName: "TrimSpace",
									Format:    astparser.FunctionFormat,
								},
							},
						},
						&astparser.Result{
							PkgName:   "field",
							IdentName: "GraphQL",
							Format:    astparser.FunctionFormat,
							Args: []*astparser.Result{
								&astparser.Result{
									Literal:     "username",
									LiteralKind: token.STRING,
								},
							},
						},
						&astparser.Result{
							PkgName:   "field",
							IdentName: "Unique",
							Format:    astparser.FunctionFormat,
						},
					},
				},
				&astparser.Result{
					PkgName:   "field",
					IdentName: "F",
					Format:    astparser.FunctionFormat,
					Args: []*astparser.Result{
						&astparser.Result{
							PkgName:   "field",
							IdentName: "IntType",
							Format:    astparser.FunctionFormat,
						},
					},
				},
			},
		},
	)
}

func TestLocalInlineType(t *testing.T) {
	loadCode(t,
		`package configs

	import "github.com/lolopinto/ent/ent"
	import "github.com/lolopinto/ent/ent/field"

	type localStringType struct {}

	func (t localStringType) Type() interface{} {
		return ""
	}

	func f() ent.FieldMap {
		return ent.FieldMap {
			"Username": field.F(
				localStringType{},
			),
		}
	}`,
		&astparser.Result{
			PkgName:     "ent",
			IdentName:   "FieldMap",
			Format:      astparser.TypFormat,
			ContainsMap: true,
			Elems: []*astparser.Result{
				&astparser.Result{
					Key: "Username",
					Value: &astparser.Result{
						PkgName:   "field",
						IdentName: "F",
						Format:    astparser.FunctionFormat,
						Args: []*astparser.Result{
							&astparser.Result{
								IdentName: "localStringType",
								Format:    astparser.TypFormat,
							},
						},
					},
				},
			},
		},
	)
}

func TestLocalInlineTypePtr(t *testing.T) {
	loadCode(t,
		`package configs

	import "github.com/lolopinto/ent/ent"
	import "github.com/lolopinto/ent/ent/field"

	type localStringType struct {}

	func (t *localStringType) Type() interface{} {
		return ""
	}

	func f() ent.FieldMap {
		return ent.FieldMap {
			"Username": field.F(
				&localStringType{},
			),
		}
	}`,
		&astparser.Result{
			PkgName:     "ent",
			IdentName:   "FieldMap",
			Format:      astparser.TypFormat,
			ContainsMap: true,
			Elems: []*astparser.Result{
				&astparser.Result{
					Key: "Username",
					Value: &astparser.Result{
						PkgName:   "field",
						IdentName: "F",
						Format:    astparser.FunctionFormat,
						Args: []*astparser.Result{
							&astparser.Result{
								Pointer:   true,
								IdentName: "localStringType",
								Format:    astparser.TypFormat,
							},
						},
					},
				},
			},
		},
	)
}

func TestLocalInlineTypeWithFuncs(t *testing.T) {
	loadCode(t,
		`package configs

	import "github.com/lolopinto/ent/ent"
	import "github.com/lolopinto/ent/ent/field"

	type localStringType struct {}

	func (t *localStringType) Type() interface{} {
		return ""
	}

	func (t *localStringType) Foo() *localStringType {
		return t
	}

	func (t *localStringType) Bar(baz string) *localStringType {
		return t
	}

	func f() ent.FieldMap {
		return ent.FieldMap {
			"Username": field.F(
				(&localStringType{}).Foo().Bar("baz"),
			),
		}
	}`,
		&astparser.Result{
			PkgName:     "ent",
			IdentName:   "FieldMap",
			Format:      astparser.TypFormat,
			ContainsMap: true,
			Elems: []*astparser.Result{
				&astparser.Result{
					Key: "Username",
					Value: &astparser.Result{
						PkgName:   "field",
						IdentName: "F",
						Format:    astparser.FunctionFormat,
						Args: []*astparser.Result{
							&astparser.Result{
								Pointer:   true,
								IdentName: "localStringType",
								Format:    astparser.TypFormat,
								Attributes: []*astparser.Result{
									&astparser.Result{
										IdentName: "Foo",
										Format:    astparser.FunctionFormat,
									},
									&astparser.Result{
										IdentName: "Bar",
										Format:    astparser.FunctionFormat,
										Args: []*astparser.Result{
											&astparser.Result{
												Literal:     "baz",
												LiteralKind: token.STRING,
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	)
}

func TestLocalInlineFunc(t *testing.T) {
	loadCode(t,
		`package configs

	import "github.com/lolopinto/ent/ent"
	import "github.com/lolopinto/ent/ent/field"

	type localStringType struct {}

	func (t *localStringType) Type() interface{} {
		return ""
	}

	func (t *localStringType) Foo() *localStringType {
		return t
	}

	func (t *localStringType) Bar(baz string) *localStringType {
		return t
	}

	func str() *localStringType {
		return &localStringType{}
	}

	func f() ent.FieldMap {
		return ent.FieldMap {
			"Username": field.F(
				str().Foo().Bar("baz"),
			),
		}
	}`,
		&astparser.Result{
			PkgName:     "ent",
			IdentName:   "FieldMap",
			Format:      astparser.TypFormat,
			ContainsMap: true,
			Elems: []*astparser.Result{
				&astparser.Result{
					Key: "Username",
					Value: &astparser.Result{
						PkgName:   "field",
						IdentName: "F",
						Format:    astparser.FunctionFormat,
						Args: []*astparser.Result{
							&astparser.Result{
								IdentName: "str",
								Format:    astparser.FunctionFormat,
								Attributes: []*astparser.Result{
									&astparser.Result{
										IdentName: "Foo",
										Format:    astparser.FunctionFormat,
									},
									&astparser.Result{
										IdentName: "Bar",
										Format:    astparser.FunctionFormat,
										Args: []*astparser.Result{
											&astparser.Result{
												Literal:     "baz",
												LiteralKind: token.STRING,
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	)
}

func TestNonLiteralKeys(t *testing.T) {
	loadCode(t,
		`package configs

	import "github.com/lolopinto/ent/ent"

	func f() ent.EdgeMap {
		return ent.EdgeMap {
			"Edge": &ent.AssociationEdge{
				EntConfig: "5",  // todo
				Symmetric: true,
			},
		}
	}`,
		&astparser.Result{
			PkgName:     "ent",
			IdentName:   "EdgeMap",
			Format:      astparser.TypFormat,
			ContainsMap: true,
			Elems: []*astparser.Result{
				&astparser.Result{
					Key: "Edge",
					Value: &astparser.Result{
						PkgName:   "ent",
						Pointer:   true,
						IdentName: "AssociationEdge",
						Format:    astparser.TypFormat,
						Elems: []*astparser.Result{
							&astparser.Result{
								IdentName: "EntConfig",
								Value: &astparser.Result{
									Literal:     "5",
									LiteralKind: token.STRING,
								},
							},
							&astparser.Result{
								IdentName: "Symmetric",
								Value: &astparser.Result{
									IdentName: "true",
								},
							},
						},
					},
				},
			},
		},
	)
}

func loadCode(t *testing.T, code string, expResult *astparser.Result) {
	pkg, fn, err := schemaparser.FindFunction(code, "configs", "f")
	assert.Nil(t, err)
	assert.NotNil(t, fn)
	assert.NotNil(t, pkg)

	result, err := astparser.Parse(astparser.GetLastReturnStmtExpr(fn))
	assert.Nil(t, err)

	validateResult(t, expResult, result)
}

func validateResult(t *testing.T, expResult, result *astparser.Result) {
	assert.Equal(t, expResult.PkgName, result.PkgName, "pkg name")
	assert.Equal(t, expResult.IdentName, result.IdentName, "ident name")
	assert.Equal(t, expResult.Pointer, result.Pointer, "pointer")
	assert.Equal(t, expResult.Literal, result.Literal, "literal")
	assert.Equal(t, expResult.LiteralKind, result.LiteralKind, "literal kind of value %s", result.Literal)
	assert.Equal(t, expResult.Format, result.Format, "format")

	validateMap(t, expResult, result)

	validateList(t, expResult.Elems, result.Elems, "elems")
	validateList(t, expResult.Args, result.Args, "args")
	validateList(t, expResult.Attributes, result.Attributes, "attributes")
}

func validateMap(t *testing.T, expResult, result *astparser.Result) {
	assert.Equal(t, expResult.ContainsMap, result.ContainsMap)
	assert.Equal(t, expResult.Key, result.Key)

	if expResult.Value == nil {
		assert.Nil(t, result.Value)
	} else {
		require.NotNil(t, result.Value)
		validateResult(t, expResult.Value, result.Value)
	}
}

func validateList(t *testing.T, expItems, items []*astparser.Result, key string) {
	require.Equal(t, len(expItems), len(items), key)

	for idx := range expItems {
		expElem := expItems[idx]
		elem := items[idx]

		validateResult(t, expElem, elem)
	}
}
