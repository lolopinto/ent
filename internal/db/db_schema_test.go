package db

import (
	"fmt"
	"io/ioutil"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/lolopinto/ent/internal/parsehelper"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/testhelper"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIDColumn(t *testing.T) {
	col := getTestColumn("AccountConfig", "ID", t)

	parts := []string{
		strconv.Quote("id"),
		"postgresql.UUID()",
		"nullable=False",
	}
	testColumn(t, col, "id", "ID", "id", parts)

	constraint := getTestPrimaryKeyConstraint("AccountConfig", "ID", t)
	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.PrimaryKeyConstraint(%s, name=%s)", strconv.Quote("id"), strconv.Quote("accounts_id_pkey")),
	)
}

func TestCreatedAtColumn(t *testing.T) {
	col := getTestColumn("AccountConfig", "CreatedAt", t)

	parts := []string{
		strconv.Quote("created_at"),
		"sa.TIMESTAMP()",
		"nullable=False",
	}
	testColumn(t, col, "created_at", "CreatedAt", "created_at", parts)
}

func TestUpdatedAtColumn(t *testing.T) {
	col := getTestColumn("AccountConfig", "UpdatedAt", t)

	parts := []string{
		strconv.Quote("updated_at"),
		"sa.TIMESTAMP()",
		"nullable=False",
	}
	testColumn(t, col, "updated_at", "UpdatedAt", "updated_at", parts)
}

func TestTableForNode(t *testing.T) {
	table := getTestTable("AccountConfig", t)

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
	table = getTestTable("TodoConfig", t)
	testConstraints(t, table, 3)
}

func TestTablesFromSchema(t *testing.T) {
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

func TestEdgesFromSchema(t *testing.T) {
	//	TODO this test is useless
	//for tests like this and the one above and in graphql, we need to change things to get the value from node_schema or something and then do math based on that
	t.Skip()
	schema := getTestSchema(t)
	template, err := schema.getSchemaForTemplate()
	require.NotNil(t, err)

	expEdges := 22
	assert.Equal(
		t,
		expEdges,
		len(template.Edges),
		"incorrect number of edges generated, expected %d got %d",
		expEdges,
		len(template.Edges),
	)
}

func TestStringUserDefinedColumn(t *testing.T) {
	column := getTestColumn("AccountConfig", "FirstName", t)

	parts := []string{
		strconv.Quote("first_name"),
		"sa.Text()",
		"nullable=False",
	}
	testColumn(t, column, "first_name", "FirstName", "first_name", parts)
}

func TestNullableStringUserDefinedColumn(t *testing.T) {
	column := getTestColumn("AccountConfig", "Bio", t)

	parts := []string{
		strconv.Quote("bio"),
		"sa.Text()",
		"nullable=True",
	}
	testColumn(t, column, "bio", "Bio", "bio", parts)
}

func TestIntegerUserDefinedColumn(t *testing.T) {
	column := getTestColumn("AccountConfig", "NumberOfLogins", t)

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
	column := getTestColumn("AccountConfig", "LastLoginAt", t)

	// this also tests overriden fields
	parts := []string{
		strconv.Quote("last_login_time"),
		"sa.TIMESTAMP()",
		"nullable=False",
	}
	testColumn(t, column, "last_login_time", "LastLoginAt", "last_login_time", parts)
}

func TestNullableTimeUserDefinedColumn(t *testing.T) {
	column := getTestColumn("AccountConfig", "DateOfBirth", t)

	parts := []string{
		strconv.Quote("date_of_birth"),
		"sa.TIMESTAMP()",
		"nullable=True",
	}
	testColumn(t, column, "date_of_birth", "DateOfBirth", "date_of_birth", parts)
}

func TestUniqueColumn(t *testing.T) {
	column := getTestColumn("AccountConfig", "PhoneNumber", t)

	parts := []string{
		strconv.Quote("phone_number"), // db field
		"sa.Text()",                   // db type
		"nullable=False",
	}
	testColumn(t, column, "phone_number", "PhoneNumber", "phone_number", parts)

	constraint := getTestUniqueKeyConstraint(t, "AccountConfig", "PhoneNumber")

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.UniqueConstraint(%s, name=%s)", strconv.Quote("phone_number"), strconv.Quote("accounts_unique_phone_number")),
	)
}

func TestIndexedColumn(t *testing.T) {
	column := getTestColumn("AccountConfig", "LastName", t)

	parts := []string{
		strconv.Quote("last_name"), // db field
		"sa.Text()",                // db type
		"nullable=False",
	}
	testColumn(t, column, "last_name", "LastName", "last_name", parts)

	constraint := getTestIndexedConstraint("AccountConfig", "LastName", t)

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.Index(%s, %s)", strconv.Quote("accounts_last_name_idx"), strconv.Quote("last_name")),
	)
}

func TestForeignKeyColumn(t *testing.T) {
	column := getTestColumn("TodoConfig", "AccountID", t)

	parts := []string{
		strconv.Quote("account_id"), // db field
		"postgresql.UUID()",         // db type
		"nullable=False",
	}
	testColumn(t, column, "account_id", "AccountID", "account_id", parts)

	constraint := getTestForeignKeyConstraint(t, "TodoConfig", "AccountID")
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

func TestInvalidForeignKeyConfig(t *testing.T) {
	sources := make(map[string]string)

	sources["account_config.go"] = getAccountConfigContents(t)
	sources["todo_config.go"] = `
	package configs

type TodoConfig struct {
	Text      string
	AccountID string ` + "`fkey:\"accounts.ID\"`}" +
		`
	func (config *TodoConfig) GetTableName() string {
		return "todos"
	}
	`

	s, err := parseSchemaFull(t, sources, "InvalidForeignKeyConfig")
	require.Error(t, err)
	require.Equal(t, err.Error(), "could not find the EntConfig codegen info for accounts")
	require.Nil(t, s)
}

func TestInvalidForeignKeyColumn(t *testing.T) {
	sources := make(map[string]string)

	sources["account_config.go"] = getAccountConfigContents(t)
	sources["todo_config.go"] = `
	package configs

type TodoConfig struct {
	Text      string
	AccountID string ` + "`fkey:\"AccountConfig.Bar\"`}" +
		`
	func (config *TodoConfig) GetTableName() string {
		return "todos"
	}
	`

	s, err := parseSchemaFull(t, sources, "InvalidForeignKeyColumn")
	require.Error(t, err)
	require.Equal(t, err.Error(), "could not find field Bar by name")
	require.Nil(t, s)
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
	dbSchema := getSchemaFromCode(
		t,
		map[string]string{
			"request.ts": testhelper.GetCodeWithSchema(
				`import {BaseEntSchema, Field, EnumType} from "{schema}";

				export default class Request extends BaseEntSchema {
					fields: Field[] = [
						EnumType({name: "Status", values: ["OPEN", "PENDING", "CLOSED"], tsType: "RequestStatus", graphQLType: "RequestStatus", createEnumType: true}),
					]
				}
				`,
			),
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
	dbSchema := getSchemaFromCode(t,
		map[string]string{
			"request.ts": testhelper.GetCodeWithSchema(
				`import {BaseEntSchema, Field, EnumType} from "{schema}";

				export default class Request extends BaseEntSchema {
					fields: Field[] = [
						EnumType({name: "Status", values: ["OPEN", "PENDING", "CLOSED"], createEnumType: true, nullable: true}),
					]
				}
				`,
			),
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

func TestEnumTableInSchema(t *testing.T) {
	dbSchema := getSchemaFromCode(
		t,
		map[string]string{
			"role.ts": testhelper.GetCodeWithSchema(
				`import {Schema, Field, StringType, IntegerType} from "{schema}";

				export default class Role implements Schema {
					fields: Field[] = [
						StringType({
							name: 'role',
							primaryKey: true,
						}),
						IntegerType({
							name: 'random',
						}),
					];

					enumTable = true;

					dbRows = [
						{
							role: 'admin',
							random: 1,
						},
						{
							role: 'member',
							random: 2,
						},
						{
							role: 'archived_member',
							random: 3,
						},
						{
							role: 'super_admin',
							random: 4,
						},
						{
							role: 'owner',
							random: 5,
						},
					];
				};`),
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
	dbSchema := getSchemaFromCode(
		t,
		map[string]string{
			"user_photo.ts": testhelper.GetCodeWithSchema(`
				import {Schema, Field, UUIDType, Constraint, ConstraintType} from "{schema}";

				export default class UserPhoto implements Schema {
					fields: Field[] = [
						UUIDType({
							name: 'UserID',
						}),
						UUIDType({
							name: 'PhotoID',
						}),
					];

					constraints: Constraint[] = [
						{
							name: "user_photos_pkey",
							type: ConstraintType.PrimaryKey,
							columns: ["UserID", "PhotoID"],
						},
					];
				}
			`),
		},
	)

	table := getTestTableFromSchema("UserPhotoConfig", dbSchema, t)
	constraints := table.Constraints
	require.Len(t, constraints, 1)

	testConstraint(
		t,
		constraints[0],
		fmt.Sprintf("sa.PrimaryKeyConstraint(%s, %s, name=%s)", strconv.Quote("user_id"), strconv.Quote("photo_id"), strconv.Quote("user_photos_pkey")),
	)
}

func TestMultiColumnUniqueKey(t *testing.T) {
	dbSchema := getSchemaFromCode(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(`
				import {Field, StringType, BaseEntSchema} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: 'firstName',
						}),
						StringType({
							name: 'lastName',
						}),
					];
				}
			`),
			"contact.ts": testhelper.GetCodeWithSchema(`
				import {BaseEntSchema, Field, UUIDType, StringType, Constraint, ConstraintType} from "{schema}";

				export default class Contact extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: "emailAddress",
						}),
						UUIDType({
							name: "userID",
							foreignKey: {schema: "User", column:"ID"},
						}),
					];

					constraints: Constraint[] = [
						{
							name: "contacts_unique_email",
							type: ConstraintType.Unique,
							columns: ["emailAddress", "userID"],
						},
					];
				}
			`),
		},
	)

	table := getTestTableFromSchema("ContactConfig", dbSchema, t)
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
	dbSchema := getSchemaFromCode(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(`
				import {Field, StringType, BaseEntSchema, Constraint, ConstraintType} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: 'firstName',
						}),
						StringType({
							name: 'lastName',
						}),
						StringType({
							name: 'emailAddress',
							unique: true,
						}),
					];

					constraints: Constraint[] = [
						{
							name: "users_unique",
							type: ConstraintType.Unique,
							columns: ["id", "emailAddress"],
						},
					];
				}
			`),
			"contact.ts": testhelper.GetCodeWithSchema(`
				import {BaseEntSchema, Field, UUIDType, StringType, Constraint, ConstraintType} from "{schema}";

				export default class Contact extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: "emailAddress",
						}),
						UUIDType({
							name: "userID",
						}),
					];

					constraints: Constraint[] = [
						{
							name: "contacts_user_fkey",
							type: ConstraintType.ForeignKey,
							columns: ["userID", "emailAddress"],
							fkey: {
								tableName: "users", 
								ondelete: "CASCADE",
								columns: ["ID", "emailAddress"],
							}
						},
					];
				}
			`),
		},
	)

	table := getTestTableFromSchema("ContactConfig", dbSchema, t)
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
	dbSchema := getSchemaFromCode(
		t,
		map[string]string{
			"item.ts": testhelper.GetCodeWithSchema(`
				import {Field, FloatType, BaseEntSchema, Constraint, ConstraintType} from "{schema}";

				export default class Item extends BaseEntSchema {
					fields: Field[] = [
						FloatType({
							name: 'price',
						}),
						FloatType({
							name: 'discount_price',
						}),
					];

					constraints: Constraint[] = [
						{
							name: "item_positive_price",
							type: ConstraintType.Check,
							condition: 'price > 0',
							columns: [],
						},
						{
							name: "item_positive_discount_price",
							type: ConstraintType.Check,
							condition: 'discount_price > 0',
							columns: [],
						},
						{
							name: "item_price_greater_than_discount",
							type: ConstraintType.Check,
							condition: 'price > discount_price',
							columns: [],
						},
					];
				}`),
		},
	)

	table := getTestTableFromSchema("ItemConfig", dbSchema, t)
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
	dbSchema := getSchemaFromCode(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(`
				import {Field, StringType, BaseEntSchema} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: 'firstName',
						}),
						StringType({
							name: 'lastName',
						}),
					];
				}
			`),
			"address.ts": testhelper.GetCodeWithSchema(`
		import {BaseEntSchema, Field, StringType, UUIDType} from "{schema}";

		export default class Address extends BaseEntSchema {
			fields: Field[] = [
				StringType({ name: "Street" }),
				StringType({ name: "City" }),
				StringType({ name: "State" }),
				StringType({ name: "ZipCode" }), 
				UUIDType({
					name: "OwnerID",
					index: true, 
					polymorphic: true,
				}),
			];
		}`),
		},
	)

	table := getTestTableFromSchema("AddressConfig", dbSchema, t)
	columns := table.Columns
	// address. 5 obvious fields + owner_type + id/created_at/updated_at
	require.Len(t, columns, 9)

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
	dbSchema := getSchemaFromCode(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(`
				import {Field, StringType, BaseEntSchema} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: 'firstName',
						}),
						StringType({
							name: 'lastName',
						}),
					];
				}
			`),
			"location.ts": testhelper.GetCodeWithSchema(`
				import {Field, StringType, BaseEntSchema} from "{schema}";

				export default class Location extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: 'location',
						}),
					];
				}
			`),
			"address.ts": testhelper.GetCodeWithSchema(`
		import {BaseEntSchema, Field, StringType, UUIDType} from "{schema}";

		export default class Address extends BaseEntSchema {
			fields: Field[] = [
				StringType({ name: "Street" }),
				StringType({ name: "City" }),
				StringType({ name: "State" }),
				StringType({ name: "ZipCode" }), 
				UUIDType({
					name: "OwnerID",
					index: true, 
					polymorphic: {
						// we enforce in typescript for now so no db changes...
						types: ["User", "Location"],
					},
					}),
			];
		}`),
		},
	)

	table := getTestTableFromSchema("AddressConfig", dbSchema, t)
	columns := table.Columns
	// address. 5 obvious fields + owner_type + id/created_at/updated_at
	require.Len(t, columns, 9)

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
	dbSchema := getSchemaFromCode(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(`
				import {Field, StringType, BaseEntSchema} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: 'firstName',
						}),
						StringType({
							name: 'lastName',
						}),
					];
				}
			`),
			"contact.ts": testhelper.GetCodeWithSchema(`
				import {BaseEntSchema, Field, UUIDType, StringType, Constraint, ConstraintType} from "{schema}";

				export default class Contact extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: "emailAddress",
						}),
						UUIDType({
							name: "userID",
							foreignKey: {schema: "User", column:"ID"},
						}),
					];
				}
			`),
		},
	)

	table := getTestTableFromSchema("ContactConfig", dbSchema, t)
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
	dbSchema := getSchemaFromCode(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(`
				import {Field, StringType, BaseEntSchema} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: 'firstName',
						}),
						StringType({
							name: 'lastName',
						}),
					];
				}
			`),
			"contact.ts": testhelper.GetCodeWithSchema(`
				import {BaseEntSchema, Field, UUIDType, StringType, Constraint, ConstraintType} from "{schema}";

				export default class Contact extends BaseEntSchema {
					fields: Field[] = [
						StringType({
							name: "emailAddress",
						}),
						UUIDType({
							name: "userID",
							foreignKey: {schema: "User", column:"ID", disableIndex:true},
						}),
					];
				}
			`),
		},
	)

	table := getTestTableFromSchema("ContactConfig", dbSchema, t)
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
	dbSchema := getSchemaFromCode(
		t,
		map[string]string{
			"contact.ts": testhelper.GetCodeWithSchema(`
					import {BaseEntSchema, Field, StringType, Index} from "{schema}";

					export default class Contact extends BaseEntSchema {
						fields: Field[] = [
							StringType({
								name: "firstName",
							}),
							StringType({
								name: "lastName",
							}),
						];

						indices: Index[] = [
							{
								name: "contacts_name_index",
								columns: ["firstName", "lastName"],
							},
						];
					}
				`),
		},
	)

	table := getTestTableFromSchema("ContactConfig", dbSchema, t)
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
	dbSchema := getSchemaFromCode(
		t,
		map[string]string{
			"user.ts": testhelper.GetCodeWithSchema(`
					import {Field, StringType, BaseEntSchema} from "{schema}";

					export default class User extends BaseEntSchema {
						fields: Field[] = [
							StringType({
								name: 'firstName',
							}),
							StringType({
								name: 'lastName',
							}),
						];
					}
				`),
			"contact.ts": testhelper.GetCodeWithSchema(`
					import {BaseEntSchema, Field, UUIDType, StringType, Index} from "{schema}";

					export default class Contact extends BaseEntSchema {
						fields: Field[] = [
							StringType({
								name: "firstName",
							}),
							StringType({
								name: "lastName",
							}),
							// this *should* be EmailType but not worth it
							StringType({
								name: "emailAddress",
							}),
							UUIDType({
								name: "userID",
								foreignKey: {schema: "User", column:"ID"},
							}),
						];

						indices: Index[] = [
							{
								name: "contacts_unique_email",
								columns: ["emailAddress", "userID"],
								unique: true,
							},
						];
					}
				`),
		},
	)

	table := getTestTableFromSchema("ContactConfig", dbSchema, t)
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
	dbSchema := getSchemaFromCode(
		t,
		map[string]string{
			"patterns/feedback.ts": testhelper.GetCodeWithSchema(`
				import { Edge, Field, Pattern } from "{schema}";

				export default class Feedback implements Pattern {
					name = "feedback";
					fields: Field[] = [];
					edges: Edge[] = [
						{
							name: "likers",
							schemaName: "User",
							inverseEdge: {
								name: "likes",
								edgeConstName: "UserToLikes",
							},
							edgeConstName: "ObjectToLikers",
						},
					];
				}`),
			"user.ts": testhelper.GetCodeWithSchema(`
				import {BaseEntSchema, Field} from "{schema}";

				export default class User extends BaseEntSchema {
					fields: Field[] = [];
				}`),
			"post.ts": testhelper.GetCodeWithSchema(`
				import {BaseEntSchema, Field} from "{schema}";
				import Feedback from "./patterns/feedback";

				export default class Post extends BaseEntSchema {

					constructor() {
						super();
						this.addPatterns(new Feedback());
					}
					fields: Field[] = [];
				}`),
		},
	)

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

func getSchemaFromCode(t *testing.T, code map[string]string) *dbSchema {
	schema := testhelper.ParseSchemaForTest(
		t,
		code,
		base.TypeScript,
	)
	dbSchema := newDBSchema(schema, "models/configs")
	require.Nil(t, dbSchema.generateShemaTables())

	return dbSchema
}

func testEdgeTable(t *testing.T, table *dbTable) {
	assert.Equal(t, 7, len(table.Columns), "invalid number of columns for table generated. expected %d, got %d", 7, len(table.Columns))

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

func getParsedTestSchema(t *testing.T) *schema.Schema {
	// use parsehelper.ParseFilesForTest since that caches it
	data := parsehelper.ParseFilesForTest(t)
	schema, err := schema.ParsePackage(data.Pkg)
	require.Nil(t, err)
	return schema
}

func getTestSchema(t *testing.T) *dbSchema {
	return newDBSchema(getParsedTestSchema(t), "models/configs")
}

func getTestTable(configName string, t *testing.T) *dbTable {
	schema := getTestSchema(t)
	// need to do this now because constraints are generated separately
	require.Nil(t, schema.generateShemaTables())

	return getTestTableFromSchema(configName, schema, t)
}

func getTestTableFromSchema(configName string, s *dbSchema, t *testing.T) *dbTable {
	node := s.schema.Nodes[configName]
	require.NotNil(t, node, "no codegen info for %s table", configName)
	table := s.getTableForNode(node.NodeData)
	require.NotNil(t, table, "no dbtable info for %s", configName)
	return table
}

func getTestEnumTableFromSchema(name string, s *dbSchema, t *testing.T) *dbTable {
	enumInfo := s.schema.Enums[name]
	require.NotNil(t, enumInfo, "no enum info for %s table", name)
	table := s.getTableForNode(enumInfo.NodeData)
	require.NotNil(t, table, "no dbtable info for %s", name)
	return table
}

func getTestColumn(tableConfigName, colFieldName string, t *testing.T) *dbColumn {
	table := getTestTable(tableConfigName, t)

	for _, column := range table.Columns {
		if column.EntFieldName == colFieldName {
			return column
		}
	}
	require.Fail(t, "no column %s for %s table", colFieldName, tableConfigName)
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

func getTestForeignKeyConstraint(t *testing.T, tableConfigName, colFieldName string) dbConstraint {
	table := getTestTable(tableConfigName, t)

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

func getTestPrimaryKeyConstraint(tableConfigName, colFieldName string, t *testing.T) dbConstraint {
	table := getTestTable(tableConfigName, t)

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

func getTestUniqueKeyConstraint(t *testing.T, tableConfigName string, colFieldName ...string) dbConstraint {
	table := getTestTable(tableConfigName, t)

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

func getTestIndexedConstraint(tableConfigName, colFieldName string, t *testing.T) dbConstraint {
	table := getTestTable(tableConfigName, t)

	for _, constraint := range table.Constraints {
		idxConstraint, ok := constraint.(*indexConstraint)
		if ok && idxConstraint.dbColumns[0].EntFieldName == colFieldName {
			// for now there can only be oen column so it's fine.
			return idxConstraint
		}
	}
	require.Fail(t, "no unique constraint for %s column for %s table", colFieldName, tableConfigName)
	return nil
}

func getAccountConfigContents(t *testing.T) string {
	// use a simple non-go file that we don't care about as it changes.
	path, err := filepath.Abs("../testdata/models/configs/simple_account_config.go.file")
	assert.Nil(t, err)
	file, err := ioutil.ReadFile(path)
	assert.Nil(t, err, "error loading account config")
	return string(file)
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

	//	spew.Dump(template.Edges)
	for _, edge := range template.Edges {
		if edge.EdgeName == edgeName {
			return &edge
		}
	}
	require.Fail(t, "no edge for %s found", edgeName)
	return nil
}

// inlining this in a bunch of places to break the import cycle
func parseSchema(t *testing.T, sources map[string]string, uniqueKeyForSources string) *schema.Schema {
	s, err := parseSchemaFull(t, sources, uniqueKeyForSources)
	require.Nil(t, err)
	return s
}

func parseSchemaFull(t *testing.T, sources map[string]string, uniqueKeyForSources string) (*schema.Schema, error) {
	data := parsehelper.ParseFilesForTest(
		t,
		parsehelper.Sources(uniqueKeyForSources, sources),
	)
	return schema.ParsePackage(data.Pkg)
}
