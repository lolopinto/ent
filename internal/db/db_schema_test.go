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
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/assert"
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

	// 1 primary key and 1 foreign key constraint expected
	table = getTestTable("TodoConfig", t)
	testConstraints(t, table, 2)
}

func TestTablesFromSchema(t *testing.T) {
	schema := getTestSchema(t)
	schema.generateShemaTables()

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

// TODO this test is useless
// for tests like this and the one above and in graphql, we need to change things to get the value from node_schema or something and then do math based on that
// func TestEdgesFromSchema(t *testing.T) {
// 	schema := getTestSchema(t)
// 	template := schema.getSchemaForTemplate()

// 	expEdges := 22
// 	assert.Equal(
// 		t,
// 		expEdges,
// 		len(template.Edges),
// 		"incorrect number of edges generated, expected %d got %d",
// 		expEdges,
// 		len(template.Edges),
// 	)
// }

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

	// this also tests overriden files
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
		"UUID()",                    // db type
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

	schemas := getInMemoryTestSchemas(t, sources, "InvalidForeignKeyConfig")

	assert.Panics(
		t,
		func() {
			getTestTableFromSchema("TodoConfig", schemas, t)
		},
		"invalid EntConfig accounts set as ForeignKey of field AccountID on ent config TodoConfig",
	)
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

	assert.Panics(
		t,
		func() {
			getTestTableFromSchema("TodoConfig", schemas, t)
		},
		"invalid Field Bar set as ForeignKey of field AccountID on ent config TodoConfig",
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
			strconv.Quote(fmt.Sprintf("%s_id1_edge_type_id2_pkey", table.GetUnquotedTableName())),
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

func testEdgeInSchema(t *testing.T, edge *dbEdgeInfo, expectedParts map[string]string) {
	parts := strings.Split(edge.EdgeLine, ",")
	for _, part := range parts {
		str := strings.TrimRight(strings.TrimLeft(part, "{"), "}")
		strParts := strings.Split(str, ":")
		if len(strParts) != 2 {
			t.Errorf("invalid format")
		}
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
	data := parsehelper.ParseFilesForTest(
		t,
		// this is using the testdata local to gent
		// will be fixed and standardized at some point
		//		parsehelper.RootPath("./testdata/models/configs/"),
	)
	return schema.ParsePackage(data.Pkg)
}

func getTestSchema(t *testing.T) *dbSchema {
	return newDBSchema(getParsedTestSchema(t))
}

func getInMemoryTestSchemas(t *testing.T, sources map[string]string, uniqueKey string) *dbSchema {
	return newDBSchema(parseSchema(
		t, sources, uniqueKey,
	))
}

func getTestTable(configName string, t *testing.T) *dbTable {
	schema := getTestSchema(t)

	return getTestTableFromSchema(configName, schema, t)
}

func getTestTableFromSchema(configName string, s *dbSchema, t *testing.T) *dbTable {
	node := s.schema.Nodes[configName]
	if node == nil {
		t.Errorf("no codegen info for %s table", configName)
	}
	table := s.getTableForNode(node.NodeData)
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

func getTestForeignKeyConstraintFromTable(t *testing.T, table *dbTable, colFieldName string) dbConstraint {
	for _, constraint := range table.Constraints {
		fkeyConstraint, ok := constraint.(*foreignKeyConstraint)
		if ok && fkeyConstraint.column.EntFieldName == colFieldName {
			//		util.StringsEqual(getColNames([]*dbColumn{fkeyConstraint.column}), colFieldName) {
			return fkeyConstraint
		}
	}
	t.Errorf("no foreign key constraint for %v column(s) for %s table", colFieldName, table.QuotedTableName)
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
	t.Errorf("no primary key constraint in table %s for column(s) %v", table.QuotedTableName, colFieldName)
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
	t.Errorf("no unique constraint in table %s for column(s) %v", table.QuotedTableName, colFieldName)
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
	t.Errorf("no unique constraint for %s column for %s table", colFieldName, tableConfigName)
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
	return getColumnFromNamedTable(colDBName, "account_folders_edges", t)
}

func getColumnFromNamedTable(colDBName, tableName string, t *testing.T) *dbColumn {
	table := getTestTableByName(tableName, t)

	for _, col := range table.Columns {
		if col.DBColName == colDBName {
			return col
		}
	}
	t.Errorf("no db column %s for account_folders_edges table", colDBName)
	return nil
}

func getEdgeByName(edgeName string, t *testing.T) *dbEdgeInfo {
	s := getTestSchema(t)
	template := s.getSchemaForTemplate()

	//	spew.Dump(template.Edges)
	for _, edge := range template.Edges {
		if edge.EdgeName == edgeName {
			return &edge
		}
	}
	t.Errorf("no edge for %s found", edgeName)
	return nil
}

// inlining this in a bunch of places to break the import cycle
func parseSchema(t *testing.T, sources map[string]string, uniqueKeyForSources string) *schema.Schema {
	data := parsehelper.ParseFilesForTest(
		t,
		parsehelper.Sources(uniqueKeyForSources, sources),
	)
	return schema.ParsePackage(data.Pkg)
}
