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

type schemaInfo struct {
	Tables         []*dbTable
	nodes          map[string]*codegenNodeTemplateInfo
	configTableMap map[string]*dbTable
}

func newSchema(nodes map[string]*codegenNodeTemplateInfo) *schemaInfo {
	configTableMap := make(map[string]*dbTable)
	return &schemaInfo{
		nodes:          nodes,
		configTableMap: configTableMap,
	}
}

type dbTable struct {
	Columns   []*dbColumn
	TableName string
}

type dbColumn struct {
	EntFieldName string
	DBColName    string
	ColString    string
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

	columns = append(columns, schema.getIDColumn())
	columns = append(columns, schema.getCreatedAtColumn())
	columns = append(columns, schema.getUpdatedAtColumn())

	for _, field := range nodeData.Fields {
		columns = append(columns, schema.getColumnForField(&field, nodeData))
	}

	return &dbTable{
		TableName: nodeData.TableName,
		Columns:   columns,
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
			data:           schema, // TODO create an anonymous object that just has tables?
			pathToTemplate: "templates/schema.tmpl",
			templateName:   "schema.tmpl",
			pathToFile:     "models/configs/schema.py",
		},
	)
}

func (schema *schemaInfo) getDbTypeForField(f *fieldInfo) string {
	switch f.FieldType {
	case "string":
		return "Text()"
	case "bool":
		return "Boolean()"
	}
	panic("unsupported type for now")
}

func (schema *schemaInfo) getColumnForField(f *fieldInfo, nodeData *nodeTemplate) *dbColumn {
	parts := []string{
		f.getQuotedDBColName(),
		schema.getDbTypeForField(f),
	}
	schema.addForeignKeyToPart(f, nodeData, &parts)
	parts = append(parts, "nullable=False")
	return schema.getColumn(f.FieldName, f.getDbColName(), parts)
}

func (schema *schemaInfo) addForeignKeyToPart(f *fieldInfo, nodeData *nodeTemplate, parts *[]string) {
	fkey := f.TagMap["fkey"]
	if fkey == "" {
		return
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
			break
		}
	}

	// TODO add tests and update the comments
	if fkeyDbField == "" {
		die(fmt.Errorf("invalid Field %s set as ForeignKey of field %s on ent config %s", fkeyField, f.FieldName, nodeData.EntConfigName))
	}

	// generate a name for the foreignkey of the sort contacts_user_id_fkey.
	// It takes the table name, the name of the column that references a foreign column in a foreign table and the fkey keyword to generate
	fkeyNameParts := []string{
		tableName,
		f.getDbColName(),
		"fkey",
	}
	fkeyName := strings.Join(fkeyNameParts, "_")

	// amend parts to add foreignkey line to generated schema
	*parts = append(
		*parts,
		fmt.Sprintf(
			"ForeignKey(%s, ondelete=%s, name=%s)",
			strconv.Quote(strings.Join([]string{fkeyTableName, fkeyDbField}, ".")), // "user.id"
			strconv.Quote("CASCADE"),
			strconv.Quote(fkeyName),
		),
	)
}

func (schema *schemaInfo) getIDColumn() *dbColumn {
	return schema.getColumn(
		"ID",
		"id",
		[]string{
			strconv.Quote("id"),
			"UUID(as_uuid=True)",
			"primary_key=True",
		},
	)
}

func (schema *schemaInfo) getCreatedAtColumn() *dbColumn {
	return schema.getColumn(
		"CreatedAt",
		"created_at",
		[]string{
			strconv.Quote("created_at"),
			"Date",
			"nullable=False",
		},
	)
}

func (schema *schemaInfo) getUpdatedAtColumn() *dbColumn {
	return schema.getColumn(
		"UpdatedAt",
		"updated_at",
		[]string{
			strconv.Quote("updated_at"),
			"Date",
			"nullable=False",
		},
	)
}

func (schema *schemaInfo) getColumn(fieldName, dbName string, parts []string) *dbColumn {
	colString := strings.Join(parts, ", ")

	return &dbColumn{EntFieldName: fieldName, DBColName: dbName, ColString: colString}
}
