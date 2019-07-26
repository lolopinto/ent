package main

import (
	"fmt"
	"io/ioutil"
	"strconv"
	"strings"
	"testing"

	"github.com/lolopinto/ent/internal/parsehelper"
	"github.com/lolopinto/ent/internal/schema"
)

func TestIDColumn(t *testing.T) {
	col := getTestColumn("AccountConfig", "ID", t)

	parts := []string{
		strconv.Quote("id"),
		"UUID()",
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

	if table.QuotedTableName != strconv.Quote("accounts") {
		t.Errorf("invalid table name for table. expected %s, got %s", "accounts", table.QuotedTableName)
	}

	if len(table.Columns) != 8 {
		t.Errorf("invalid number of columns for table generated. expected %d, got %d", 6, len(table.Columns))
	}

	// 1 primary key and 1 unique key constraint expected
	if len(table.Constraints) != 2 {
		t.Errorf("invalid number of constraint for table generated. expected %d, got %d", 2, len(table.Constraints))
	}

	// 1 primary key and 1 foreign key constraint expected
	table = getTestTable("TodoConfig", t)
	if len(table.Constraints) != 2 {
		t.Errorf("invalid number of constraint for table generated. expected %d, got %d", 2, len(table.Constraints))
	}
}

func TestTablesFromSchema(t *testing.T) {
	schema := getTestSchema(t)
	schema.generateShemaTables()

	// accounts
	// todos
	// edge table
	// edge_config
	if len(schema.Tables) != 4 {
		t.Errorf("invalid number of tables in schema. got %d, expected 4", len(schema.Tables))
	}
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

func TestIntegerUserDefinedColumn(t *testing.T) {
	column := getTestColumn("AccountConfig", "NumberOfLogins", t)

	parts := []string{
		strconv.Quote("number_of_logins"),
		"sa.Integer()",
		"nullable=False",
	}
	testColumn(t, column, "number_of_logins", "NumberOfLogins", "number_of_logins", parts)
}

func TestTimeUserDefinedColumn(t *testing.T) {
	column := getTestColumn("AccountConfig", "LastLoginAt", t)

	parts := []string{
		strconv.Quote("last_login_at"),
		"sa.TIMESTAMP()",
		"nullable=False",
	}
	testColumn(t, column, "last_login_at", "LastLoginAt", "last_login_at", parts)
}

func TestUniqueColumn(t *testing.T) {
	column := getTestColumn("AccountConfig", "PhoneNumber", t)

	parts := []string{
		strconv.Quote("phone_number"), // db field
		"sa.Text()",                   // db type
		"nullable=False",
	}
	testColumn(t, column, "phone_number", "PhoneNumber", "phone_number", parts)

	constraint := getTestUniqueKeyConstraint("AccountConfig", "PhoneNumber", t)

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.UniqueConstraint(%s, name=%s)", strconv.Quote("phone_number"), strconv.Quote("accounts_unique_phone_number")),
	)
}

func TestForeignKeyColumn(t *testing.T) {
	column := getTestColumn("TodoConfig", "AccountID", t)

	parts := []string{
		strconv.Quote("account_id"), // db field
		"UUID()",                    // db type
		"nullable=False",
	}
	testColumn(t, column, "account_id", "AccountID", "account_id", parts)

	constraint := getTestForeignKeyConstraint("TodoConfig", "AccountID", t)
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

	schemas := getInMemoryTestSchemas(t, sources, "InvalidForeignKeyConfig")

	defer expectPanic(t, "invalid EntConfig accounts set as ForeignKey of field AccountID on ent config TodoConfig")

	getTestTableFromSchema("TodoConfig", schemas, t)
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

	schemas := getInMemoryTestSchemas(t, sources, "InvalidForeignKey")

	defer expectPanic(t, "invalid Field Bar set as ForeignKey of field AccountID on ent config TodoConfig")

	getTestTableFromSchema("TodoConfig", schemas, t)
}

func TestGeneratedEdgeConfigTable(t *testing.T) {
	// AccountConfig, edge called Friends,
	table := getTestTableByName("assoc_edge_config", t)

	if len(table.Columns) != 7 {
		t.Errorf("invalid number of columns for table generated. expected %d, got %d", 7, len(table.Columns))
	}

	// 1 primary key constraint for the edge_type field
	// 1 foreign key constraint for the inverse_edge_type field
	if len(table.Constraints) != 2 {
		t.Errorf("invalid number of constraint for table generated. expected %d, got %d", 1, len(table.Constraints))
	}
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
		"UUID()",
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

	if len(table.Constraints) != 2 {
		t.Errorf("expected 2 constraints in edge config table, got %d", len(table.Constraints))
	}
	constraint := getTestPrimaryKeyConstraintFromTable(table, "EdgeType", t)

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

	if len(table.Constraints) != 2 {
		t.Errorf("expected 2 constraints in edge config table, got %d", len(table.Constraints))
	}
	constraint := getTestForeignKeyConstraintFromTable(table, "InverseEdgeType", t)

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
	// AccountConfig, edge called Friends,
	table := getTestTableByName("accounts_friends_edge", t)

	if len(table.Columns) != 7 {
		t.Errorf("invalid number of columns for table generated. expected %d, got %d", 7, len(table.Columns))
	}

	// 1 primary key constraint for the id1, edge_type, id2 fields
	if len(table.Constraints) != 1 {
		t.Errorf("invalid number of constraint for table generated. expected %d, got %d", 1, len(table.Constraints))
	}
}

func TestID1EdgeColumn(t *testing.T) {
	col := getEdgeColumn("id1", t)

	parts := []string{
		strconv.Quote("id1"),
		"UUID()",
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
		"UUID()",
		"nullable=False",
	}
	testColumn(t, col, "edge_type", "EdgeType", "edge_type", parts)
}

func TestID2EdgeColumn(t *testing.T) {
	col := getEdgeColumn("id2", t)

	parts := []string{
		strconv.Quote("id2"),
		"UUID()",
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
	testColumn(t, col, "time", "Time", "time", parts)
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

func TestPrimaryKeyConstraintInEdgeTable(t *testing.T) {
	table := getTestTableByName("accounts_friends_edge", t)

	if len(table.Constraints) != 1 {
		t.Errorf("expected 1 constraint in edge table, got %d", len(table.Constraints))
	}
	constraint := table.Constraints[0]

	testConstraint(
		t,
		constraint,
		fmt.Sprintf("sa.PrimaryKeyConstraint(%s, %s, %s, name=%s)",
			strconv.Quote("id1"),
			strconv.Quote("edge_type"),
			strconv.Quote("id2"),
			strconv.Quote("accounts_friends_edge_id1_edge_type_id2_pkey"),
		),
	)
}

func testColumn(t *testing.T, col *dbColumn, colName string, expectedFieldName, expectedDBColName string, colStringParts []string) {
	if col.EntFieldName != expectedFieldName {
		t.Errorf("EntFieldName for the %s column was not as expected. expected %s, got %s instead", colName, expectedFieldName, col.EntFieldName)
	}
	if col.DBColName != expectedDBColName {
		t.Errorf("DBColName for the %s column was not as expected. expected %s, got %s instead", colName, expectedDBColName, col.DBColName)
	}

	colString := col.getColString()
	expectedColString := strings.Join(colStringParts, ", ")
	if col.getColString() != expectedColString {
		t.Errorf("ColString for the %s column was not as expected. expected %s, got %s instead", colName, expectedColString, colString)
	}
}

func testConstraint(t *testing.T, constraint dbConstraint, expectedConstraintString string) {
	if constraint.getConstraintString() != expectedConstraintString {
		t.Errorf("getConstraintString() for constraint was not as expected. expected %s, got %s instead", expectedConstraintString, constraint.getConstraintString())
	}
}

func getParsedTestSchemaFiles(t *testing.T) schema.NodeMapInfo {
	// use parsehelper.ParseFilesForTest since that caches it
	data := parsehelper.ParseFilesForTest(
		t,
		// this is using the testdata local to gent
		// will be fixed and standardized at some point
		parsehelper.RootPath("./testdata/models/configs/"),
	)
	return schema.ParsePackage(data.Pkg)
}

func getTestSchema(t *testing.T) *dbSchema {
	return newDBSchema(getParsedTestSchemaFiles(t))
}

func getInMemoryTestSchemas(t *testing.T, sources map[string]string, uniqueKey string) *dbSchema {
	data := parsehelper.ParseFilesForTest(
		t,
		parsehelper.Sources(uniqueKey, sources),
	)
	return newDBSchema(schema.ParsePackage(data.Pkg))
}

func getTestTable(configName string, t *testing.T) *dbTable {
	schema := getTestSchema(t)

	return getTestTableFromSchema(configName, schema, t)
}

func getTestTableFromSchema(configName string, schema *dbSchema, t *testing.T) *dbTable {
	node := schema.nodes[configName]
	if node == nil {
		t.Errorf("no codegen info for %s table", configName)
	}
	table := schema.getTableForNode(node.NodeData)
	if table == nil {
		t.Errorf("no dbtable info for %s", configName)
	}
	return table
}

func getTestColumn(tableConfigName, colFieldName string, t *testing.T) *dbColumn {
	table := getTestTable(tableConfigName, t)

	for _, column := range table.Columns {
		if column.EntFieldName == colFieldName {
			return column
		}
	}
	t.Errorf("no column %s for %s table", colFieldName, tableConfigName)
	return nil
}

func getTestForeignKeyConstraint(tableConfigName, colFieldName string, t *testing.T) dbConstraint {
	table := getTestTable(tableConfigName, t)

	return getTestForeignKeyConstraintFromTable(table, colFieldName, t)
}

func getTestForeignKeyConstraintFromTable(table *dbTable, colFieldName string, t *testing.T) dbConstraint {
	for _, constraint := range table.Constraints {
		fkeyConstraint, ok := constraint.(*foreignKeyConstraint)
		if ok && fkeyConstraint.column.EntFieldName == colFieldName {
			return fkeyConstraint
		}
	}
	t.Errorf("no foreign key constraint for %s column for %s table", colFieldName, table.QuotedTableName)
	return nil
}

func getTestPrimaryKeyConstraint(tableConfigName, colFieldName string, t *testing.T) dbConstraint {
	table := getTestTable(tableConfigName, t)

	return getTestPrimaryKeyConstraintFromTable(table, colFieldName, t)
}

func getTestPrimaryKeyConstraintFromTable(table *dbTable, colFieldName string, t *testing.T) dbConstraint {
	for _, constraint := range table.Constraints {
		pKeyConstraint, ok := constraint.(*primaryKeyConstraint)
		if ok && pKeyConstraint.dbColumns[0].EntFieldName == colFieldName {
			// for now this only works on ID column so that's fine. TODO...
			return pKeyConstraint
		}
	}
	t.Errorf("no primary key constraint for %s column for %s table", colFieldName, table.QuotedTableName)
	return nil
}

func getTestUniqueKeyConstraint(tableConfigName, colFieldName string, t *testing.T) dbConstraint {
	table := getTestTable(tableConfigName, t)

	for _, constraint := range table.Constraints {
		uniqConstraint, ok := constraint.(*uniqueConstraint)
		fmt.Println(uniqConstraint, ok)
		if ok && uniqConstraint.dbColumns[0].EntFieldName == colFieldName {
			// for now there can only be oen column so it's fine.
			return uniqConstraint
		}
	}
	t.Errorf("no unique constraint for %s column for %s table", colFieldName, tableConfigName)
	return nil
}

func getAccountConfigContents(t *testing.T) string {
	file, err := ioutil.ReadFile("./testdata/models/configs/account_config.go")
	if err != nil {
		t.Errorf("error loading account config")
	}
	return string(file)
}

func getTestTableByName(tableName string, t *testing.T) *dbTable {
	tableName = strconv.Quote(tableName)
	schema := getTestSchema(t)
	schema.generateShemaTables()

	for _, table := range schema.Tables {
		if table.QuotedTableName == tableName {
			return table
		}
	}
	t.Errorf("no dbtable info for table %s", tableName)
	return nil
}

func getEdgeColumn(colDBName string, t *testing.T) *dbColumn {
	return getColumnFromNamedTable(colDBName, "accounts_friends_edge", t)
}

func getColumnFromNamedTable(colDBName, tableName string, t *testing.T) *dbColumn {
	table := getTestTableByName(tableName, t)

	for _, col := range table.Columns {
		if col.DBColName == colDBName {
			return col
		}
	}
	t.Errorf("no db column %s for accounts_friends_edge table", colDBName)
	return nil
}

func expectPanic(t *testing.T, expectedError string) {
	err, ok := recover().(error)
	if !ok {
		t.Errorf("recover didn't return an error")
	}
	if err == nil {
		t.Errorf("code did not panic")
	} else {
		if err.Error() != expectedError {
			t.Errorf("error not as expected, was %s instead", err.Error())
		}
	}
}
