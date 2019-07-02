package main

import (
	"fmt"
	"io/ioutil"
	"strconv"
	"strings"
	"testing"
)

func TestGetIDColumn(t *testing.T) {
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

func TestGetCreatedAtColumn(t *testing.T) {
	col := getTestColumn("AccountConfig", "CreatedAt", t)

	parts := []string{
		strconv.Quote("created_at"),
		"sa.TIMESTAMP()",
		"nullable=False",
	}
	testColumn(t, col, "created_at", "CreatedAt", "created_at", parts)
}

func TestGetUpdatedAtColumn(t *testing.T) {
	col := getTestColumn("AccountConfig", "UpdatedAt", t)

	parts := []string{
		strconv.Quote("updated_at"),
		"sa.TIMESTAMP()",
		"nullable=False",
	}
	testColumn(t, col, "updated_at", "UpdatedAt", "updated_at", parts)
}

func TestGetTableForNode(t *testing.T) {
	table := getTestTable("AccountConfig", t)

	if table.TableName != strconv.Quote("accounts") {
		t.Errorf("invalid table name for table. expected %s, got %s", "accounts", table.TableName)
	}

	if len(table.Columns) != 8 {
		t.Errorf("invalid number of columns for table generated. expected %d, got %d", 6, len(table.Columns))
	}

	// 1 primary key and 1 unique key constraint expected
	if len(table.Constraints) != 2 {
		t.Errorf("invalid number of constraint for table generated. expected %d, got %d", 1, len(table.Constraints))
	}

	// 1 primary key and 1 foreign key constraint expected
	table = getTestTable("TodoConfig", t)
	if len(table.Constraints) != 2 {
		t.Errorf("invalid number of constraint for table generated. expected %d, got %d", 2, len(table.Constraints))
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

	sources["account"] = getAccountConfigContents(t)
	sources["todo"] = `
	package configs

type TodoConfig struct {
	Text      string
	AccountID string ` + "`fkey:\"accounts.ID\"`}" +
		`
	func (config *TodoConfig) GetTableName() string {
		return "todos"
	}
	`

	schemas := getInMemoryTestSchemas(sources)

	defer expectPanic(t, "invalid EntConfig accounts set as ForeignKey of field AccountID on ent config TodoConfig")

	getTestTableFromSchema("TodoConfig", schemas, t)
}

func TestInvalidForeignKeyColumn(t *testing.T) {
	sources := make(map[string]string)

	sources["account"] = getAccountConfigContents(t)
	sources["todo"] = `
	package configs

type TodoConfig struct {
	Text      string
	AccountID string ` + "`fkey:\"AccountConfig.Bar\"`}" +
		`
	func (config *TodoConfig) GetTableName() string {
		return "todos"
	}
	`

	schemas := getInMemoryTestSchemas(sources)

	defer expectPanic(t, "invalid Field Bar set as ForeignKey of field AccountID on ent config TodoConfig")

	getTestTableFromSchema("TodoConfig", schemas, t)
}

func testColumn(t *testing.T, col *dbColumn, colName string, expectedFieldName, expectedDBColName string, colStringParts []string) {
	if col.EntFieldName != expectedFieldName {
		t.Errorf("EntFieldName for the %s column was not as expected. expected %s, got %s instead", colName, expectedFieldName, col.EntFieldName)
	}
	if col.DBColName != expectedDBColName {
		t.Errorf("DBColName for the %s column was not as expected. expected %s, got %s instead", colName, expectedDBColName, col.DBColName)
	}

	expectedColString := strings.Join(colStringParts, ", ")
	if col.ColString != expectedColString {
		t.Errorf("ColString for the %s column was not as expected. expected %s, got %s instead", colName, expectedColString, col.ColString)
	}
}

func testConstraint(t *testing.T, constraint dbConstraint, expectedConstraintString string) {
	if constraint.getConstraintString() != expectedConstraintString {
		t.Errorf("getConstraintString() for constraint was not as expected. expected %s, got %s instead", expectedConstraintString, constraint.getConstraintString())
	}
}

func getTestSchema() *schemaInfo {
	return newSchema(
		parseAllSchemaFiles(
			"./testdata/models/configs",
			"",
			&codePath{
				PathToConfigs: "./testdata/models/configs/",
				PathToModels:  "./testdata/models/",
			},
		),
	)
}

func getInMemoryTestSchemas(sources map[string]string) *schemaInfo {
	return newSchema(
		parseSchemasFromSource(
			sources,
			"",
		),
	)
}

func getTestTable(configName string, t *testing.T) *dbTable {
	schemaFiles := getTestSchema()

	return getTestTableFromSchema(configName, schemaFiles, t)
}

func getTestTableFromSchema(configName string, schema *schemaInfo, t *testing.T) *dbTable {
	node := schema.nodes[configName]
	if node == nil {
		t.Errorf("no codegen info for %s table", configName)
	}
	table := schema.getTableForNode(node.nodeData)
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

	for _, constraint := range table.Constraints {
		fkeyConstraint, ok := constraint.(*foreignKeyConstraint)
		if ok && fkeyConstraint.field.FieldName == colFieldName {
			return fkeyConstraint
		}
	}
	t.Errorf("no foreign key constraint for %s column for %s table", colFieldName, tableConfigName)
	return nil
}

func getTestPrimaryKeyConstraint(tableConfigName, colFieldName string, t *testing.T) dbConstraint {
	table := getTestTable(tableConfigName, t)

	for _, constraint := range table.Constraints {
		pKeyConstraint, ok := constraint.(*primaryKeyConstraint)
		if ok {
			// for now this only works on ID column so that's fine. TODO...
			return pKeyConstraint
		}
	}
	t.Errorf("no primary key constraint for %s column for %s table", colFieldName, tableConfigName)
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
