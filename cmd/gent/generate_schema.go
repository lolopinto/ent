package main

import (
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"sort"
	"strconv"
	"strings"

	"github.com/lolopinto/ent/data"
)

func getNameFromParts(nameParts []string) string {
	return strings.Join(nameParts, "_")
}

type dbTable struct {
	Columns         []*dbColumn
	Constraints     []dbConstraint
	QuotedTableName string
}

type dbColumn struct {
	EntFieldName string
	DBColName    string
	DBType       string
	ColString    string
}

func (col *dbColumn) getLineInTable() string {
	return fmt.Sprintf("sa.Column(%s)", col.ColString)
}

type dbConstraint interface {
	getConstraintString() string
}

func getConstraintStringForColumnBasedConstraint(constraint dbConstraint) string {
	var dbColumns []*dbColumn
	var tableName string
	var extraNamePart string
	var beforeColNameParts bool
	var constraintName string

	pKeyConstraint, ok := constraint.(*primaryKeyConstraint)
	if ok {
		dbColumns = pKeyConstraint.dbColumns
		tableName = pKeyConstraint.tableName
		extraNamePart = "pkey"
		beforeColNameParts = false
		constraintName = "sa.PrimaryKeyConstraint"
	}
	uniqConstraint, ok := constraint.(*uniqueConstraint)
	if ok {
		dbColumns = uniqConstraint.dbColumns
		tableName = uniqConstraint.tableName
		extraNamePart = "unique"
		beforeColNameParts = true
		constraintName = "sa.UniqueConstraint"
	}
	if constraintName == "" {
		die(errors.New("invalid constraint passed"))
	}

	var formattedStrParts []string
	formattedObjs := []interface{}{constraintName}
	// name made of 3 parts: tableName, "unique", and then colNames... OR
	// tableName, colNames... and then "pkey"
	nameParts := []string{tableName}

	if beforeColNameParts {
		nameParts = append(nameParts, extraNamePart)
	}

	for _, col := range dbColumns {
		// append all the %s we need for the names of the col in the formatted string
		formattedStrParts = append(formattedStrParts, "%s")

		// add quoted strings in order so we list the names of the columns in the call to sa.UniqueConstraint
		formattedObjs = append(formattedObjs, strconv.Quote(col.DBColName))

		// add the col name to parts needed for name of the unique constraint
		nameParts = append(nameParts, col.DBColName)
	}

	if !beforeColNameParts {
		nameParts = append(nameParts, extraNamePart)
	}

	// add the name to the end of the list of formatted objs
	formattedObjs = append(formattedObjs, strconv.Quote(getNameFromParts(nameParts)))

	formattedStr := "%s(" + strings.Join(formattedStrParts, ", ") + ", name=%s)"
	return fmt.Sprintf(
		formattedStr,
		formattedObjs...,
	)
}

type primaryKeyConstraint struct {
	dbColumns []*dbColumn
	tableName string
}

func (constraint *primaryKeyConstraint) getConstraintString() string {
	return getConstraintStringForColumnBasedConstraint(constraint)
}

type foreignKeyConstraint struct {
	tableName     string
	fkeyTableName string // these are hardcoded to one table/field now but can be changed later...
	fkeyDbField   string
	field         *fieldInfo
}

func (constraint *foreignKeyConstraint) getConstraintString() string {
	// generate a name for the foreignkey of the sort contacts_user_id_fkey.
	// It takes the table name, the name of the column that references a foreign column in a foreign table and the fkey keyword to generate
	fkeyNameParts := []string{
		constraint.tableName,
		constraint.field.getDbColName(),
		"fkey",
	}
	fkeyName := getNameFromParts(fkeyNameParts)
	return fmt.Sprintf(
		//    sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], name="contacts_account_id_fkey", ondelete="CASCADE"),
		"sa.ForeignKeyConstraint([%s], [%s], name=%s, ondelete=%s)",
		constraint.field.getQuotedDBColName(),
		strconv.Quote(strings.Join([]string{constraint.fkeyTableName, constraint.fkeyDbField}, ".")), // "accounts.id"
		strconv.Quote(fkeyName),
		strconv.Quote("CASCADE"),
	)
}

type uniqueConstraint struct {
	dbColumns []*dbColumn
	tableName string
}

func (constraint *uniqueConstraint) getConstraintString() string {
	return getConstraintStringForColumnBasedConstraint(constraint)
}

func newSchema(nodes map[string]*codegenNodeTemplateInfo) *schemaInfo {
	configTableMap := make(map[string]*dbTable)
	return &schemaInfo{
		nodes:          nodes,
		configTableMap: configTableMap,
	}
}

type schemaInfo struct {
	Tables         []*dbTable
	nodes          map[string]*codegenNodeTemplateInfo
	configTableMap map[string]*dbTable
}

func (schema *schemaInfo) getTableForNode(nodeData *nodeTemplate) *dbTable {
	table := schema.configTableMap[nodeData.EntConfigName]
	if table != nil {
		return table
	}

	// create and store in map if it doesn't exit
	table = schema.createTableForNode(nodeData)
	schema.configTableMap[nodeData.EntConfigName] = table
	return table
}

func (schema *schemaInfo) createTableForNode(nodeData *nodeTemplate) *dbTable {
	var columns []*dbColumn
	var constraints []dbConstraint

	idCol, idConstraint := schema.getIDColumnInfo(nodeData.getTableName())
	columns = append(columns, idCol)
	constraints = append(constraints, idConstraint)

	columns = append(columns, schema.getCreatedAtColumn())
	columns = append(columns, schema.getUpdatedAtColumn())

	for _, field := range nodeData.Fields {
		column := schema.getColumnInfoForField(&field, nodeData, &constraints)
		columns = append(columns, column)
		// if colConstraints != nil {
		// 	constraints = append(constraints, colConstraints...)
		// }
	}

	return &dbTable{
		QuotedTableName: nodeData.TableName,
		Columns:         columns,
		Constraints:     constraints,
	}
}

func (schema *schemaInfo) generateSchema() {
	schema.generateShemaTables()

	schema.writeSchemaFile()

	schema.generateDbSchema()
}

func (schema *schemaInfo) generateShemaTables() {
	var tables []*dbTable

	for _, info := range schema.nodes {
		nodeData := info.nodeData
		tables = append(tables, schema.getTableForNode(nodeData))

		schema.addEdgeTables(nodeData, &tables)
	}

	// sort tables by table name so that we are not always changing the order of the generated schema
	sort.Slice(tables, func(i, j int) bool {
		return tables[i].QuotedTableName < tables[j].QuotedTableName
	})

	schema.Tables = tables
}

func (schema *schemaInfo) generateDbSchema() {
	cmd := exec.Command(
		"python3",
		getAbsolutePath("../../python/auto_schema/gen_db_schema.py"),
		"-s=models/configs",
		fmt.Sprintf("-e=%s", data.GetSQLAlchemyDatabaseURIgo()),
	)
	//spew.Dump(cmd)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err := cmd.Run()
	if err != nil {
		log.Fatalf("cmd.Run() failed with %s\n", err)
	}
}

func (schema *schemaInfo) writeSchemaFile() {
	writeFile(
		fileToWriteInfo{
			data:           schema.getSchemaForTemplate(),
			pathToTemplate: "templates/schema.tmpl",
			templateName:   "schema.tmpl",
			pathToFile:     "models/configs/schema.py",
		},
	)
}

func (schema *schemaInfo) getSchemaForTemplate() schemaForTemplate {
	ret := schemaForTemplate{}

	for _, table := range schema.Tables {

		var lines []string
		// columns first
		for _, col := range table.Columns {
			lines = append(lines, col.getLineInTable())
		}
		// then constraints
		for _, constraint := range table.Constraints {
			lines = append(lines, constraint.getConstraintString())
		}

		ret.Tables = append(ret.Tables, schemaTableInfo{
			TableName:   table.QuotedTableName,
			SchemaLines: lines,
		})
	}
	return ret
}

func (schema *schemaInfo) addEdgeTables(nodeData *nodeTemplate, tables *[]*dbTable) {
	for _, edge := range nodeData.Edges {
		// assoc edges associated with these
		assocEdge := edge.AssociationEdge
		if assocEdge == nil {
			continue
		}
		table := schema.createEdgeTable(nodeData, edge, assocEdge)
		*tables = append(*tables, table)
	}
}

func (schema *schemaInfo) createEdgeTable(nodeData *nodeTemplate, edge edgeInfo, assocEdge *associationEdgeInfo) *dbTable {
	tableNameParts := []string{nodeData.getTableName(), strings.ToLower(edge.EdgeName), "edge"}
	tableName := getNameFromParts(tableNameParts)

	var columns []*dbColumn
	id1Col := schema.getID1Column()
	columns = append(columns, id1Col)
	columns = append(columns, schema.getID1TypeColumn())
	edgeTypeCol := schema.getEdgeType()
	columns = append(columns, edgeTypeCol)
	id2Col := schema.getID2Column()
	columns = append(columns, id2Col)
	columns = append(columns, schema.getID2TypeColumn())
	columns = append(columns, schema.getTimeColumn())
	columns = append(columns, schema.getData())

	constraint := &primaryKeyConstraint{
		dbColumns: []*dbColumn{id1Col, edgeTypeCol, id2Col},
		tableName: tableName,
	}

	return &dbTable{
		QuotedTableName: strconv.Quote(tableName),
		Columns:         columns,
		Constraints:     []dbConstraint{constraint},
	}
}

func (schema *schemaInfo) getDbTypeForField(f *fieldInfo) string {
	switch f.FieldType {
	case "string":
		return "sa.Text()"
	case "bool":
		return "sa.Boolean()"
	case "int":
		return "sa.Integer()"
	case "time.Time":
		return "sa.TIMESTAMP()"
	}
	panic("unsupported type for now")
}

func (schema *schemaInfo) getColumnInfoForField(f *fieldInfo, nodeData *nodeTemplate, constraints *[]dbConstraint) *dbColumn {
	dbType := schema.addForeignKeyConstraint(f, nodeData, constraints)
	col := schema.getColumn(f.FieldName, f.getDbColName(), dbType, []string{
		"nullable=False",
	})
	schema.addUniqueConstraint(f, nodeData, col, constraints)
	return col
}

// adds a foreignKeyConstraint to the array of constraints
// also returns new dbType of column
func (schema *schemaInfo) addForeignKeyConstraint(f *fieldInfo, nodeData *nodeTemplate, constraints *[]dbConstraint) string {
	dbType := schema.getDbTypeForField(f)

	fkey := f.TagMap["fkey"]
	if fkey == "" {
		return dbType
	}
	// tablename and fkey struct tag are quoted so we have to unquote them
	fkeyRaw, err := strconv.Unquote(fkey)
	die(err)
	tableName := nodeData.getTableName()

	fkeyParts := strings.Split(fkeyRaw, ".")
	fkeyConfigName := fkeyParts[0]
	fkeyField := fkeyParts[1]

	fkeyConfig := schema.nodes[fkeyConfigName]
	if fkeyConfig == nil {
		die(fmt.Errorf("invalid EntConfig %s set as ForeignKey of field %s on ent config %s", fkeyConfigName, f.FieldName, nodeData.EntConfigName))
	}

	fkeyTable := schema.getTableForNode(fkeyConfig.nodeData)
	fkeyTableName, err := strconv.Unquote(fkeyTable.QuotedTableName)
	die(err)

	var fkeyDbField string
	for _, col := range fkeyTable.Columns {
		if col.EntFieldName == fkeyField {
			fkeyDbField = col.DBColName

			// if the foreign key is a uuid and we have it as string, convert the type we
			// store in the db from string to UUID. This only works the first time the table
			// is defined.
			// Need to handle uuid as a first class type in Config files and/or handle the conversion from string to uuid after the fact
			if col.DBType == "UUID()" && dbType == "sa.Text()" {
				dbType = "UUID()"
			}
			break
		}
	}

	if fkeyDbField == "" {
		die(fmt.Errorf("invalid Field %s set as ForeignKey of field %s on ent config %s", fkeyField, f.FieldName, nodeData.EntConfigName))
	}

	constraint := &foreignKeyConstraint{
		tableName:     tableName,
		fkeyTableName: fkeyTableName,
		fkeyDbField:   fkeyDbField,
		field:         f,
	}
	*constraints = append(*constraints, constraint)
	return dbType
}

func (schema *schemaInfo) addUniqueConstraint(f *fieldInfo, nodeData *nodeTemplate, col *dbColumn, constraints *[]dbConstraint) {
	unique := f.TagMap["unique"]
	if unique == "" {
		return
	}
	if unique != strconv.Quote("true") {
		die(fmt.Errorf("Invalid struct tag unique was not configured correctly"))
	}
	constraint := &uniqueConstraint{
		dbColumns: []*dbColumn{col},
		tableName: nodeData.getTableName(),
	}
	*constraints = append(*constraints, constraint)
}

// getIDColumnInfo returns the information needed for every ID column in a node table. Returns the column and constraint that
// every node table has
func (schema *schemaInfo) getIDColumnInfo(tableName string) (*dbColumn, dbConstraint) {
	col := schema.getColumn(
		"ID",
		"id",
		"UUID()",
		[]string{
			"nullable=False",
		},
	)
	constraint := &primaryKeyConstraint{
		dbColumns: []*dbColumn{col},
		tableName: tableName,
	}
	return col, constraint
}

// getCreatedAtColumn returns the dbColumn for every created_at column in a node table.
func (schema *schemaInfo) getCreatedAtColumn() *dbColumn {
	return schema.getColumn(
		"CreatedAt",
		"created_at",
		"sa.TIMESTAMP()",
		[]string{
			"nullable=False",
		},
	)
}

// getUpdatedAtColumn returns the dbColumn for every updated_at column in a node table.
func (schema *schemaInfo) getUpdatedAtColumn() *dbColumn {
	return schema.getColumn(
		"UpdatedAt",
		"updated_at",
		"sa.TIMESTAMP()",
		[]string{
			"nullable=False",
		},
	)
}

// getID1Column returns the id1 column for the first id in an edge table.
func (schema *schemaInfo) getID1Column() *dbColumn {
	return schema.getColumn(
		"ID1",
		"id1",
		"UUID()",
		[]string{
			"nullable=False",
		},
	)
}

// getID1TypeColumn returns the id1_type column for the type of the first id in an edge table.
func (schema *schemaInfo) getID1TypeColumn() *dbColumn {
	return schema.getColumn(
		"ID1Type",
		"id1_type",
		"sa.Text()",
		[]string{
			"nullable=False",
		},
	)
}

// getEdgeType returns the id1 column for the first id in an edge table.
func (schema *schemaInfo) getEdgeType() *dbColumn {
	return schema.getColumn(
		"EdgeType",
		"edge_type",
		"UUID()",
		[]string{
			"nullable=False",
		},
	)
}

// getID2Column returns the id2 column for the second id in an edge table.
func (schema *schemaInfo) getID2Column() *dbColumn {
	return schema.getColumn(
		"ID2",
		"id2",
		"UUID()",
		[]string{
			"nullable=False",
		},
	)
}

// getID2TypeColumn returns the id2_type column for the type of the second id in an edge table.
func (schema *schemaInfo) getID2TypeColumn() *dbColumn {
	return schema.getColumn(
		"ID2Type",
		"id2_type",
		"sa.Text()",
		[]string{
			"nullable=False",
		},
	)
}

// getTimeColumn returns the time column for the time the row was inserted in an edge table
func (schema *schemaInfo) getTimeColumn() *dbColumn {
	return schema.getColumn(
		"Time",
		"time",
		"sa.TIMESTAMP()",
		[]string{
			"nullable=False",
		},
	)
}

// getData returns the data column for any arbitrary data that can be stored in an edge table
func (schema *schemaInfo) getData() *dbColumn {
	return schema.getColumn(
		"Data",
		"data",
		"sa.Text()",
		[]string{
			"nullable=True", // first nullable column! we should handle this correctly...
		},
	)
}

func (schema *schemaInfo) getColumn(fieldName, dbName, dbType string, extraParts []string) *dbColumn {
	parts := []string{strconv.Quote(dbName), dbType}
	parts = append(parts, extraParts...)
	colString := strings.Join(parts, ", ")

	return &dbColumn{EntFieldName: fieldName, DBColName: dbName, DBType: dbType, ColString: colString}
}

// represents information needed by the schema template file to generate the schema for a table
type schemaTableInfo struct {
	TableName   string
	SchemaLines []string // list of lines that will be generated for each table e.g. sa.Column(...), sa.PrimaryKeyConstraint(...) etc
}

// wrapper object to represent the list of tables that will be passed to a schema template file
type schemaForTemplate struct {
	Tables []schemaTableInfo
}
