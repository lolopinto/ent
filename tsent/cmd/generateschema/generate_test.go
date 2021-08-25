package generateschema

import (
	"errors"
	"strconv"
	"strings"
	"testing"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/kv"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type expField struct {
	input.Field

	expFieldObjectCall string

	// things to eventually support in API. have to consider the following:
	// return new Date();
	// return "DEACTIVATED";
	// return builder.viewer.viewerID
	// return input.fooID
	// for first two, have to differentiate between quotes vs not
	// for last two maybe something like defaultValueOnCreate:$(builder.viewer.viewerID) or defaultValueOnCreate:$(input.startTime)
	// DefaultValueOnCreate string
	// DefaultValueOnEdit   string

	// don't support FieldEdge because you can't specify edges here...
}

type testcase struct {
	fields      string
	result      []*expField
	expectedErr error
}

func getExpField(f *input.Field, expFieldObjectCall string) *expField {
	return &expField{
		*f,
		expFieldObjectCall,
	}
}

func TestParse(t *testing.T) {
	tests := map[string]testcase{
		"basic": {
			fields: "foo:string bar:email baz:password foo2:int hello:bool",
			result: []*expField{
				getExpField(
					&input.Field{
						Name:   "foo",
						Import: &enttype.StringImport{},
					},
					"{name: \"foo\"}",
				),
				getExpField(
					&input.Field{
						Name:   "bar",
						Import: &enttype.EmailImport{},
					},
					"{name: \"bar\"}",
				),
				getExpField(
					&input.Field{
						Name:   "baz",
						Import: &enttype.PasswordImport{},
					},
					"{name: \"baz\"}",
				),
				getExpField(
					&input.Field{
						Name:   "foo2",
						Import: &enttype.IntImport{},
					},
					"{name: \"foo2\"}",
				),
				getExpField(
					&input.Field{
						Name:   "hello",
						Import: &enttype.BoolImport{},
					},
					"{name: \"hello\"}",
				),
			},
		},
		"different case + aliases": {
			fields: "foo:String bar:EMAIL baz:PasSWORD foo2:INTEGER hello:BOOLEAN",
			result: []*expField{
				getExpField(
					&input.Field{
						Name:   "foo",
						Import: &enttype.StringImport{},
					},
					"{name: \"foo\"}",
				),
				getExpField(
					&input.Field{
						Name:   "bar",
						Import: &enttype.EmailImport{},
					},
					"{name: \"bar\"}",
				),
				getExpField(
					&input.Field{
						Name:   "baz",
						Import: &enttype.PasswordImport{},
					},
					"{name: \"baz\"}",
				),
				getExpField(
					&input.Field{
						Name:   "foo2",
						Import: &enttype.IntImport{},
					},
					"{name: \"foo2\"}",
				),
				getExpField(
					&input.Field{
						Name:   "hello",
						Import: &enttype.BoolImport{},
					},
					"{name: \"hello\"}",
				),
			},
		},
		"unknown type": {
			fields:      "bar:string foo:unknown",
			expectedErr: errors.New("unknown is not a valid type for a field"),
		},
		"invalid format": {
			fields:      "bar:string foo",
			expectedErr: errors.New("invalid field format foo. needs to be of the form field:type"),
		},
		"duplicate field": {
			fields:      "bar:string bar:int",
			expectedErr: errors.New("field bar in schema more than once"),
		},
		"other keys": {
			fields: "foo:string:index bar:email:unique baz:password:private:hideFromGraphQL foo2:int:nullable hello:bool",
			result: []*expField{
				getExpField(
					&input.Field{
						Name:   "foo",
						Import: &enttype.StringImport{},
						Index:  true,
					},
					"{name: \"foo\", index: true}",
				),
				getExpField(
					&input.Field{
						Name:   "bar",
						Import: &enttype.EmailImport{},
						Unique: true,
					},
					"{name: \"bar\", unique: true}",
				),
				getExpField(
					&input.Field{
						Name:            "baz",
						Import:          &enttype.PasswordImport{},
						Private:         true,
						HideFromGraphQL: true,
					},
					"{name: \"baz\", private: true, hideFromGraphQL: true}",
				),
				getExpField(
					&input.Field{
						Name:     "foo2",
						Import:   &enttype.IntImport{},
						Nullable: true,
					},
					"{name: \"foo2\", nullable: true}",
				),
				getExpField(
					&input.Field{
						Name:   "hello",
						Import: &enttype.BoolImport{},
					},
					"{name: \"hello\"}",
				),
			},
		},
		"invalid other key": {
			fields:      "foo:string:index bar:email:unique baz:password:invalid foo2:int:nullable hello:bool",
			expectedErr: errors.New("invalid key invalid in field format"),
		},
		"complex other keys": {
			fields: "foo;string;serverDefault:bar bar:email:unique accountId;uuid;foreignKey:{schema:User;column:id};storageKey:user_id;defaultToViewerOnCreate",
			result: []*expField{
				getExpField(
					&input.Field{
						Name:          "foo",
						Import:        &enttype.StringImport{},
						ServerDefault: "bar",
					},
					"{name: \"foo\", serverDefault: \"bar\"}",
				),
				getExpField(
					&input.Field{
						Name:   "bar",
						Import: &enttype.EmailImport{},
						Unique: true,
					},
					"{name: \"bar\", unique: true}",
				),
				getExpField(
					&input.Field{
						Name:   "accountId",
						Import: &enttype.UUIDImport{},
						ForeignKey: &input.ForeignKey{
							Schema: "User",
							Column: "id",
						},
						DefaultToViewerOnCreate: true,
						StorageKey:              "user_id",
					},
					"{name: \"accountId\", defaultToViewerOnCreate: true, storageKey: \"user_id\", foreignKey: {schema: \"User\", column: \"id\"}}",
				),
			},
		},
	}

	for k, v := range tests {
		t.Run(k, func(t *testing.T) {
			fields := strings.Split(v.fields, " ")
			res, err := parseFields(fields)
			if v.expectedErr == nil {
				require.Nil(t, err)

				testFields(t, v.result, res)
			} else {
				require.NotNil(t, err)
				require.Equal(t, err.Error(), v.expectedErr.Error())
			}
		})
	}
}

func testFields(t *testing.T, exp []*expField, fields []*input.Field) {
	require.Equal(t, len(exp), len(fields))
	for i, expF := range exp {
		f := fields[i]
		require.Equal(t, expF.Name, f.Name, f.Name)
		assert.Equal(t, expF.Import, f.Import, f.Name)
		assert.Equal(t, expF.Unique, f.Unique, f.Name)
		assert.Equal(t, expF.PrimaryKey, f.PrimaryKey, f.Name)
		assert.Equal(t, expF.Index, f.Index, f.Name)
		assert.Equal(t, expF.Nullable, f.Nullable, f.Name)
		assert.Equal(t, expF.Private, f.Private, f.Name)
		assert.Equal(t, expF.HideFromGraphQL, f.HideFromGraphQL, f.Name)
		assert.Equal(t, expF.DefaultToViewerOnCreate, f.DefaultToViewerOnCreate, f.Name)
		assert.Equal(t, expF.ServerDefault, f.ServerDefault, f.Name)
		assert.Equal(t, expF.ForeignKey, f.ForeignKey, f.Name)
		assert.Equal(t, expF.StorageKey, f.StorageKey, f.Name)
		assert.Equal(t, expF.GraphQLName, f.GraphQLName, f.Name)

		assert.Equal(t, expF.expFieldObjectCall, FieldObjectCall(f), f.Name)
	}
}

func TestEnumCodegenData(t *testing.T) {
	codepathInfo, err := codegen.NewCodePath("src/schema", "")
	require.Nil(t, err)

	c := NewEnumCodegenData(codepathInfo, "RequestStatus", "status", []string{"open", "pending", "closed"})

	testCodegenData(
		t,
		&CodegenData{
			Node:       "RequestStatus",
			EnumTable:  true,
			Implements: true,
			Base:       "Schema",
			DBRows: []kv.List{
				{
					kv.Pair{
						Key:   "status",
						Value: strconv.Quote("open"),
					},
				},
				{
					kv.Pair{
						Key:   "status",
						Value: strconv.Quote("pending"),
					},
				},
				{
					kv.Pair{
						Key:   "status",
						Value: strconv.Quote("closed"),
					},
				},
			},
		},
		c,
		// breaking out in separate arg because of type mismatch
		[]*expField{
			getExpField(
				&input.Field{

					Name:       "status",
					Import:     &enttype.StringImport{},
					PrimaryKey: true,
				},
				"{name: \"status\", primaryKey: true}",
			),
		},
	)
}

func testCodegenData(t *testing.T, exp, c *CodegenData, expFields []*expField) {
	assert.Equal(t, exp.Node, c.Node)
	assert.Equal(t, exp.EnumTable, c.EnumTable)
	assert.Equal(t, exp.Implements, c.Implements)
	assert.Equal(t, exp.Extends, c.Extends)
	assert.Equal(t, exp.Base, c.Base)

	require.Len(t, exp.Fields, 0)
	testFields(t, expFields, c.Fields)

	require.Len(t, c.DBRows, len(exp.DBRows))
	assert.Equal(t, exp.DBRows, c.DBRows)
}
