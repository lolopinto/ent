package generateschema

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/codepath"
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
	cfg, err := codegen.NewConfig("src/schema", "")
	require.Nil(t, err)

	c := NewEnumCodegenData(cfg, "RequestStatus", "status", []string{"open", "pending", "closed"})

	testCodegenData(
		t,
		&CodegenData{
			Node:       "RequestStatus",
			EnumTable:  true,
			Implements: true,
			Base:       "Schema",
			DBRows: kv.NewList(
				kv.NewObjectFromPairs(
					kv.Pair{
						Key:   "status",
						Value: strconv.Quote("open"),
					},
				),
				kv.NewObjectFromPairs(
					kv.Pair{
						Key:   "status",
						Value: strconv.Quote("pending"),
					},
				),
				kv.NewObjectFromPairs(
					kv.Pair{
						Key:   "status",
						Value: strconv.Quote("closed"),
					},
				),
			),
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

	require.Equal(t, c.DBRows.Len(), exp.DBRows.Len())
	assert.Equal(t, exp.DBRows, c.DBRows)
}

// doesn't test all the options but gets us there
func TestFieldObjectCall(t *testing.T) {
	f := input.Field{
		Name:       "accountID",
		StorageKey: "user_id",
		ForeignKey: &input.ForeignKey{
			Schema: "User",
			Column: "id",
		},
	}
	assert.Equal(
		t,
		fmt.Sprintf(
			"{name: %s, storageKey: %s, foreignKey: {schema: %s, column: %s}}",
			strconv.Quote("accountID"),
			strconv.Quote("user_id"),
			strconv.Quote("User"),
			strconv.Quote("id"),
		),
		FieldObjectCall(&f),
	)
}

func TestEdgeObjectCall(t *testing.T) {
	edge := &input.AssocEdge{
		Name:       "followers",
		SchemaName: "User",
		TableName:  "user_to_followers",
		InverseEdge: &input.InverseAssocEdge{
			Name: "followees",
		},
		EdgeActions: []*input.EdgeAction{
			{
				Operation:         ent.AddEdgeAction,
				CustomActionName:  "AddFollowersAction",
				CustomGraphQLName: "addFollowers",
				CustomInputName:   "AddFollowersInput",
			},
			{
				Operation:       ent.RemoveEdgeAction,
				HideFromGraphQL: true,
				ActionOnlyFields: []*input.ActionField{
					{
						Name:     "log",
						Type:     input.ActionTypeBoolean,
						Nullable: true,
					},
				},
			},
		},
	}
	o := EdgeObjectCall(edge)

	imps := o.GetImports()
	assert.Len(t, imps, 2)
	assert.Equal(t, imps[0], &kv.Import{
		ImportPath: codepath.SchemaPackage,
		Import:     "ActionOperation",
	})
	assert.Equal(t, imps[0], imps[1])

	assert.Equal(t,
		fmt.Sprintf(
			"{name: %s, schemaName: %s, tableName: %s, inverseEdge: {name: %s}, edgeActions: [{operation: %s, actionName: %s, graphQLName: %s, inputName: %s}, {operation: %s, hideFromGraphQL: true, actionOnlyFields: [{name: %s, type: %s, nullable: true}]}]}",
			strconv.Quote(edge.Name),
			strconv.Quote(edge.SchemaName),
			strconv.Quote(edge.TableName),
			strconv.Quote(edge.InverseEdge.Name),
			edge.EdgeActions[0].GetTSStringOperation(),
			strconv.Quote(edge.EdgeActions[0].CustomActionName),
			strconv.Quote(edge.EdgeActions[0].CustomGraphQLName),
			strconv.Quote(edge.EdgeActions[0].CustomInputName),
			edge.EdgeActions[1].GetTSStringOperation(),
			strconv.Quote("log"),
			strconv.Quote("Boolean"),
		),
		o.String(),
	)
}

func TestEdgeGroupObjectCall(t *testing.T) {
	g := &input.AssocEdgeGroup{
		Name:            "friendships",
		GroupStatusName: "friendshipStatus",
		NullStates:      []string{"canRequest", "cannotRequest"},
		NullStateFn:     "friendshipStatus",
		StatusEnums:     []string{"outgoingRequest"},
		AssocEdges: []*input.AssocEdge{
			{
				Name:       "outgoingRequest",
				SchemaName: "User",
				InverseEdge: &input.InverseAssocEdge{
					Name: "incomingRequest",
				},
			},
			{
				Name:       "friends",
				SchemaName: "User",
				Symmetric:  true,
			},
		},
		EdgeAction: &input.EdgeAction{
			Operation: ent.EdgeGroupAction,
			ActionOnlyFields: []*input.ActionField{
				{
					Name: "blah",
					Type: input.ActionTypeString,
				},
			},
		},
	}
	o := EdgeGroupObjectCall(g)
	imps := o.GetImports()
	assert.Len(t, imps, 1)
	assert.Equal(t, imps[0], &kv.Import{
		ImportPath: codepath.SchemaPackage,
		Import:     "ActionOperation",
	})

	assert.Equal(
		t,
		fmt.Sprintf(
			"{name: %s, groupStatusName: %s, assocEdges: %s, statusEnums: %s, nullStates: %s, nullStateFn: %s, edgeAction: %s}",
			strconv.Quote(g.Name),
			strconv.Quote(g.GroupStatusName),
			// assocEdges
			fmt.Sprintf(
				"[{name: %s, schemaName: %s, inverseEdge: {name: %s}}, {name: %s, schemaName: %s, symmetric: true}]",
				strconv.Quote("outgoingRequest"),
				strconv.Quote("User"),
				strconv.Quote("incomingRequest"),
				strconv.Quote("friends"),
				strconv.Quote("User"),
			),
			fmt.Sprintf("[%s]", strconv.Quote(g.StatusEnums[0])),
			fmt.Sprintf(
				"[%s, %s]",
				strconv.Quote(g.NullStates[0]),
				strconv.Quote(g.NullStates[1]),
			),
			strconv.Quote(g.NullStateFn),
			// edgeAction
			fmt.Sprintf(
				"{operation: %s, actionOnlyFields: [{name: %s, type: %s}]}",
				"ActionOperation.EdgeGroup",
				strconv.Quote("blah"),
				strconv.Quote("String"),
			),
		),
		o.String(),
	)
}

func TestActionCall(t *testing.T) {
	a := &input.Action{
		Operation:         ent.CreateAction,
		Fields:            []string{"name", "start_time"},
		CustomActionName:  "CreateFooAction",
		CustomGraphQLName: "fooCreate",
		CustomInputName:   "CreateFooInput",
		ActionOnlyFields: []*input.ActionField{
			{
				Name: "blah",
				Type: input.ActionTypeString,
			},
		},
	}

	o := ActionObjectCall(a)

	imps := o.GetImports()
	assert.Len(t, imps, 1)
	assert.Equal(t, imps[0], &kv.Import{
		ImportPath: codepath.SchemaPackage,
		Import:     "ActionOperation",
	})

	assert.Equal(t,
		fmt.Sprintf(
			"{operation: %s, fields: %s, actionName: %s, inputName: %s, graphQLName: %s, actionOnlyFields: [%s]}",
			"ActionOperation.Create",
			kv.NewListItemWithQuotedItems([]string{"name", "start_time"}).String(),
			strconv.Quote("CreateFooAction"),
			strconv.Quote("CreateFooInput"),
			strconv.Quote("fooCreate"),
			fmt.Sprintf(
				"{name: %s, type: %s}",
				strconv.Quote("blah"),
				strconv.Quote("String"),
			),
		),
		o.String(),
	)
}

func TestPkeyConstraintCall(t *testing.T) {
	c := &input.Constraint{
		Name:    "user_photos_pkey",
		Type:    input.PrimaryKeyConstraint,
		Columns: []string{"UserID", "PhotoID"},
	}

	o := ConstraintObjectCall(c)
	assert.Equal(
		t,
		fmt.Sprintf(
			"{name: %s, type: %s, columns: %s}",
			strconv.Quote(c.Name),
			"ConstraintType.PrimaryKey",
			kv.NewListItemWithQuotedItems([]string{"UserID", "PhotoID"}).String(),
		),
		o.String(),
	)
	imps := o.GetImports()
	assert.Len(t, imps, 1)
	assert.Equal(t, imps[0], &kv.Import{
		ImportPath: codepath.SchemaPackage,
		Import:     "ConstraintType",
	})
}

func TestFkeyConstraintCall(t *testing.T) {
	c := &input.Constraint{
		Name:    "photos_fkey",
		Type:    input.ForeignKeyConstraint,
		Columns: []string{"UserID"},
		ForeignKey: &input.ForeignKeyInfo{
			TableName: "users",
			Columns:   []string{"UserID"},
			OnDelete:  "RESTRICT",
		},
	}

	o := ConstraintObjectCall(c)
	assert.Equal(
		t,
		fmt.Sprintf(
			"{name: %s, type: %s, columns: %s, fkey: %s}",
			strconv.Quote(c.Name),
			"ConstraintType.ForeignKey",
			kv.NewListItemWithQuotedItems([]string{"UserID"}).String(),
			fmt.Sprintf(
				"{tableName: %s, columns: %s, ondelete: %s}",
				strconv.Quote(c.ForeignKey.TableName),
				kv.NewListItemWithQuotedItems(c.ForeignKey.Columns).String(),
				strconv.Quote(string(c.ForeignKey.OnDelete)),
			),
		),
		o.String(),
	)
	imps := o.GetImports()
	assert.Len(t, imps, 1)
	assert.Equal(t, imps[0], &kv.Import{
		ImportPath: codepath.SchemaPackage,
		Import:     "ConstraintType",
	})
}

func TestCheckConstraintCall(t *testing.T) {
	c := &input.Constraint{
		Name:      "price_check",
		Type:      input.CheckConstraint,
		Columns:   []string{"price"},
		Condition: "price > 10",
	}

	o := ConstraintObjectCall(c)
	assert.Equal(
		t,
		fmt.Sprintf(
			"{name: %s, type: %s, columns: %s, condition: %s}",
			strconv.Quote(c.Name),
			"ConstraintType.Check",
			kv.NewListItemWithQuotedItems([]string{"price"}).String(),
			strconv.Quote(c.Condition),
		),
		o.String(),
	)
	imps := o.GetImports()
	assert.Len(t, imps, 1)
	assert.Equal(t, imps[0], &kv.Import{
		ImportPath: codepath.SchemaPackage,
		Import:     "ConstraintType",
	})
}

func TestIndexCall(t *testing.T) {
	i := &input.Index{
		Name:    "unique_index",
		Columns: []string{"user_id", "email_address"},
		Unique:  true,
	}

	o := IndexObjectCall(i)

	assert.Equal(
		t,
		fmt.Sprintf(
			"{name: %s, columns: %s, unique: true}",
			strconv.Quote(i.Name),
			kv.NewListItemWithQuotedItems(i.Columns).String(),
		),
		o.String(),
	)
	assert.Len(t, o.GetImports(), 0)
}
