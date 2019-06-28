package main

import (
	"fmt"
	"io/ioutil"
	"strconv"
	"strings"
	"testing"
)

func TestGetIDColumn(t *testing.T) {
	col := getEmptyTestSchema().getIDColumn()
	parts := []string{
		strconv.Quote("id"),
		"UUID()",
		"primary_key=True",
	}
	testColumn(t, col, "id", "ID", "id", parts)
}

func TestGetCreatedAtColumn(t *testing.T) {
	col := getEmptyTestSchema().getCreatedAtColumn()
	parts := []string{
		strconv.Quote("created_at"),
		"Date()",
		"nullable=False",
	}
	testColumn(t, col, "created_at", "CreatedAt", "created_at", parts)
}

func TestGetUpdatedAtColumn(t *testing.T) {
	col := getEmptyTestSchema().getUpdatedAtColumn()
	parts := []string{
		strconv.Quote("updated_at"),
		"Date()",
		"nullable=False",
	}
	testColumn(t, col, "updated_at", "UpdatedAt", "updated_at", parts)
}

func TestGetTableForNode(t *testing.T) {
	table := getTestTable("AccountConfig", t)

	if table.TableName != strconv.Quote("accounts") {
		t.Errorf("invalid table name for table. expected %s, got %s", "accounts", table.TableName)
	}

	if len(table.Columns) != 6 {
		t.Errorf("invalid number of columns for table generated. expected %d, got %d", 6, len(table.Columns))
	}
}

func TestStringUserDefinedColumn(t *testing.T) {
	column := getTestColumn("AccountConfig", "FirstName", t)

	parts := []string{
		strconv.Quote("first_name"),
		"Text()",
		"nullable=False",
	}
	testColumn(t, column, "first_name", "FirstName", "first_name", parts)
}

func TestIntegerUserDefinedColumn(t *testing.T) {
	column := getTestColumn("AccountConfig", "NumberOfLogins", t)

	parts := []string{
		strconv.Quote("number_of_logins"),
		"Integer()",
		"nullable=False",
	}
	testColumn(t, column, "number_of_logins", "NumberOfLogins", "number_of_logins", parts)
}

func TestForeignKeyColumn(t *testing.T) {
	column := getTestColumn("TodoConfig", "AccountID", t)

	parts := []string{
		strconv.Quote("account_id"), // db field
		"UUID()",                    // db type
		fmt.Sprintf(
			"ForeignKey(%s, ondelete=%s, name=%s)", // ForeignKey expected by alembic to generate
			strconv.Quote("accounts.id"),           // field foreign key is on
			strconv.Quote("CASCADE"),               // ondelete cascade
			strconv.Quote("todos_account_id_fkey"), // name of foreignkey field
		),
		"nullable=False",
	}
	testColumn(t, column, "account_id", "AccountID", "account_id", parts)
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

func getEmptyTestSchema() *schemaInfo {
	return newSchema(nil)
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

	var col *dbColumn
	for _, column := range table.Columns {
		if column.EntFieldName == colFieldName {
			col = column
			break
		}
	}
	if col == nil {
		t.Errorf("no column %s for %s table", colFieldName, tableConfigName)
	}
	return col
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
