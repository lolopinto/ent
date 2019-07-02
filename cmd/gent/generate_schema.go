package main

import (
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
	Columns     []*dbColumn
	Constraints []dbConstraint
	TableName   string
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

type primaryKeyConstraint struct {
	dbColumns []*dbColumn //theoretically supports more than one column but for now, there'll be only one
	tableName string
}

func (constraint *primaryKeyConstraint) getConstraintString() string {
	if len(constraint.dbColumns) != 1 {
		die(fmt.Errorf("doesn't support multiple columns yet"))
	}
	col := constraint.dbColumns[0]
	// name made of 3 parts: tableName, colName, pkey
	pkeyNameParts := []string{constraint.tableName, col.DBColName, "pkey"}
	return fmt.Sprintf(
		"sa.PrimaryKeyConstraint(%s, name=%s)",
		strconv.Quote(col.DBColName),
		strconv.Quote(getNameFromParts(pkeyNameParts)),
	)
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
		column, constraint := schema.getColumnInfoForField(&field, nodeData)
		columns = append(columns, column)
		if constraint != nil {
			constraints = append(constraints, constraint)
		}
	}

	return &dbTable{
		TableName:   nodeData.TableName,
		Columns:     columns,
		Constraints: constraints,
	}
}

func (schema *schemaInfo) generateSchema() {
	var tables []*dbTable

	for _, info := range schema.nodes {
		tables = append(tables, schema.getTableForNode(info.nodeData))
	}

	// sort tables by table name so that we are not always changing the order of the generated schema
	sort.Slice(tables, func(i, j int) bool {
		return tables[i].TableName < tables[j].TableName
	})

	schema.Tables = tables

	schema.writeSchemaFile()

	schema.generateDbSchema()
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
			TableName:   table.TableName,
			SchemaLines: lines,
		})
	}
	return ret
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

func (schema *schemaInfo) getColumnInfoForField(f *fieldInfo, nodeData *nodeTemplate) (*dbColumn, dbConstraint) {
	dbType, constraint := schema.getForeignKeyInfo(f, nodeData)

	col := schema.getColumn(f.FieldName, f.getDbColName(), dbType, []string{
		"nullable=False",
	})
	return col, constraint
}

func (schema *schemaInfo) getForeignKeyInfo(f *fieldInfo, nodeData *nodeTemplate) (string, dbConstraint) {
	dbType := schema.getDbTypeForField(f)

	fkey := f.TagMap["fkey"]
	if fkey == "" {
		return dbType, nil
	}
	// tablename and fkey struct tag are quoted so we have to unquote them
	fkeyRaw, err := strconv.Unquote(fkey)
	die(err)
	tableName, err := strconv.Unquote(nodeData.TableName)
	die(err)

	fkeyParts := strings.Split(fkeyRaw, ".")
	fkeyConfigName := fkeyParts[0]
	fkeyField := fkeyParts[1]

	fkeyConfig := schema.nodes[fkeyConfigName]
	if fkeyConfig == nil {
		die(fmt.Errorf("invalid EntConfig %s set as ForeignKey of field %s on ent config %s", fkeyConfigName, f.FieldName, nodeData.EntConfigName))
	}

	fkeyTable := schema.getTableForNode(fkeyConfig.nodeData)
	fkeyTableName, err := strconv.Unquote(fkeyTable.TableName)
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
	return dbType, constraint
}

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
