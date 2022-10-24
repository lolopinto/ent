package db

import (
	"fmt"
	"strconv"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/testingutils/testmodel"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIDColumn(t *testing.T) {
	col := getTestColumn("Account", "id", t)

	parts := []string{
		strconv.Quote("id"),
		"postgresql.UUID()",
		"nullable=False",
	}
	testColumn(t, col, "id", "id", "id", parts)

	constraint := getTestPrimaryKeyConstraint("Account", "id", t)
	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.PrimaryKeyConstraint(%s, name=%s)", strconv.Quote("id"), strconv.Quote("accounts_id_pkey")),
	)
}

func TestCreatedAtColumn(t *testing.T) {
	col := getTestColumn("Account", "createdAt", t)

	parts := []string{
		strconv.Quote("created_at"),
		"sa.TIMESTAMP()",
		"nullable=False",
	}
	testColumn(t, col, "created_at", "createdAt", "created_at", parts)
}

func TestUpdatedAtColumn(t *testing.T) {
	col := getTestColumn("Account", "updatedAt", t)

	parts := []string{
		strconv.Quote("updated_at"),
		"sa.TIMESTAMP()",
		"nullable=False",
	}
	testColumn(t, col, "updated_at", "updatedAt", "updated_at", parts)
}

func TestTableForNode(t *testing.T) {
	table := getTestTable("Account", t)

	expTableName := strconv.Quote("accounts")
	assert.Equal(
		t,
		expTableName,
		table.QuotedTableName,
		"invalid table name for table. expected %s, got %s",
		expTableName,
		table.QuotedTableName,
	)

	expCols := 11
	assert.Equal(
		t,
		expCols,
		len(table.Columns),
		"invalid number of columns for table generated. expected %d, got %d",
		expCols,
		len(table.Columns),
	)

	// 1 primary key, 1 unique, 1 index constraints expected
	testConstraints(t, table, 3)

	// 1 primary key, 1 foreign key constraint, 1 index expected
	table = getTestTable("Todo", t)
	testConstraints(t, table, 3)
}

func TestTablesFromSchema(t *testing.T) {
	// TODO
	t.Skip()
	schema := getTestSchema(t)
	require.Nil(t, schema.generateShemaTables())

	// accounts
	// events
	// todos
	// folders
	// edge_config
	// account_friendships_edges
	// account_folders_edge
	// account_todos__edge
	// event_creator_edges
	// event_rsvp_edges
	// folder_todo_edge

	expTables := 11
	assert.Equal(
		t,
		expTables,
		len(schema.Tables),
		"invalid number of tables in schema. expected %d, got %d",
		expTables,
		len(schema.Tables),
	)
}

func TestStringUserDefinedColumn(t *testing.T) {
	column := getTestColumn("Account", "FirstName", t)

	parts := []string{
		strconv.Quote("first_name"),
		"sa.Text()",
		"nullable=False",
	}
	testColumn(t, column, "first_name", "FirstName", "first_name", parts)
}

func TestNullableStringUserDefinedColumn(t *testing.T) {
	column := getTestColumn("Account", "Bio", t)

	parts := []string{
		strconv.Quote("bio"),
		"sa.Text()",
		"nullable=True",
	}
	testColumn(t, column, "bio", "Bio", "bio", parts)
}

func TestIntegerUserDefinedColumn(t *testing.T) {
	column := getTestColumn("Account", "NumberOfLogins", t)

	// also tests default values...
	parts := []string{
		strconv.Quote("number_of_logins"),
		"sa.Integer()",
		"nullable=False",
		"server_default='0'",
	}
	testColumn(t, column, "number_of_logins", "NumberOfLogins", "number_of_logins", parts)
}

func TestTimeUserDefinedColumn(t *testing.T) {
	column := getTestColumn("Account", "LastLoginAt", t)

	// this also tests overriden fields
	parts := []string{
		strconv.Quote("last_login_time"),
		"sa.TIMESTAMP()",
		"nullable=False",
	}
	testColumn(t, column, "last_login_time", "LastLoginAt", "last_login_time", parts)
}

func TestNullableTimeUserDefinedColumn(t *testing.T) {
	column := getTestColumn("Account", "DateOfBirth", t)

	parts := []string{
		strconv.Quote("date_of_birth"),
		"sa.TIMESTAMP()",
		"nullable=True",
	}
	testColumn(t, column, "date_of_birth", "DateOfBirth", "date_of_birth", parts)
}

func TestUniqueColumn(t *testing.T) {
	column := getTestColumn("Account", "PhoneNumber", t)

	parts := []string{
		strconv.Quote("phone_number"), // db field
		"sa.Text()",                   // db type
		"nullable=False",
	}
	testColumn(t, column, "phone_number", "PhoneNumber", "phone_number", parts)

	constraint := getTestUniqueKeyConstraint(t, "Account", "PhoneNumber")

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.UniqueConstraint(%s, name=%s)", strconv.Quote("phone_number"), strconv.Quote("accounts_unique_phone_number")),
	)
}

func TestIndexedColumn(t *testing.T) {
	column := getTestColumn("Account", "LastName", t)

	parts := []string{
		strconv.Quote("last_name"), // db field
		"sa.Text()",                // db type
		"nullable=False",
	}
	testColumn(t, column, "last_name", "LastName", "last_name", parts)

	constraint := getTestIndexedConstraint("Account", "LastName", t)

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.Index(%s, %s)", strconv.Quote("accounts_last_name_idx"), strconv.Quote("last_name")),
	)
}

func TestForeignKeyColumn(t *testing.T) {
	column := getTestColumn("Todo", "AccountID", t)

	parts := []string{
		strconv.Quote("account_id"), // db field
		"postgresql.UUID()",         // db type
		"nullable=False",
	}
	testColumn(t, column, "account_id", "AccountID", "account_id", parts)

	constraint := getTestForeignKeyConstraint(t, "Todo", "AccountID")
	testConstraint(
		t,
		constraint,
		fmt.Sprintf(
			"sa.ForeignKeyConstraint([%s], [%s], name=%s, ondelete=%s)", // ForeignKey expected by alembic to generate
			strconv.Quote("account_id"),                                 // column foreign key is on
			strconv.Quote("accounts.id"),                                // field foreign key is on
			strconv.Quote("todos_account_id_fkey"),                      // name of foreignkey field
			strconv.Quote("CASCADE"),                                    // ondelete cascade
		),
	)
}

func TestGeneratedEdgeConfigTable(t *testing.T) {
	// AccountConfig, edge called Friends,
	table := getTestTableByName("assoc_edge_config", t)

	assert.Equal(
		t,
		7,
		len(table.Columns),
		"invalid number of columns for table generated. expected %d, got %d",
		7,
		len(table.Columns),
	)

	// 1 primary key constraint for the edge_type field
	// 1 foreign key constraint for the inverse_edge_type field
	testConstraints(t, table, 3)
}

func TestEdgeNameEdgeConfigColumn(t *testing.T) {
	col := getColumnFromNamedTable("edge_name", "assoc_edge_config", t)

	parts := []string{
		strconv.Quote("edge_name"),
		"sa.Text()",
		"nullable=False",
	}
	testColumn(t, col, "edge_name", "EdgeName", "edge_name", parts)
}

func TestSymmetricEdgeConfigColumn(t *testing.T) {
	col := getColumnFromNamedTable("symmetric_edge", "assoc_edge_config", t)

	parts := []string{
		strconv.Quote("symmetric_edge"),
		"sa.Boolean()",
		"nullable=False",
		"server_default='false'",
	}
	testColumn(t, col, "symmetric_edge", "SymmetricEdge", "symmetric_edge", parts)
}

func TestInverseEdgeTypeConfigColumn(t *testing.T) {
	col := getColumnFromNamedTable("inverse_edge_type", "assoc_edge_config", t)

	parts := []string{
		strconv.Quote("inverse_edge_type"),
		"postgresql.UUID()",
		"nullable=True",
	}
	testColumn(t, col, "inverse_edge_type", "InverseEdgeType", "inverse_edge_type", parts)
}

func TestEdgeTableEdgeConfigColumn(t *testing.T) {
	col := getColumnFromNamedTable("edge_table", "assoc_edge_config", t)

	parts := []string{
		strconv.Quote("edge_table"),
		"sa.Text()",
		"nullable=False",
	}
	testColumn(t, col, "edge_table", "EdgeTable", "edge_table", parts)
}

func TestPrimaryKeyConstraintInEdgeConfigTable(t *testing.T) {
	table := getTestTableByName("assoc_edge_config", t)

	testConstraints(t, table, 3)
	constraint := getTestPrimaryKeyConstraintFromTable(t, table, "EdgeType")

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.PrimaryKeyConstraint(%s, name=%s)",
			strconv.Quote("edge_type"),
			strconv.Quote("assoc_edge_config_edge_type_pkey"),
		),
	)
}

func TestForeignKeyConstraintInEdgeConfigTable(t *testing.T) {
	table := getTestTableByName("assoc_edge_config", t)

	testConstraints(t, table, 3)
	constraint := getTestForeignKeyConstraintFromTable(t, table, "InverseEdgeType")

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.ForeignKeyConstraint([%s], [%s], name=%s, ondelete=%s)",
			strconv.Quote("inverse_edge_type"),
			strconv.Quote("assoc_edge_config.edge_type"),
			strconv.Quote("assoc_edge_config_inverse_edge_type_fkey"),
			strconv.Quote("RESTRICT"),
		),
	)
}

func TestGeneratedTableForEdge(t *testing.T) {
	// AccountConfig, edge called Folders
	table := getTestTableByName("account_folders_edges", t)

	testEdgeTable(t, table)
}

func TestGeneratedTableForUniqueEdge(t *testing.T) {
	table := getTestTableByName("event_creator_edges", t)
	testEdgeTable(t, table)

	// get constraint which matches multiple columns
	constraint := getTestUniqueKeyConstraintFromTable(t, table, "ID1", "EdgeType")
	testConstraint(
		t,
		constraint,
		fmt.Sprintf(
			"sa.UniqueConstraint(%s, %s, name=%s)",
			strconv.Quote("id1"),
			strconv.Quote("edge_type"),
			strconv.Quote("event_creator_edges_unique_id1_edge_type"),
		),
	)
}

func TestID1EdgeColumn(t *testing.T) {
	col := getEdgeColumn("id1", t)

	parts := []string{
		strconv.Quote("id1"),
		"postgresql.UUID()",
		"nullable=False",
	}
	testColumn(t, col, "id1", "ID1", "id1", parts)
}

func TestID1TypeEdgeColumn(t *testing.T) {
	col := getEdgeColumn("id1_type", t)

	parts := []string{
		strconv.Quote("id1_type"),
		"sa.Text()",
		"nullable=False",
	}
	testColumn(t, col, "id1_type", "ID1Type", "id1_type", parts)
}

func TestEdgeTypeEdgeColumn(t *testing.T) {
	col := getEdgeColumn("edge_type", t)

	parts := []string{
		strconv.Quote("edge_type"),
		"postgresql.UUID()",
		"nullable=False",
	}
	testColumn(t, col, "edge_type", "EdgeType", "edge_type", parts)
}

func TestID2EdgeColumn(t *testing.T) {
	col := getEdgeColumn("id2", t)

	parts := []string{
		strconv.Quote("id2"),
		"postgresql.UUID()",
		"nullable=False",
	}
	testColumn(t, col, "id2", "ID2", "id2", parts)
}

func TestID2TypeEdgeColumn(t *testing.T) {
	col := getEdgeColumn("id2_type", t)

	parts := []string{
		strconv.Quote("id2_type"),
		"sa.Text()",
		"nullable=False",
	}
	testColumn(t, col, "id2_type", "ID2Type", "id2_type", parts)
}

func TestTimeEdgeColumn(t *testing.T) {
	col := getEdgeColumn("time", t)

	parts := []string{
		strconv.Quote("time"),
		"sa.TIMESTAMP()",
		"nullable=False",
	}
	table := getTestTableByName("account_folders_edges", t)

	constraint := getTestIndexedConstraintFromTable(t, table, "Time")
	testColumn(t, col, "time", "Time", "time", parts)

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.Index(%s, %s)", strconv.Quote("account_folders_edges_time_idx"), strconv.Quote("time")),
	)
}

func TestDataEdgeColumn(t *testing.T) {
	col := getEdgeColumn("data", t)

	parts := []string{
		strconv.Quote("data"),
		"sa.Text()",
		"nullable=True",
	}
	testColumn(t, col, "data", "Data", "data", parts)
}

func TestSimpleEdge(t *testing.T) {
	edge := getEdgeByName("AccountToTodosAssocEdge", t)
	expectedParts := map[string]string{
		"edge_name":         strconv.Quote("AccountToTodosAssocEdge"),
		"edge_type":         "1", // it checks that real uuid instead
		"edge_table":        strconv.Quote("account_todos_assoc_edges"),
		"symmetric_edge":    "False",
		"inverse_edge_type": "None",
	}
	testEdgeInSchema(t, edge, expectedParts)
}

func TestSymmetricEdge(t *testing.T) {
	edge := getEdgeByName("AccountToFriendsEdge", t)
	expectedParts := map[string]string{
		"edge_name": strconv.Quote("AccountToFriendsEdge"),
		"edge_type": "1", // it checks that real uuid instead
		// part of an assoc_group...
		"edge_table":        strconv.Quote("account_friendships_edges"),
		"symmetric_edge":    "True",
		"inverse_edge_type": "None",
	}
	testEdgeInSchema(t, edge, expectedParts)
}

func TestInverseEdge(t *testing.T) {
	edge := getEdgeByName("AccountToFriendRequestsEdge", t)
	expectedParts := map[string]string{
		"edge_name": strconv.Quote("AccountToFriendRequestsEdge"),
		"edge_type": "1", // it checks that real uuid instead
		// part of an assoc_group...
		"edge_table":        strconv.Quote("account_friendships_edges"),
		"symmetric_edge":    "False",
		"inverse_edge_type": "1",
	}
	testEdgeInSchema(t, edge, expectedParts)

	edge2 := getEdgeByName("AccountToFriendRequestsReceivedEdge", t)
	expectedParts2 := map[string]string{
		"edge_name":         strconv.Quote("AccountToFriendRequestsReceivedEdge"),
		"edge_type":         "1", // it checks that real uuid instead
		"edge_table":        strconv.Quote("account_friendships_edges"),
		"symmetric_edge":    "False",
		"inverse_edge_type": "1",
	}
	testEdgeInSchema(t, edge2, expectedParts2)
}

func TestEnumType(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"Request": {
					Fields: []*input.Field{
						{
							Name:       "id",
							PrimaryKey: true,
							Type: &input.FieldType{
								DBType: input.UUID,
							},
						},
						{
							Name: "Status",
							Type: &input.FieldType{
								DBType:      input.Enum,
								Values:      []string{"OPEN", "PENDING", "CLOSED"},
								Type:        "RequestStatus",
								GraphQLType: "RequestStatus",
							},
						},
					},
				},
			},
		},
	)

	col := getTestColumnFromSchema(t, dbSchema, "requests", "status")

	testColumn(t, col, "status", "Status", "status", []string{
		strconv.Quote("status"),
		fmt.Sprintf(
			"postgresql.ENUM(%s, %s, %s, name=%s)",
			strconv.Quote("OPEN"),
			strconv.Quote("PENDING"),
			strconv.Quote("CLOSED"),
			strconv.Quote("request_status"),
		),
		"nullable=False",
	})
}

func TestNullableEnumType(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"Request": {
					Fields: []*input.Field{
						{
							Name:       "id",
							PrimaryKey: true,
							Type: &input.FieldType{
								DBType: input.UUID,
							},
						},
						{
							Name:     "Status",
							Nullable: true,
							Type: &input.FieldType{
								DBType:      input.Enum,
								Values:      []string{"OPEN", "PENDING", "CLOSED"},
								Type:        "Status",
								GraphQLType: "Status",
							},
						},
					},
				},
			},
		},
	)

	col := getTestColumnFromSchema(t, dbSchema, "requests", "status")

	testColumn(t, col, "status", "Status", "status", []string{
		strconv.Quote("status"),
		fmt.Sprintf(
			"postgresql.ENUM(%s, %s, %s, name=%s)",
			strconv.Quote("OPEN"),
			strconv.Quote("PENDING"),
			strconv.Quote("CLOSED"),
			// in this case TypeScript Type is Status and we're taking the enum type based on that
			strconv.Quote("status"),
		),
		"nullable=True",
	})
}

func TestIntEnum(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"Request": {
					Fields: []*input.Field{
						{
							Name:       "id",
							PrimaryKey: true,
							Type: &input.FieldType{
								DBType: input.UUID,
							},
						},
						{
							Name: "Status",
							Type: &input.FieldType{
								DBType: input.IntEnum,
								IntEnumMap: map[string]int{
									"OPEN":    1,
									"PENDING": 2,
									"CLOSED":  3,
								},
								Type:        "RequestStatus",
								GraphQLType: "RequestStatus",
							},
						},
					},
				},
			},
		},
	)

	col := getTestColumnFromSchema(t, dbSchema, "requests", "status")

	testColumn(t, col, "status", "Status", "status", []string{
		strconv.Quote("status"),
		"sa.Integer()",
		"nullable=False",
	})
}

func TestNullableIntEnum(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"Request": {
					Fields: []*input.Field{
						{
							Name:       "id",
							PrimaryKey: true,
							Type: &input.FieldType{
								DBType: input.UUID,
							},
						},
						{
							Name:     "Status",
							Nullable: true,
							Type: &input.FieldType{
								DBType:      input.IntEnum,
								Type:        "Status",
								GraphQLType: "Status",
								IntEnumMap: map[string]int{
									"OPEN":    1,
									"PENDING": 2,
									"CLOSED":  3,
								},
							},
						},
					},
				},
			},
		},
	)

	col := getTestColumnFromSchema(t, dbSchema, "requests", "status")

	testColumn(t, col, "status", "Status", "status", []string{
		strconv.Quote("status"),
		"sa.Integer()",
		"nullable=True",
	})
}

func TestEnumTableInSchema(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"Role": {
					EnumTable: true,
					Fields: []*input.Field{
						{
							Name:       "role",
							PrimaryKey: true,
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "random",
							Type: &input.FieldType{
								DBType: input.Int,
							},
						},
					},
					DBRows: []map[string]interface{}{
						{
							"role":   "admin",
							"random": 1,
						},
						{
							"role":   "member",
							"random": 2,
						},
						{
							"role":   "archived_member",
							"random": 3,
						},
						{
							"role":   "super_admin",
							"random": 4,
						},
						{
							"role":   "owner",
							"random": 5,
						},
					},
				},
			},
		},
	)

	templateData, err := dbSchema.getSchemaForTemplate()
	require.Nil(t, err)

	assert.Len(t, templateData.Data, 1)
	data := templateData.Data[0]

	roles := []string{
		"admin",
		"member",
		"archived_member",
		"super_admin",
		"owner",
	}
	var rows []string
	for idx, role := range roles {
		// testing with an int to confirm that json.marshall mostly works...
		// TODO going to need to test for all kinds of types eventually
		// but it should work for basic types: string, int, float, bool etc
		rows = append(rows, fmt.Sprintf("{'random': %d, 'role': %s}", idx+1, strconv.Quote(role)))
	}
	assert.Equal(t, data.TableName, "roles")
	assert.Equal(t, data.Pkeys, fmt.Sprintf("[%s]", strconv.Quote("role")))
	assert.Equal(t, data.Rows, rows)

	table := getTestEnumTableFromSchema("Role", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 1)

	testConstraint(
		t,
		constraints[0],
		fmt.Sprintf("sa.PrimaryKeyConstraint(%s, name=%s)", strconv.Quote("role"), strconv.Quote("roles_role_pkey")),
	)
}

func TestMultiColumnPrimaryKey(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"UserPhoto": {
					Fields: []*input.Field{
						{
							Name: "UserID",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
						},
						{
							Name: "PhotoID",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
						},
					},
					Constraints: []*input.Constraint{
						{
							Name:    "user_photos_pkey",
							Type:    input.PrimaryKeyConstraint,
							Columns: []string{"UserID", "PhotoID"},
						},
					},
				},
			},
		})

	table := getTestTableFromSchema("UserPhoto", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 1)

	testConstraint(
		t,
		constraints[0],
		fmt.Sprintf("sa.PrimaryKeyConstraint(%s, %s, name=%s)", strconv.Quote("user_id"), strconv.Quote("photo_id"), strconv.Quote("user_photos_pkey")),
	)
}

func TestMultiColumnUniqueConstraint(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "firstName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "lastName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
					},
				},
				"Contact": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "firstName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "lastName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "emailAddress",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "userID",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							ForeignKey: &input.ForeignKey{
								Schema: "User",
								Column: "id",
							},
						},
					},
					Constraints: []*input.Constraint{
						{
							Name:    "contacts_unique_email",
							Type:    input.UniqueConstraint,
							Columns: []string{"emailAddress", "userID"},
						},
					},
				},
			},
		})

	table := getTestTableFromSchema("Contact", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 4)

	constraint := getTestUniqueKeyConstraintFromTable(t, table, "emailAddress", "userID")

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.UniqueConstraint(%s, %s, name=%s)", strconv.Quote("email_address"), strconv.Quote("user_id"), strconv.Quote("contacts_unique_email")),
	)
}

func TestMultiColumnForeignKey(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "firstName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "lastName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "emailAddress",
							Type: &input.FieldType{
								DBType: input.String,
							},
							Unique: true,
						},
					},
					Constraints: []*input.Constraint{
						{
							Name:    "users_unique",
							Type:    input.UniqueConstraint,
							Columns: []string{"id", "emailAddress"},
						},
					},
				},
				"Contact": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "firstName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "lastName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "emailAddress",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "userID",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
						},
					},
					Constraints: []*input.Constraint{
						{
							Name:    "contacts_user_fkey",
							Type:    input.ForeignKeyConstraint,
							Columns: []string{"userID", "emailAddress"},
							ForeignKey: &input.ForeignKeyInfo{
								TableName: "users",
								OnDelete:  input.Cascade,
								Columns:   []string{"id", "emailAddress"},
							},
						},
					},
				},
			},
		})

	table := getTestTableFromSchema("Contact", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 2)

	constraint := getTestForeignKeyConstraintFromTable(t, table, "userID", "emailAddress")

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.ForeignKeyConstraint([%s,%s], [%s,%s], name=%s, ondelete=%s)",
			strconv.Quote("user_id"),
			strconv.Quote("email_address"),
			strconv.Quote("users.id"),
			strconv.Quote("users.email_address"),
			strconv.Quote("contacts_user_fkey"),
			strconv.Quote("CASCADE"),
		),
	)
}

func TestCheckConstraint(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"Item": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "price",
							Type: &input.FieldType{
								DBType: input.Float,
							},
						},
						{
							Name: "discount_price",
							Type: &input.FieldType{
								DBType: input.Float,
							},
						},
					},
					Constraints: []*input.Constraint{
						{
							Name:      "item_positive_price",
							Type:      input.CheckConstraint,
							Condition: "price > 0",
						},
						{
							Name:      "item_positive_discount_price",
							Type:      input.CheckConstraint,
							Condition: "discount_price > 0",
						},
						{
							Name:      "item_price_greater_than_discount",
							Type:      input.CheckConstraint,
							Condition: "price > discount_price",
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("Item", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 4)

	// get first Check constraint
	constraint := constraints[1]
	cConstraint, ok := constraint.(*checkConstraint)
	require.True(t, ok)

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.CheckConstraint(%s, %s)",
			strconv.Quote(cConstraint.condition),
			strconv.Quote(cConstraint.name),
		),
	)
}

func TestPolymorphicField(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
					},
				},
				"Address": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "Street",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "City",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "State",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "ZipCode",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "OwnerID",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							Index:       true,
							Polymorphic: &input.PolymorphicOptions{},
							DerivedFields: []*input.Field{
								{
									Name: "OwnerType",
									Type: &input.FieldType{
										DBType: input.String,
									},
								},
							},
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("Address", dbSchema, t)
	columns := table.Columns
	// address. id, street, city, state, zipcode, owner_id, owner_type
	require.Len(t, columns, 7)

	col := getTestColumnFromTable(t, table, "owner_type")
	testColumn(
		t,
		col,
		"owner_type",
		"OwnerType",
		"owner_type",
		[]string{strconv.Quote("owner_type"), "sa.Text()", "nullable=False"},
	)
}

func TestPolymorphicFieldWithRestrictedTypes(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
					},
				},
				"Location": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
					},
				},
				"Address": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "Street",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "City",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "State",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "ZipCode",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "OwnerID",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							Index: true,
							Polymorphic: &input.PolymorphicOptions{
								// we enforce in typescript for now so no db changes...
								Types: []string{"User", "Location"},
							},
							DerivedFields: []*input.Field{
								{
									Name: "OwnerType",
									Type: &input.FieldType{
										DBType: input.String,
									},
								},
							},
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("Address", dbSchema, t)
	columns := table.Columns
	// address. id, street, city, state, zipcode, owner_id, owner_type
	require.Len(t, columns, 7)

	col := getTestColumnFromTable(t, table, "owner_type")
	testColumn(
		t,
		col,
		"owner_type",
		"OwnerType",
		"owner_type",
		[]string{strconv.Quote("owner_type"), "sa.Text()", "nullable=False"},
	)
}

func TestForeignKeyTS(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
					},
				},
				"Contact": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "userID",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							ForeignKey: &input.ForeignKey{
								Schema: "User",
								Column: "id",
							},
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("Contact", dbSchema, t)
	constraints := table.Constraints
	// pkey, index, fkey
	require.Len(t, constraints, 3)

	constraint := getTestForeignKeyConstraintFromTable(t, table, "userID")

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.ForeignKeyConstraint([%s], [%s], name=%s, ondelete=%s)",
			strconv.Quote("user_id"),
			strconv.Quote("users.id"),
			strconv.Quote("contacts_user_id_fkey"),
			strconv.Quote("CASCADE"),
		),
	)

	constraint2 := getTestIndexedConstraintFromTable(t, table, "userID")

	testConstraint(
		t,
		constraint2,
		fmt.Sprintf("sa.Index(%s, %s)", strconv.Quote("contacts_user_id_idx"), strconv.Quote("user_id")),
	)
}

func TestForeignKeyIndexDisabled(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
					},
				},
				"Contact": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "userID",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							ForeignKey: &input.ForeignKey{
								Schema:       "User",
								Column:       "id",
								DisableIndex: true,
							},
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("Contact", dbSchema, t)
	constraints := table.Constraints
	// pkey, fkey
	require.Len(t, constraints, 2)

	constraint := getTestForeignKeyConstraintFromTable(t, table, "userID")

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.ForeignKeyConstraint([%s], [%s], name=%s, ondelete=%s)",
			strconv.Quote("user_id"),
			strconv.Quote("users.id"),
			strconv.Quote("contacts_user_id_fkey"),
			strconv.Quote("CASCADE"),
		),
	)
}

func TestMultiColumnIndex(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"Contact": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "firstName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "lastName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
					},
					Indices: []*input.Index{
						{
							Name:    "contacts_name_index",
							Columns: []string{"firstName", "lastName"},
						},
					},
				},
			},
		})

	table := getTestTableFromSchema("Contact", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 2)

	constraint := getTestIndexedConstraintFromTable(t, table, "firstName", "lastName")

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.Index(%s, %s, %s)", strconv.Quote("contacts_name_index"), strconv.Quote("first_name"), strconv.Quote("last_name")),
	)
}

func TestMultiColumnUniqueIndex(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "firstName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "lastName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
					},
				},
				"Contact": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "firstName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "lastName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "emailAddress",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "userID",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							ForeignKey: &input.ForeignKey{
								Schema: "User",
								Column: "id",
							},
						},
					},
					Indices: []*input.Index{
						{
							Name:    "contacts_unique_email",
							Columns: []string{"emailAddress", "userID"},
							Unique:  true,
						},
					},
				},
			},
		})

	table := getTestTableFromSchema("Contact", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 4)

	constraint := getTestIndexedConstraintFromTable(t, table, "emailAddress", "userID")

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.Index(%s, %s, %s, unique=True)", strconv.Quote("contacts_unique_email"), strconv.Quote("email_address"), strconv.Quote("user_id")),
	)
}

func TestPatterns(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Patterns: map[string]*input.Pattern{
				"Feedback": {
					Name: "feedback",
					AssocEdges: []*input.AssocEdge{
						{
							Name:       "likers",
							SchemaName: "User",
							InverseEdge: &input.InverseAssocEdge{
								Name:          "likes",
								EdgeConstName: "UserToLikes",
							},
							EdgeConstName: "ObjectToLikers",
						},
					},
				},
			},
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
					},
				},
				"Post": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
					},
					AssocEdges: []*input.AssocEdge{
						{
							PatternName: "feedback",
							Name:        "likers",
							SchemaName:  "User",
							InverseEdge: &input.InverseAssocEdge{
								Name:          "likes",
								EdgeConstName: "UserToLikes",
							},
							EdgeConstName: "ObjectToLikers",
						},
					},
				},
			},
		})

	require.Len(t, dbSchema.tableMap, 4)

	expTables := []string{
		"assoc_edge_config",
		"users",
		"posts",
		"object_likers_edges",
	}
	for _, tbl := range expTables {
		table := dbSchema.tableMap[tbl]
		require.NotNil(t, table)
	}
}

func TestFullTextIndexSingleCol(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "firstName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
					},
					Indices: []*input.Index{
						{
							Name:    "users_first_name_idx",
							Columns: []string{"firstName"},
							FullText: &input.FullText{
								Language: "english",
							},
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("User", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 2)

	constraint := getTestFullTextIndexedConstraintFromTable(t, table, "firstName")
	testConstraint(
		t,
		constraint,
		fmt.Sprintf("FullTextIndex(%s, info=%s)",
			strconv.Quote("users_first_name_idx"),
			getKVDict([]string{
				getKVPair("postgresql_using", strconv.Quote("gin")),
				getKVPair("postgresql_using_internals", strconv.Quote("to_tsvector('english', coalesce(first_name, ''))")),
				getKVPair("column", strconv.Quote("first_name")),
			})),
	)
}

func TestFullTextIndexMultipleCols(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "firstName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "lastName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
					},
					Indices: []*input.Index{
						{
							Name:    "users_name_idx",
							Columns: []string{"firstName", "lastName"},
							FullText: &input.FullText{
								Language: "english",
							},
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("User", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 2)

	constraint := getTestFullTextIndexedConstraintFromTable(t, table, "firstName", "lastName")
	testConstraint(
		t,
		constraint,
		fmt.Sprintf("FullTextIndex(%s, info=%s)",
			strconv.Quote("users_name_idx"),
			getKVDict([]string{
				getKVPair("postgresql_using", strconv.Quote("gin")),
				getKVPair("postgresql_using_internals", strconv.Quote("to_tsvector('english', coalesce(first_name, '') || ' ' || coalesce(last_name, ''))")),
				getKVPair("columns",
					fmt.Sprintf("[%s, %s]",
						strconv.Quote("first_name"),
						strconv.Quote("last_name"))),
			})),
	)
}

func TestFullTextIndexMultipleColsGist(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "firstName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "lastName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
					},
					Indices: []*input.Index{
						{
							Name:    "users_name_idx",
							Columns: []string{"firstName", "lastName"},
							FullText: &input.FullText{
								Language:  "english",
								IndexType: input.Gist,
							},
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("User", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 2)

	constraint := getTestFullTextIndexedConstraintFromTable(t, table, "firstName", "lastName")
	testConstraint(
		t,
		constraint,
		fmt.Sprintf("FullTextIndex(%s, info=%s)",
			strconv.Quote("users_name_idx"),
			getKVDict([]string{
				getKVPair("postgresql_using", strconv.Quote("gist")),
				getKVPair("postgresql_using_internals", strconv.Quote("to_tsvector('english', coalesce(first_name, '') || ' ' || coalesce(last_name, ''))")),
				getKVPair("columns",
					fmt.Sprintf("[%s, %s]",
						strconv.Quote("first_name"),
						strconv.Quote("last_name"))),
			})),
	)
}

func TestFullTextIndexMultipleColsLangColumn(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "firstName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "lastName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
					},
					Indices: []*input.Index{
						{
							Name:    "users_name_idx",
							Columns: []string{"firstName", "lastName"},
							FullText: &input.FullText{
								LanguageColumn: "language",
							},
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("User", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 2)

	constraint := getTestFullTextIndexedConstraintFromTable(t, table, "firstName", "lastName")
	testConstraint(
		t,
		constraint,
		fmt.Sprintf("FullTextIndex(%s, info=%s)",
			strconv.Quote("users_name_idx"),
			getKVDict([]string{
				getKVPair("postgresql_using", strconv.Quote("gin")),
				getKVPair("postgresql_using_internals", strconv.Quote("to_tsvector(language::reconfig, coalesce(first_name, '') || ' ' || coalesce(last_name, ''))")),
				getKVPair("columns",
					fmt.Sprintf("[%s, %s]",
						strconv.Quote("first_name"),
						strconv.Quote("last_name"))),
			})),
	)
}

func TestFullTextIndexMultipleColsGeneratedColumn(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "firstName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "lastName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
					},
					Indices: []*input.Index{
						{
							Name:    "users_name_idx",
							Columns: []string{"firstName", "lastName"},
							FullText: &input.FullText{
								GeneratedColumnName: "name_idx",
								Language:            "english",
							},
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("User", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 2)

	constraint := getTestFullTextIndexedConstraintFromTable(t, table, "firstName", "lastName")
	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.Index(%s, %s, postgresql_using='%s')",
			strconv.Quote("users_name_idx"),
			strconv.Quote("name_idx"),
			"gin",
		),
	)

	column := getTestColumnFromTable(t, table, "name_idx")
	testColumn(t, column, "name_idx", "", "name_idx", []string{
		strconv.Quote("name_idx"),
		"postgresql.TSVECTOR",
		fmt.Sprintf("sa.Computed(%s)",
			strconv.Quote("to_tsvector('english', coalesce(first_name, '') || ' ' || coalesce(last_name, ''))")),
	})
}

func TestFullTextIndexMultipleColsGeneratedColumnWeights(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "firstName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "lastName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
					},
					Indices: []*input.Index{
						{
							Name:    "users_name_idx",
							Columns: []string{"firstName", "lastName"},
							FullText: &input.FullText{
								GeneratedColumnName: "name_idx",
								Language:            "simple",
								Weights: &input.FullTextWeight{
									A: []string{"firstName", "lastName"},
								},
							},
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("User", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 2)

	constraint := getTestFullTextIndexedConstraintFromTable(t, table, "firstName", "lastName")
	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.Index(%s, %s, postgresql_using='%s')",
			strconv.Quote("users_name_idx"),
			strconv.Quote("name_idx"),
			"gin",
		),
	)

	column := getTestColumnFromTable(t, table, "name_idx")
	testColumn(t, column, "name_idx", "", "name_idx", []string{
		strconv.Quote("name_idx"),
		"postgresql.TSVECTOR",
		fmt.Sprintf("sa.Computed(%s)",
			strconv.Quote("(setweight(to_tsvector('simple', coalesce(first_name, '')), 'A') || setweight(to_tsvector('simple', coalesce(last_name, '')), 'A'))")),
	})
}

func TestFullTextIndexMultipleColsGeneratedColumnWeightsDiff(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "firstName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "lastName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
					},
					Indices: []*input.Index{
						{
							Name:    "users_name_idx",
							Columns: []string{"firstName", "lastName"},
							FullText: &input.FullText{
								GeneratedColumnName: "name_idx",
								Language:            "simple",
								Weights: &input.FullTextWeight{
									A: []string{"firstName"},
									B: []string{"lastName"},
								},
							},
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("User", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 2)

	constraint := getTestFullTextIndexedConstraintFromTable(t, table, "firstName", "lastName")
	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.Index(%s, %s, postgresql_using='%s')",
			strconv.Quote("users_name_idx"),
			strconv.Quote("name_idx"),
			"gin",
		),
	)

	column := getTestColumnFromTable(t, table, "name_idx")
	testColumn(t, column, "name_idx", "", "name_idx", []string{
		strconv.Quote("name_idx"),
		"postgresql.TSVECTOR",
		fmt.Sprintf("sa.Computed(%s)",
			strconv.Quote("(setweight(to_tsvector('simple', coalesce(first_name, '')), 'A') || setweight(to_tsvector('simple', coalesce(last_name, '')), 'B'))")),
	})
}

func TestFullTextIndexMultipleColsGeneratedColumnMisMatchedWeights(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "firstName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
						{
							Name: "lastName",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
					},
					Indices: []*input.Index{
						{
							Name:    "users_name_idx",
							Columns: []string{"firstName", "lastName"},
							FullText: &input.FullText{
								GeneratedColumnName: "name_idx",
								Language:            "english",
								Weights: &input.FullTextWeight{
									A: []string{"firstName"},
								},
							},
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("User", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 2)

	constraint := getTestFullTextIndexedConstraintFromTable(t, table, "firstName", "lastName")
	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.Index(%s, %s, postgresql_using='%s')",
			strconv.Quote("users_name_idx"),
			strconv.Quote("name_idx"),
			"gin",
		),
	)

	column := getTestColumnFromTable(t, table, "name_idx")
	testColumn(t, column, "name_idx", "", "name_idx", []string{
		strconv.Quote("name_idx"),
		"postgresql.TSVECTOR",
		fmt.Sprintf("sa.Computed(%s)",
			strconv.Quote("(setweight(to_tsvector('english', coalesce(first_name, '')), 'A') || to_tsvector('english', coalesce(last_name, '')))")),
	})
}

func TestGlobalEdge(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
					},
				},
			},
			GlobalSchema: &input.GlobalSchema{
				GlobalEdges: []*input.AssocEdge{
					{
						Name:       "external_info",
						SchemaName: "User",
					},
					{
						Name:       "external_info_on_wheels",
						SchemaName: "User",
					},
				},
			},
		},
	)

	require.Len(t, dbSchema.tableMap, 4)
	expTables := []string{
		"assoc_edge_config",
		"users",
		"global_external_info_edges",
		"global_external_info_on_wheels_edges",
	}
	for _, tbl := range expTables {
		table := dbSchema.tableMap[tbl]
		require.NotNil(t, table)

		if tbl == "global_external_info_edges" || tbl == "global_external_info_on_wheels_edges" {
			testEdgeTable(t, table)
		}
	}
}

func TestGlobalEdgeWithInverse(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
					},
				},
			},
			GlobalSchema: &input.GlobalSchema{
				GlobalEdges: []*input.AssocEdge{
					{
						Name:       "external_info",
						SchemaName: "User",
						InverseEdge: &input.InverseAssocEdge{
							Name: "user_external_info",
						},
					},
				},
			},
		},
	)

	require.Len(t, dbSchema.tableMap, 3)
	expTables := []string{
		"assoc_edge_config",
		"users",
		"global_external_info_edges",
	}
	for _, tbl := range expTables {
		table := dbSchema.tableMap[tbl]
		require.NotNil(t, table)

		if tbl == "global_external_info_edges" {
			testEdgeTable(t, table)
		}
	}
}

func TestExtraEdgeCols(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
					},
					AssocEdges: []*input.AssocEdge{
						{
							Name:       "friends",
							SchemaName: "User",
						},
					},
				},
			},
			GlobalSchema: &input.GlobalSchema{
				ExtraEdgeFields: []*input.Field{
					{
						Name: "deleted_at",
						Type: &input.FieldType{
							DBType: input.Timestamp,
						},
					},
				},
				GlobalEdges: []*input.AssocEdge{
					{
						Name:       "external_info",
						SchemaName: "User",
						InverseEdge: &input.InverseAssocEdge{
							Name: "user_external_info",
						},
					},
				},
			},
		},
	)

	require.Len(t, dbSchema.tableMap, 4)
	expTables := []string{
		"assoc_edge_config",
		"users",
		"user_friends_edges",
		"global_external_info_edges",
	}
	for _, tbl := range expTables {
		table := dbSchema.tableMap[tbl]
		require.NotNil(t, table)

		if tbl == "global_external_info_edges" || tbl == "user_friends_edges" {
			testEdgeTable(t, table)

			found := false
			for _, col := range table.Columns {
				if col.DBColName == "deleted_at" {
					found = true
					break
				}
			}
			assert.True(t, found, "couldn't find deleted_at column")
		}
	}
}

func TestExplicitScalarIndexBtree(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "email",
							Type: &input.FieldType{
								DBType: input.String,
							},
						},
					},
					Indices: []*input.Index{
						{
							Name:      "users_email_idx",
							Columns:   []string{"email"},
							IndexType: input.Btree,
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("User", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 2)

	constraint := getTestIndexedConstraintFromTable(t, table, "email")

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.Index(%s, %s, postgresql_using=%s)",
			strconv.Quote("users_email_idx"),
			strconv.Quote("email"),
			strconv.Quote("btree"),
		),
	)
}

func TestExplicitListIndexGin(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "emails",
							Type: &input.FieldType{
								DBType: input.List,
								ListElemType: &input.FieldType{
									DBType: input.String,
								},
							},
						},
					},
					Indices: []*input.Index{
						{
							Name:      "users_emails_idx",
							Columns:   []string{"emails"},
							IndexType: input.Gin,
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("User", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 2)

	constraint := getTestIndexedConstraintFromTable(t, table, "emails")

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.Index(%s, %s, postgresql_using=%s)",
			strconv.Quote("users_emails_idx"),
			strconv.Quote("emails"),
			strconv.Quote("gin"),
		),
	)
}

func TestImplicitScalarIndex(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "email",
							Type: &input.FieldType{
								DBType: input.String,
							},
							Index: true,
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("User", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 2)

	constraint := getTestIndexedConstraintFromTable(t, table, "email")

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.Index(%s, %s)",
			strconv.Quote("users_email_idx"),
			strconv.Quote("email"),
		),
	)
}

func TestImplicitListIndexGin(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "emails",
							Type: &input.FieldType{
								DBType: input.List,
								ListElemType: &input.FieldType{
									DBType: input.String,
								},
							},
							Index: true,
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("User", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 2)

	constraint := getTestIndexedConstraintFromTable(t, table, "emails")

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.Index(%s, %s, postgresql_using=%s)",
			strconv.Quote("users_emails_idx"),
			strconv.Quote("emails"),
			strconv.Quote("gin"),
		),
	)
}

func TestImplicitListIndexGinNoIndexType(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "emails",
							Type: &input.FieldType{
								DBType: input.List,
								ListElemType: &input.FieldType{
									DBType: input.String,
								},
							},
						},
					},
					Indices: []*input.Index{
						{
							Name:    "users_emails_idx",
							Columns: []string{"emails"},
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("User", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 2)

	constraint := getTestIndexedConstraintFromTable(t, table, "emails")

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.Index(%s, %s, postgresql_using=%s)",
			strconv.Quote("users_emails_idx"),
			strconv.Quote("emails"),
			strconv.Quote("gin"),
		),
	)
}

func TestExplicitJSONBIndexGin(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "foo",
							Type: &input.FieldType{
								DBType: input.JSONB,
							},
						},
					},
					Indices: []*input.Index{
						{
							Name:      "users_foo_idx",
							Columns:   []string{"foo"},
							IndexType: input.Gin,
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("User", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 2)

	constraint := getTestIndexedConstraintFromTable(t, table, "foo")

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.Index(%s, %s, postgresql_using=%s)",
			strconv.Quote("users_foo_idx"),
			strconv.Quote("foo"),
			strconv.Quote("gin"),
		),
	)
}

func TestImplicitJSONBIndexGin(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "foo",
							Type: &input.FieldType{
								DBType: input.JSONB,
							},
							Index: true,
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("User", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 2)

	constraint := getTestIndexedConstraintFromTable(t, table, "foo")

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.Index(%s, %s, postgresql_using=%s)",
			strconv.Quote("users_foo_idx"),
			strconv.Quote("foo"),
			strconv.Quote("gin"),
		),
	)
}

func TestImplicitJSONBNoIndexType(t *testing.T) {
	dbSchema := getSchemaFromInput(
		t,
		&input.Schema{
			Nodes: map[string]*input.Node{
				"User": {
					Fields: []*input.Field{
						{
							Name: "id",
							Type: &input.FieldType{
								DBType: input.UUID,
							},
							PrimaryKey: true,
						},
						{
							Name: "foo",
							Type: &input.FieldType{
								DBType: input.JSONB,
							},
						},
					},
					Indices: []*input.Index{
						{
							Name:    "users_foo_idx",
							Columns: []string{"foo"},
						},
					},
				},
			},
		},
	)

	table := getTestTableFromSchema("User", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 2)

	constraint := getTestIndexedConstraintFromTable(t, table, "foo")

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.Index(%s, %s, postgresql_using=%s)",
			strconv.Quote("users_foo_idx"),
			strconv.Quote("foo"),
			strconv.Quote("gin"),
		),
	)
}

func getSchemaFromInput(t *testing.T, s *input.Schema) *dbSchema {
	ss, err := schema.ParseFromInputSchema(&codegenapi.DummyConfig{}, s, base.TypeScript)
	require.Nil(t, err)

	dbSchema := newDBSchema(ss, &codegenapi.DummyConfig{})
	require.Nil(t, dbSchema.generateShemaTables())
	return dbSchema
}

func testEdgeTable(t *testing.T, table *dbTable) {
	assert.GreaterOrEqual(t, len(table.Columns), 7, "invalid number of columns for table generated. expected at least %d, got %d", 7, len(table.Columns))

	// 1 primary key constraint for the id1, edge_type, id2 fields
	assert.GreaterOrEqual(
		t,
		len(table.Constraints),
		1,
		"invalid number of constraints for table generated. expected at least %d, got %d", 1, len(table.Constraints),
	)

	// verify there's a loadable primary key constraint
	constraint := getTestPrimaryKeyConstraintFromTable(t, table, "ID1", "EdgeType", "ID2")
	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.PrimaryKeyConstraint(%s, %s, %s, name=%s)",
			strconv.Quote("id1"),
			strconv.Quote("edge_type"),
			strconv.Quote("id2"),
			strconv.Quote(fmt.Sprintf("%s_id1_edge_type_id2_pkey", table.TableName)),
		),
	)
}

func testColumn(t *testing.T, col *dbColumn, colName string, expectedFieldName, expectedDBColName string, colStringParts []string) {
	assert.Equal(t, expectedFieldName, col.EntFieldName, "EntFieldName for the %s column was not as expected. expected %s, got %s instead", colName, expectedFieldName, col.EntFieldName)
	assert.Equal(t, expectedDBColName, col.DBColName, "DBColName for the %s column was not as expected. expected %s, got %s instead", colName, expectedDBColName, col.DBColName)

	colString := col.getColString()
	expectedColString := strings.Join(colStringParts, ", ")
	assert.Equal(t, expectedColString, col.getColString(), "ColString for the %s column was not as expected. expected %s, got %s instead", colName, expectedColString, colString)
}

func testConstraint(t *testing.T, constraint dbConstraint, expectedConstraintString string) {
	assert.Equal(
		t,
		expectedConstraintString,
		constraint.getConstraintString(),
		"getConstraintString() for constraint was not as expected. expected %s, got %s instead", expectedConstraintString, constraint.getConstraintString(),
	)
}

func testEdgeInSchema(t *testing.T, edge *dbEdgeInfo, expectedParts map[string]string) {
	parts := strings.Split(edge.EdgeLine, ",")
	for _, part := range parts {
		str := strings.TrimRight(strings.TrimLeft(part, "{"), "}")
		strParts := strings.Split(str, ":")
		require.Len(t, strParts, 2, "invalid format")
		key, err := strconv.Unquote(strings.TrimSpace(strParts[0]))
		assert.Nil(t, err)
		val := strParts[1]

		assert.Contains(t, expectedParts, key)

		// verify that edge_type is a uuid
		if key == "edge_type" {
			_, err := uuid.Parse(val)
			assert.Nil(t, err)
		} else if key == "inverse_edge_type" {
			// verify that inverse_edge_type is uuid or none
			if expectedParts[key] == "None" {
				assert.Equal(t, expectedParts[key], val)
			} else {
				_, err := uuid.Parse(val)
				assert.Nil(t, err)
			}
		} else {
			assert.Equal(t, expectedParts[key], val)
		}
	}
}

func testConstraints(t *testing.T, table *dbTable, expConstraints int) {
	assert.Equal(
		t,
		expConstraints,
		len(table.Constraints),
		"invalid number of constraint for table generated. expected %d, got %d",
		expConstraints,
		len(table.Constraints),
	)
}

func getTestSchema(t *testing.T) *dbSchema {
	return newDBSchema(testmodel.GetSchema(t), &codegenapi.DummyConfig{})
}

func getTestTable(nodeName string, t *testing.T) *dbTable {
	schema := getTestSchema(t)
	// need to do this now because constraints are generated separately
	require.Nil(t, schema.generateShemaTables())

	return getTestTableFromSchema(nodeName, schema, t)
}

func getTestTableFromSchema(nodeName string, s *dbSchema, t *testing.T) *dbTable {
	node := s.schema.Nodes[nodeName]
	require.NotNil(t, node, "no codegen info for %s table", nodeName)
	table := s.getTableForNode(node.NodeData)
	require.NotNil(t, table, "no dbtable info for %s", nodeName)
	return table
}

func getTestEnumTableFromSchema(name string, s *dbSchema, t *testing.T) *dbTable {
	enumInfo := s.schema.Enums[name]
	require.NotNil(t, enumInfo, "no enum info for %s table", name)
	table := s.getTableForNode(enumInfo.NodeData)
	require.NotNil(t, table, "no dbtable info for %s", name)
	return table
}

func getTestColumn(nodeName, colFieldName string, t *testing.T) *dbColumn {
	table := getTestTable(nodeName, t)

	for _, column := range table.Columns {
		if column.EntFieldName == colFieldName {
			return column
		}
	}
	require.Fail(t, "no column %s for %s table", colFieldName, nodeName)
	return nil
}

func getTestColumnFromSchema(t *testing.T, schema *dbSchema, tableName, colName string) *dbColumn {
	table := schema.tableMap[tableName]
	require.NotNil(t, table)

	return getTestColumnFromTable(t, table, colName)
}

func getTestColumnFromTable(t *testing.T, table *dbTable, colName string) *dbColumn {
	for _, col := range table.Columns {
		if col.DBColName == colName || col.EntFieldName == colName {
			return col
		}
	}
	require.Fail(t, "couldn't find column with name %s", colName)
	return nil
}

func getColNames(cols []*dbColumn) []string {
	res := make([]string, len(cols))
	for idx := range cols {
		res[idx] = cols[idx].EntFieldName
	}
	return res
}

func getTestForeignKeyConstraint(t *testing.T, nodeName, colFieldName string) dbConstraint {
	table := getTestTable(nodeName, t)

	return getTestForeignKeyConstraintFromTable(t, table, colFieldName)
}

func getTestForeignKeyConstraintFromTable(t *testing.T, table *dbTable, colFieldName ...string) dbConstraint {
	for _, constraint := range table.Constraints {
		fkeyConstraint, ok := constraint.(*foreignKeyConstraint)
		if ok {
			if util.StringsEqual(getColNames(fkeyConstraint.columns), colFieldName) {
				return fkeyConstraint
			}
		}
	}
	require.Fail(t, "no foreign key constraint for %v column(s) for %s table", colFieldName, table.QuotedTableName)
	return nil
}

func getTestPrimaryKeyConstraint(nodeName, colFieldName string, t *testing.T) dbConstraint {
	table := getTestTable(nodeName, t)

	return getTestPrimaryKeyConstraintFromTable(t, table, colFieldName)
}

func getTestPrimaryKeyConstraintFromTable(t *testing.T, table *dbTable, colFieldName ...string) dbConstraint {
	for _, constraint := range table.Constraints {
		pKeyConstraint, ok := constraint.(*primaryKeyConstraint)
		if ok && util.StringsEqual(getColNames(pKeyConstraint.dbColumns), colFieldName) {
			return pKeyConstraint
		}
	}
	require.Fail(t, "no primary key constraint in table %s for column(s) %v", table.QuotedTableName, colFieldName)
	return nil
}

func getTestUniqueKeyConstraint(t *testing.T, nodename string, colFieldName ...string) dbConstraint {
	table := getTestTable(nodename, t)

	return getTestUniqueKeyConstraintFromTable(t, table, colFieldName...)
}

func getTestUniqueKeyConstraintFromTable(t *testing.T, table *dbTable, colFieldName ...string) dbConstraint {
	for _, constraint := range table.Constraints {
		uniqConstraint, ok := constraint.(*uniqueConstraint)
		if ok && util.StringsEqual(getColNames(uniqConstraint.dbColumns), colFieldName) {
			return uniqConstraint
		}
	}
	require.Fail(t, "no unique constraint in table %s for column(s) %v", table.QuotedTableName, colFieldName)
	return nil
}

func getTestIndexedConstraintFromTable(t *testing.T, table *dbTable, colFieldName ...string) dbConstraint {
	for _, constraint := range table.Constraints {
		indConstraint, ok := constraint.(*indexConstraint)
		if ok && util.StringsEqual(getColNames(indConstraint.dbColumns), colFieldName) {
			return indConstraint
		}
	}
	require.Fail(t, "no index constraint in table %s for column(s) %v", table.QuotedTableName, colFieldName)
	return nil
}

func getTestFullTextIndexedConstraintFromTable(t *testing.T, table *dbTable, colFieldName ...string) dbConstraint {
	for _, constraint := range table.Constraints {
		indConstraint, ok := constraint.(*fullTextConstraint)
		if ok && util.StringsEqual(getColNames(indConstraint.dbColumns), colFieldName) {
			return indConstraint
		}
	}
	require.Fail(t, "no index constraint in table %s for column(s) %v", table.QuotedTableName, colFieldName)
	return nil
}

func getTestIndexedConstraint(nodeName, colFieldName string, t *testing.T) dbConstraint {
	table := getTestTable(nodeName, t)

	for _, constraint := range table.Constraints {
		idxConstraint, ok := constraint.(*indexConstraint)
		if ok && idxConstraint.dbColumns[0].EntFieldName == colFieldName {
			// for now there can only be oen column so it's fine.
			return idxConstraint
		}
	}
	require.Fail(t, "no unique constraint for %s column for %s table", colFieldName, nodeName)
	return nil
}

func getTestTableByName(tableName string, t *testing.T) *dbTable {
	tableName = strconv.Quote(tableName)
	schema := getTestSchema(t)
	require.Nil(t, schema.generateShemaTables())

	for _, table := range schema.Tables {
		if table.QuotedTableName == tableName {
			return table
		}
	}
	require.Fail(t, "no dbtable info for table %s", tableName)
	return nil
}

func getEdgeColumn(colDBName string, t *testing.T) *dbColumn {
	return getColumnFromNamedTable(colDBName, "account_folders_edges", t)
}

func getColumnFromNamedTable(colDBName, tableName string, t *testing.T) *dbColumn {
	table := getTestTableByName(tableName, t)

	for _, col := range table.Columns {
		if col.DBColName == colDBName {
			return col
		}
	}
	require.Fail(t, "no db column %s for account_folders_edges table", colDBName)
	return nil
}

func getEdgeByName(edgeName string, t *testing.T) *dbEdgeInfo {
	s := getTestSchema(t)
	template, err := s.getSchemaForTemplate()
	require.Nil(t, err)

	for _, edge := range template.Edges {
		if edge.EdgeName == edgeName {
			return &edge
		}
	}
	require.Fail(t, "no edge for %s found", edgeName)
	return nil
}
