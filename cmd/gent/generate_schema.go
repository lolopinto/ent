package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"

	"github.com/lolopinto/jarvis/data"
)

type schemaInfo struct {
	Tables []dbTable
}

type dbTable struct {
	Columns   []dbColumn
	TableName string
}

type dbColumn struct {
	ColString string
}

func generateSchema(nodes []*nodeTemplate) {
	var tables []dbTable

	for _, nodeData := range nodes {
		var columns []dbColumn

		columns = append(columns, getIDColumn())
		columns = append(columns, getCreatedAtColumn())
		columns = append(columns, getUpdatedAtColumn())

		for _, field := range nodeData.Fields {

			columns = append(columns, getColumnForField(field))
		}

		tables = append(tables, dbTable{
			TableName: nodeData.TableName,
			Columns:   columns,
		})
	}

	schema := schemaInfo{Tables: tables}
	//spew.Dump(schema)
	writeSchemaFile(&schema)

	generateDbSchema()
}

func generateDbSchema() {
	cmd := exec.Command(
		"python3",
		"python/auto_schema/gen_db_schema.py",
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

func writeSchemaFile(schema *schemaInfo) {
	writeFile(
		fileToWriteInfo{
			data:           schema,
			pathToTemplate: "cmd/gent/schema.tmpl",
			templateName:   "schema.tmpl",
			pathToFile:     "models/configs/schema.py",
		},
	)
}

func getDbTypeForField(f fieldInfo) string {
	switch f.FieldType {
	case "string":
		return "String(255)"
	}
	panic("unsupported type for now")
}

func getColumnForField(f fieldInfo) dbColumn {
	colName := f.TagMap["db"]
	return getColumn(
		[]string{
			colName,
			getDbTypeForField(f),
			"nullable=False",
		},
	)
}

func getIDColumn() dbColumn {
	return getColumn(
		[]string{
			"\"id\"",
			"UUID(as_uuid=True)",
			"primary_key=True",
		},
	)
}

func getCreatedAtColumn() dbColumn {
	return getColumn(
		[]string{
			"\"created_at\"",
			"Date",
			"nullable=False",
		},
	)
}

func getUpdatedAtColumn() dbColumn {
	return getColumn(
		[]string{
			"\"updated_at\"",
			"Date",
			"nullable=False",
		},
	)
}

func getColumn(parts []string) dbColumn {
	colString := strings.Join(parts, ", ")

	return dbColumn{ColString: colString}
}
