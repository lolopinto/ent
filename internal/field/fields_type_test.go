package field

import (
	"testing"

	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// this is to test the different field type APIs introduced with https://github.com/lolopinto/ent/pull/867/files
// maybe simpler in the future
type expected struct {
	private            bool
	asyncAccessor      bool
	tsFieldName        string
	tsBuilderFieldName string
	tsPublicAPIName    string
	tsType             string
	tsFieldType        string
	tsBuilderType      string
	// undefined added in builder.tmpl
	tsBuilderUnionType string

	//GetTSGraphQLTypeForFieldImports
	graphqlImports []*tsimport.ImportPath
	// GetTSMutationGraphQLTypeForFieldImports
	graphqlMutationImports []*tsimport.ImportPath
	// force optional
	// used for edit mutations for example
	graphqlMutationImportsForceOptional []*tsimport.ImportPath

	fieldTypeType   enttype.EntType
	tsFieldTypeType enttype.EntType

	// if optional in action, create new field that's optional in action and then test input there
	optionalInAction bool
	requiredInAction bool
}

func TestNonNullableField(t *testing.T) {
	cfg := &codegenapi.DummyConfig{}
	f, err := newFieldFromInputTest(cfg, &input.Field{
		Name: "name",
		Type: &input.FieldType{
			DBType: input.String,
		},
	})
	require.Nil(t, err)
	doTestField(t, cfg, f, &expected{
		private:            false,
		asyncAccessor:      false,
		tsFieldName:        "name",
		tsBuilderFieldName: "name",
		tsPublicAPIName:    "name",
		tsType:             "string",
		tsFieldType:        "string",
		tsBuilderType:      "string",
		tsBuilderUnionType: "string",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImportsForceOptional: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		fieldTypeType:   &enttype.StringType{},
		tsFieldTypeType: &enttype.StringType{},
	})
}

func TestNullableField(t *testing.T) {
	cfg := &codegenapi.DummyConfig{}
	f, err := newFieldFromInputTest(cfg, &input.Field{
		Name:     "name",
		Nullable: true,
		Type: &input.FieldType{
			DBType: input.String,
		},
	})
	require.Nil(t, err)
	doTestField(t, cfg, f, &expected{
		private:            false,
		asyncAccessor:      false,
		tsFieldName:        "name",
		tsBuilderFieldName: "name",
		tsPublicAPIName:    "name",
		tsType:             "string | null",
		tsFieldType:        "string | null",
		tsBuilderType:      "string | null",
		tsBuilderUnionType: "string | null",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImportsForceOptional: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		fieldTypeType:   &enttype.NullableStringType{},
		tsFieldTypeType: &enttype.NullableStringType{},
	})
}

func TestOptionalFieldInAction(t *testing.T) {
	cfg := &codegenapi.DummyConfig{}
	f, err := newFieldFromInputTest(cfg, &input.Field{
		Name: "name",
		Type: &input.FieldType{
			DBType: input.String,
		},
	})
	require.Nil(t, err)
	doTestField(t, cfg, f, &expected{
		private:            false,
		asyncAccessor:      false,
		tsFieldName:        "name",
		tsBuilderFieldName: "name",
		tsPublicAPIName:    "name",
		tsType:             "string",
		tsFieldType:        "string",
		tsBuilderType:      "string",
		tsBuilderUnionType: "string",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImportsForceOptional: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		fieldTypeType:    &enttype.StringType{},
		tsFieldTypeType:  &enttype.StringType{},
		optionalInAction: true,
	})
}

func TestRequiredFieldInAction(t *testing.T) {
	cfg := &codegenapi.DummyConfig{}
	f, err := newFieldFromInputTest(cfg, &input.Field{
		Name:     "name",
		Nullable: true,
		Type: &input.FieldType{
			DBType: input.String,
		},
	})
	require.Nil(t, err)
	doTestField(t, cfg, f, &expected{
		private:            false,
		asyncAccessor:      false,
		tsFieldName:        "name",
		tsBuilderFieldName: "name",
		tsPublicAPIName:    "name",
		tsType:             "string | null",
		tsFieldType:        "string | null",
		tsBuilderType:      "string | null",
		tsBuilderUnionType: "string | null",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImportsForceOptional: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		requiredInAction: true,
		fieldTypeType:    &enttype.NullableStringType{},
		tsFieldTypeType:  &enttype.NullableStringType{},
	})
}

func TestNonNullableListField(t *testing.T) {
	cfg := &codegenapi.DummyConfig{}
	f, err := newFieldFromInputTest(cfg, &input.Field{
		Name: "name",
		Type: &input.FieldType{
			DBType: input.List,
			ListElemType: &input.FieldType{
				DBType: input.String,
			},
		},
	})
	require.Nil(t, err)
	doTestField(t, cfg, f, &expected{
		private:            false,
		asyncAccessor:      false,
		tsFieldName:        "name",
		tsBuilderFieldName: "name",
		tsPublicAPIName:    "name",
		tsType:             "string[]",
		tsFieldType:        "string[]",
		tsBuilderType:      "string[]",
		tsBuilderUnionType: "string[]",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLClassImportPath("GraphQLList"),
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLClassImportPath("GraphQLList"),
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImportsForceOptional: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLList"),
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		fieldTypeType: &enttype.ArrayListType{
			ElemType: &enttype.StringType{},
		},
		tsFieldTypeType: &enttype.ArrayListType{
			ElemType: &enttype.StringType{},
		},
	})
}

type onDemandConfig struct {
	codegenapi.DummyConfig
}

func (cfg *onDemandConfig) FieldPrivacyEvaluated() codegenapi.FieldPrivacyEvaluated {
	return codegenapi.OnDemand
}

type onEntLoadConfig struct {
	codegenapi.DummyConfig
}

func (cfg *onEntLoadConfig) FieldPrivacyEvaluated() codegenapi.FieldPrivacyEvaluated {
	return codegenapi.AtEntLoad
}

func TestNonNullableFieldOnDemand(t *testing.T) {
	cfg := &onDemandConfig{}
	f, err := newFieldFromInputTest(cfg, &input.Field{
		Name: "name",
		Type: &input.FieldType{
			DBType: input.String,
		},
		HasFieldPrivacy: true,
	})
	require.Nil(t, err)
	doTestField(t, cfg, f, &expected{
		private:            true,
		asyncAccessor:      true,
		tsFieldName:        "_name",
		tsBuilderFieldName: "name",
		tsPublicAPIName:    "name",
		tsType:             "string | null",
		tsFieldType:        "string",
		tsBuilderType:      "string",
		tsBuilderUnionType: "string | null",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImportsForceOptional: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		fieldTypeType: &enttype.StringType{},
		// has async accessor so the type from the db is not null even though the public APi is null
		tsFieldTypeType: &enttype.StringType{},
	})
}

func TestNonNullableFieldOnDemandNoFieldPrivacy(t *testing.T) {
	cfg := &onDemandConfig{}
	f, err := newFieldFromInputTest(cfg, &input.Field{
		Name: "name",
		Type: &input.FieldType{
			DBType: input.String,
		},
	})
	require.Nil(t, err)
	doTestField(t, cfg, f, &expected{
		private:            false,
		asyncAccessor:      false,
		tsFieldName:        "name",
		tsBuilderFieldName: "name",
		tsPublicAPIName:    "name",
		tsType:             "string",
		tsFieldType:        "string",
		tsBuilderType:      "string",
		tsBuilderUnionType: "string",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImportsForceOptional: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		fieldTypeType:   &enttype.StringType{},
		tsFieldTypeType: &enttype.StringType{},
	})
}

func TestNullableFieldOnDemand(t *testing.T) {
	cfg := &onDemandConfig{}
	f, err := newFieldFromInputTest(cfg, &input.Field{
		Name:     "name",
		Nullable: true,
		Type: &input.FieldType{
			DBType: input.String,
		},
		HasFieldPrivacy: true,
	})
	require.Nil(t, err)
	doTestField(t, cfg, f, &expected{
		private:            true,
		asyncAccessor:      true,
		tsFieldName:        "_name",
		tsBuilderFieldName: "name",
		tsPublicAPIName:    "name",
		tsType:             "string | null",
		tsFieldType:        "string | null",
		tsBuilderType:      "string | null",
		tsBuilderUnionType: "string | null",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImportsForceOptional: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		fieldTypeType:   &enttype.NullableStringType{},
		tsFieldTypeType: &enttype.NullableStringType{},
	})
}

func TestNullableFieldOnDemandNoFieldPrivacy(t *testing.T) {
	cfg := &onDemandConfig{}
	f, err := newFieldFromInputTest(cfg, &input.Field{
		Name:     "name",
		Nullable: true,
		Type: &input.FieldType{
			DBType: input.String,
		},
	})
	require.Nil(t, err)
	doTestField(t, cfg, f, &expected{
		private:            false,
		asyncAccessor:      false,
		tsFieldName:        "name",
		tsBuilderFieldName: "name",
		tsPublicAPIName:    "name",
		tsType:             "string | null",
		tsFieldType:        "string | null",
		tsBuilderType:      "string | null",
		tsBuilderUnionType: "string | null",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImportsForceOptional: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		fieldTypeType:   &enttype.NullableStringType{},
		tsFieldTypeType: &enttype.NullableStringType{},
	})
}

func TestNonNullableFieldOnEntLoad(t *testing.T) {
	cfg := &onEntLoadConfig{}
	f, err := newFieldFromInputTest(cfg, &input.Field{
		Name: "name",
		Type: &input.FieldType{
			DBType: input.String,
		},
		HasFieldPrivacy: true,
	})
	require.Nil(t, err)
	doTestField(t, cfg, f, &expected{
		private:            false,
		asyncAccessor:      false,
		tsFieldName:        "name",
		tsBuilderFieldName: "name",
		tsPublicAPIName:    "name",
		tsType:             "string | null",
		tsFieldType:        "string | null",
		tsBuilderType:      "string",
		tsBuilderUnionType: "string | null",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImportsForceOptional: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		fieldTypeType: &enttype.StringType{},
		// nullable type since privacy check can make it null
		tsFieldTypeType: &enttype.NullableStringType{},
	})
}

func TestNonNullableFieldOnEntLoadNoFieldPrivacy(t *testing.T) {
	cfg := &onEntLoadConfig{}
	f, err := newFieldFromInputTest(cfg, &input.Field{
		Name: "name",
		Type: &input.FieldType{
			DBType: input.String,
		},
	})
	require.Nil(t, err)
	doTestField(t, cfg, f, &expected{
		private:            false,
		asyncAccessor:      false,
		tsFieldName:        "name",
		tsBuilderFieldName: "name",
		tsPublicAPIName:    "name",
		tsType:             "string",
		tsFieldType:        "string",
		tsBuilderType:      "string",
		tsBuilderUnionType: "string",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImportsForceOptional: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		fieldTypeType:   &enttype.StringType{},
		tsFieldTypeType: &enttype.StringType{},
	})
}

func TestNullableFieldOnEntLoad(t *testing.T) {
	cfg := &onEntLoadConfig{}
	f, err := newFieldFromInputTest(cfg, &input.Field{
		Name:     "name",
		Nullable: true,
		Type: &input.FieldType{
			DBType: input.String,
		},
		HasFieldPrivacy: true,
	})
	require.Nil(t, err)
	doTestField(t, cfg, f, &expected{
		private:            false,
		asyncAccessor:      false,
		tsFieldName:        "name",
		tsBuilderFieldName: "name",
		tsPublicAPIName:    "name",
		tsType:             "string | null",
		tsFieldType:        "string | null",
		tsBuilderType:      "string | null",
		tsBuilderUnionType: "string | null",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImportsForceOptional: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		fieldTypeType:   &enttype.NullableStringType{},
		tsFieldTypeType: &enttype.NullableStringType{},
	})
}

func TestNullableFieldOnEntLoadNoFieldPrivacy(t *testing.T) {
	cfg := &onEntLoadConfig{}
	f, err := newFieldFromInputTest(cfg, &input.Field{
		Name:     "name",
		Nullable: true,
		Type: &input.FieldType{
			DBType: input.String,
		},
	})
	require.Nil(t, err)
	doTestField(t, cfg, f, &expected{
		private:            false,
		asyncAccessor:      false,
		tsFieldName:        "name",
		tsBuilderFieldName: "name",
		tsPublicAPIName:    "name",
		tsType:             "string | null",
		tsFieldType:        "string | null",
		tsBuilderType:      "string | null",
		tsBuilderUnionType: "string | null",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImportsForceOptional: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		fieldTypeType:   &enttype.NullableStringType{},
		tsFieldTypeType: &enttype.NullableStringType{},
	})
}

func TestNullableJSONBAsListFieldOnDemand(t *testing.T) {
	cfg := &onDemandConfig{}
	f, err := newFieldFromInputTest(cfg, &input.Field{
		Name:     "foo",
		Nullable: true,
		Type: &input.FieldType{
			DBType: input.JSONB,
			ListElemType: &input.FieldType{
				DBType: input.JSONB,
			},
			Type:        "Foo",
			GraphQLType: "Foo",
			UnionFields: []*input.Field{
				{
					Name: "bar",
					Type: &input.FieldType{
						DBType: input.String,
					},
				},
				{
					Name: "baz",
					Type: &input.FieldType{
						DBType: input.Int,
					},
				},
			},
		},
		HasFieldPrivacy: true,
	})
	require.Nil(t, err)
	doTestField(t, cfg, f, &expected{
		private:            true,
		asyncAccessor:      true,
		tsFieldName:        "_foo",
		tsBuilderFieldName: "foo",
		tsPublicAPIName:    "foo",
		tsType:             "Foo[] | null",
		tsFieldType:        "Foo[] | null",
		tsBuilderType:      "Foo[] | null",
		tsBuilderUnionType: "Foo[] | null",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLList"),
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewLocalGraphQLEntImportPath("Foo"),
		},
		graphqlMutationImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLList"),
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewLocalGraphQLInputEntImportPath("Foo"),
		},
		graphqlMutationImportsForceOptional: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLList"),
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewLocalGraphQLInputEntImportPath("Foo"),
		},
		fieldTypeType: &enttype.NullableArrayListType{
			ElemType: &enttype.JSONBType{
				CommonJSONType: enttype.CommonJSONType{
					CustomTsInterface:      "Foo",
					CustomGraphQLInterface: "Foo",
					ImportType: &tsimport.ImportPath{
						Import: "Foo",
					},
					UnionFields: []*input.Field{
						{
							Name: "bar",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "baz",
							Type: &input.FieldType{
								DBType: input.Int,
							},
						},
					},
				},
			},
			ElemDBTypeNotArray: true,
		},
		tsFieldTypeType: &enttype.NullableArrayListType{
			ElemType: &enttype.JSONBType{
				CommonJSONType: enttype.CommonJSONType{
					CustomTsInterface:      "Foo",
					CustomGraphQLInterface: "Foo",
					ImportType: &tsimport.ImportPath{
						Import: "Foo",
					},
					UnionFields: []*input.Field{
						{
							Name: "bar",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "baz",
							Type: &input.FieldType{
								DBType: input.Int,
							},
						},
					},
				},
			},
			ElemDBTypeNotArray: true,
		},
	})
}

func TestNonNullableFieldDelayedFetch(t *testing.T) {
	cfg := &onDemandConfig{}
	f, err := newFieldFromInputTest(cfg, &input.Field{
		Name: "name",
		Type: &input.FieldType{
			DBType: input.String,
		},
		FetchOnDemand: true,
	})
	require.Nil(t, err)
	doTestField(t, cfg, f, &expected{
		private:            true,
		asyncAccessor:      true,
		tsFieldName:        "_name",
		tsBuilderFieldName: "name",
		tsPublicAPIName:    "name",
		tsType:             "string | null",
		tsFieldType:        "string | null | undefined",
		tsBuilderType:      "string",
		tsBuilderUnionType: "string | null",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImportsForceOptional: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		fieldTypeType:   &enttype.StringType{},
		tsFieldTypeType: &enttype.StringType{},
	})
}

func TestNullableFieldDelayedFetch(t *testing.T) {
	cfg := &onDemandConfig{}
	f, err := newFieldFromInputTest(cfg, &input.Field{
		Name: "name",
		Type: &input.FieldType{
			DBType: input.String,
		},
		Nullable:      true,
		FetchOnDemand: true,
	})
	require.Nil(t, err)
	doTestField(t, cfg, f, &expected{
		private:            true,
		asyncAccessor:      true,
		tsFieldName:        "_name",
		tsBuilderFieldName: "name",
		tsPublicAPIName:    "name",
		tsType:             "string | null",
		tsFieldType:        "string | null | undefined",
		tsBuilderType:      "string | null",
		tsBuilderUnionType: "string | null",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImports: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImportsForceOptional: []*tsimport.ImportPath{
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		fieldTypeType:   &enttype.NullableStringType{},
		tsFieldTypeType: &enttype.NullableStringType{},
	})
}

func TestNonNullableListFieldDelayedFetch(t *testing.T) {
	cfg := &onDemandConfig{}
	f, err := newFieldFromInputTest(cfg, &input.Field{
		Name: "list",
		Type: &input.FieldType{
			DBType: input.List,
			ListElemType: &input.FieldType{
				DBType: input.String,
			},
		},
		FetchOnDemand: true,
	})
	require.Nil(t, err)
	doTestField(t, cfg, f, &expected{
		private:            true,
		asyncAccessor:      true,
		tsFieldName:        "_list",
		tsBuilderFieldName: "list",
		tsPublicAPIName:    "list",
		tsType:             "string[] | null",
		tsFieldType:        "string[] | null | undefined",
		tsBuilderType:      "string[]",
		tsBuilderUnionType: "string[] | null",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLList"),
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLClassImportPath("GraphQLList"),
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImportsForceOptional: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLList"),
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		fieldTypeType: &enttype.ArrayListType{
			ElemType: &enttype.StringType{},
		},
		tsFieldTypeType: &enttype.ArrayListType{
			ElemType: &enttype.StringType{},
		},
	})
}

func TestNullableListFieldDelayedFetch(t *testing.T) {
	cfg := &onDemandConfig{}
	f, err := newFieldFromInputTest(cfg, &input.Field{
		Name: "list",
		Type: &input.FieldType{
			DBType: input.List,
			ListElemType: &input.FieldType{
				DBType: input.String,
			},
		},
		Nullable:      true,
		FetchOnDemand: true,
	})
	require.Nil(t, err)
	doTestField(t, cfg, f, &expected{
		private:            true,
		asyncAccessor:      true,
		tsFieldName:        "_list",
		tsBuilderFieldName: "list",
		tsPublicAPIName:    "list",
		tsType:             "string[] | null",
		tsFieldType:        "string[] | null | undefined",
		tsBuilderType:      "string[] | null",
		tsBuilderUnionType: "string[] | null",
		graphqlImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLList"),
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImports: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLList"),
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		graphqlMutationImportsForceOptional: []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLList"),
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			tsimport.NewGQLImportPath("GraphQLString"),
		},
		fieldTypeType: &enttype.NullableArrayListType{
			ElemType: &enttype.StringType{},
		},
		tsFieldTypeType: &enttype.NullableArrayListType{
			ElemType: &enttype.StringType{},
		},
	})
}

func doTestField(t *testing.T, cfg codegenapi.Config, f *Field, exp *expected) {
	assert.Equal(t, exp.private, f.Private(cfg))
	assert.Equal(t, exp.asyncAccessor, f.HasAsyncAccessor(cfg))
	assert.Equal(t, exp.tsFieldName, f.TsFieldName(cfg))
	assert.Equal(t, exp.tsBuilderFieldName, f.TsBuilderFieldName())
	assert.Equal(t, exp.tsPublicAPIName, f.TSPublicAPIName())
	assert.Equal(t, exp.tsType, f.TsType())
	assert.Equal(t, exp.tsFieldType, f.TsFieldType(cfg))
	assert.Equal(t, exp.tsBuilderType, f.TsBuilderType(cfg))
	assert.Equal(t, exp.tsBuilderUnionType, f.TsBuilderUnionType(cfg))
	assert.Equal(t, exp.graphqlImports, f.GetTSGraphQLTypeForFieldImports(false))
	assert.Equal(t, exp.graphqlMutationImportsForceOptional, f.GetTSMutationGraphQLTypeForFieldImports(true, true))
	assert.Equal(t, exp.fieldTypeType, f.GetFieldType())
	assert.Equal(t, exp.tsFieldTypeType, f.GetTSFieldType(cfg))

	if exp.optionalInAction && exp.requiredInAction {
		require.Fail(t, "cannot have both optionalInAction && requiredInAction")
	}
	if exp.optionalInAction {
		f = cloneForTest(t, f, Optional())
	}
	if exp.requiredInAction {
		f = cloneForTest(t, f, Required())
	}

	assert.Equal(t, exp.graphqlMutationImports, f.GetTSMutationGraphQLTypeForFieldImports(exp.optionalInAction, true))
}

func cloneForTest(t *testing.T, f *Field, opts ...Option) *Field {
	f2, err := f.Clone(opts...)
	require.Nil(t, err)
	return f2
}
