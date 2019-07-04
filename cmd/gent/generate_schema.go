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
	extraParts   []string
}

func (col *dbColumn) getColString() string {
	parts := []string{strconv.Quote(col.DBColName), col.DBType}
	parts = append(parts, col.extraParts...)
	return strings.Join(parts, ", ")
}

func (col *dbColumn) getLineInTable() string {
	return fmt.Sprintf("sa.Column(%s)", col.getColString())
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
	// these are hardcoded to one table/field now but can be changed later...
	tableName     string
	column        *dbColumn
	fkeyTableName string
	fkeyColumn    *dbColumn
	onDelete      string
}

func (constraint *foreignKeyConstraint) getConstraintString() string {
	// generate a name for the foreignkey of the sort contacts_user_id_fkey.
	// It takes the table name, the name of the column that references a foreign column in a foreign table and the fkey keyword to generate
	fkeyNameParts := []string{
		constraint.tableName,
		constraint.column.DBColName,
		"fkey",
	}
	onDelete := constraint.onDelete
	if onDelete == "" {
		onDelete = "CASCADE"
	}
	fkeyName := getNameFromParts(fkeyNameParts)
	return fmt.Sprintf(
		//    sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], name="contacts_account_id_fkey", ondelete="CASCADE"),
		"sa.ForeignKeyConstraint([%s], [%s], name=%s, ondelete=%s)",
		strconv.Quote(constraint.column.DBColName),
		strconv.Quote(strings.Join([]string{constraint.fkeyTableName, constraint.fkeyColumn.DBColName}, ".")), // "accounts.id"
		strconv.Quote(fkeyName),
		strconv.Quote(onDelete),
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

	addedAtLeastOneTable := false
	for _, info := range schema.nodes {
		nodeData := info.nodeData
		tables = append(tables, schema.getTableForNode(nodeData))

		if schema.addEdgeTables(nodeData, &tables) {
			addedAtLeastOneTable = true
		}
	}

	if addedAtLeastOneTable {
		schema.addEdgeConfigTable(&tables)
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

func (schema *schemaInfo) addEdgeConfigTable(tables *[]*dbTable) {
	tableName := "assoc_edge_config"
	var columns []*dbColumn
	var constraints []dbConstraint

	// what are the columns and constraints

	// actually, this may make sense as a manual EntConfig and node...

	edgeTypeCol := schema.getEdgeTypeColumn()
	columns = append(columns, edgeTypeCol)
	columns = append(columns, schema.getEdgeNameColumn())
	columns = append(columns, schema.getSymmetricColumn())
	inverseEdgeTypeCol := schema.getInverseEdgeTypeColumn()
	columns = append(columns, inverseEdgeTypeCol)
	columns = append(columns, schema.getEdgeTableColumn())

	// why not?
	columns = append(columns, schema.getCreatedAtColumn())
	columns = append(columns, schema.getUpdatedAtColumn())

	// primary key constraint on the edge_type col
	constraints = append(constraints, &primaryKeyConstraint{
		dbColumns: []*dbColumn{edgeTypeCol},
		tableName: tableName,
	})
	// foreign key constraint on the edge_type column on the same table
	constraints = append(constraints, &foreignKeyConstraint{
		tableName:     tableName,
		column:        inverseEdgeTypeCol,
		fkeyTableName: tableName,
		fkeyColumn:    edgeTypeCol,
		onDelete:      "RESTRICT",
	})

	table := &dbTable{
		QuotedTableName: strconv.Quote(tableName),
		Columns:         columns,
		Constraints:     constraints,
	}
	*tables = append(*tables, table)
}

func (schema *schemaInfo) addEdgeTables(nodeData *nodeTemplate, tables *[]*dbTable) bool {
	addedAtLeastOneTable := false
	for _, edge := range nodeData.Edges {
		// assoc edges associated with these
		assocEdge := edge.AssociationEdge
		if assocEdge == nil {
			continue
		}
		addedAtLeastOneTable = true
		table := schema.createEdgeTable(nodeData, edge, assocEdge)
		*tables = append(*tables, table)
	}
	return addedAtLeastOneTable
}

func (schema *schemaInfo) createEdgeTable(nodeData *nodeTemplate, edge edgeInfo, assocEdge *associationEdgeInfo) *dbTable {
	tableNameParts := []string{nodeData.getTableName(), strings.ToLower(edge.EdgeName), "edge"}
	tableName := getNameFromParts(tableNameParts)

	var columns []*dbColumn
	id1Col := schema.getID1Column()
	columns = append(columns, id1Col)
	columns = append(columns, schema.getID1TypeColumn())
	edgeTypeCol := schema.getEdgeTypeColumn()
	columns = append(columns, edgeTypeCol)
	id2Col := schema.getID2Column()
	columns = append(columns, id2Col)
	columns = append(columns, schema.getID2TypeColumn())
	columns = append(columns, schema.getTimeColumn())
	columns = append(columns, schema.getDataColumn())

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
	dbType := schema.getDbTypeForField(f)
	col := schema.getColumn(f.FieldName, f.getDbColName(), dbType, []string{
		"nullable=False",
	})

	schema.addForeignKeyConstraint(f, nodeData, col, constraints)
	schema.addUniqueConstraint(f, nodeData, col, constraints)
	return col
}

// adds a foreignKeyConstraint to the array of constraints
// also returns new dbType of column
func (schema *schemaInfo) addForeignKeyConstraint(f *fieldInfo, nodeData *nodeTemplate, col *dbColumn, constraints *[]dbConstraint) {
	fkey := f.TagMap["fkey"]
	if fkey == "" {
		return
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

	var fkeyColumn *dbColumn
	for _, fkeyCol := range fkeyTable.Columns {
		if fkeyCol.EntFieldName == fkeyField {
			fkeyColumn = fkeyCol

			// if the foreign key is a uuid and we have it as string, convert the type we
			// store in the db from string to UUID. This only works the first time the table
			// is defined.
			// Need to handle uuid as a first class type in Config files and/or handle the conversion from string to uuid after the fact
			if fkeyCol.DBType == "UUID()" && col.DBType == "sa.Text()" {
				col.DBType = "UUID()"
			}
			break
		}
	}

	if fkeyColumn == nil {
		die(fmt.Errorf("invalid Field %s set as ForeignKey of field %s on ent config %s", fkeyField, f.FieldName, nodeData.EntConfigName))
	}

	constraint := &foreignKeyConstraint{
		tableName:     tableName,
		column:        col,
		fkeyTableName: fkeyTableName,
		fkeyColumn:    fkeyColumn,
	}
	*constraints = append(*constraints, constraint)
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

// TODO: eventually create EntConfigs/EntPatterns for these and take it from that instead of this manual behavior.
// There's too many of this...

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
func (schema *schemaInfo) getEdgeTypeColumn() *dbColumn {
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
func (schema *schemaInfo) getDataColumn() *dbColumn {
	return schema.getColumn(
		"Data",
		"data",
		"sa.Text()",
		[]string{
			"nullable=True", // first nullable column! we should handle this correctly...
		},
	)
}

func (schema *schemaInfo) getSymmetricColumn() *dbColumn {
	return schema.getColumn(
		"Symmetric",
		"symmetric",
		"sa.Bool()",
		[]string{
			"nullable=False",
			"default=False",
		},
	)
}

func (schema *schemaInfo) getEdgeNameColumn() *dbColumn {
	return schema.getColumn(
		"EdgeName",
		"edge_name",
		"sa.Text()",
		[]string{
			"nullable=False",
		},
	)
}

func (schema *schemaInfo) getInverseEdgeTypeColumn() *dbColumn {
	return schema.getColumn(
		"InverseEdgeType",
		"inverse_edge_type",
		"UUID()",
		[]string{
			"nullable=True",
		},
	)
}

func (schema *schemaInfo) getEdgeTableColumn() *dbColumn {
	return schema.getColumn(
		"EdgeTable",
		"edge_table",
		"sa.Text()",
		[]string{
			"nullable=False",
		},
	)
}

func (schema *schemaInfo) getColumn(fieldName, dbName, dbType string, extraParts []string) *dbColumn {
	return &dbColumn{EntFieldName: fieldName, DBColName: dbName, DBType: dbType, extraParts: extraParts}
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
