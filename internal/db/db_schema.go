package db

import (
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"sort"
	"strconv"
	"strings"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/file"

	"github.com/lolopinto/ent/data"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/util"
)

type Step struct {
}

func (p *Step) Name() string {
	return "db"
}

func (p *Step) ProcessData(data *codegen.Data) error {
	// generate python schema file and then make changes to underlying db
	db := newDBSchema(data.Schema)
	db.generateSchema()
	// right now it all panics but we have to change that lol
	return nil
}

var _ codegen.Step = &Step{}

func getNameFromParts(nameParts []string) string {
	return strings.Join(nameParts, "_")
}

type dbTable struct {
	Columns         []*dbColumn
	Constraints     []dbConstraint
	QuotedTableName string
}

func (t *dbTable) GetUnquotedTableName() string {
	str, err := strconv.Unquote(t.QuotedTableName)
	util.Die(err)
	return str
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
		util.Die(errors.New("invalid constraint passed"))
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

type indexConstraint struct {
	dbColumns []*dbColumn
	tableName string
}

func (constraint *indexConstraint) getConstraintString() string {
	idxNameParts := []string{
		constraint.tableName,
	}
	var colNames []string
	for _, col := range constraint.dbColumns {
		idxNameParts = append(idxNameParts, col.DBColName)
		colNames = append(colNames, strconv.Quote(col.DBColName))
	}
	idxNameParts = append(idxNameParts, "idx")

	fields := []string{
		strconv.Quote(getNameFromParts(idxNameParts)),
	}
	fields = append(fields, colNames...)

	return fmt.Sprintf(
		"sa.Index(%s)", strings.Join(fields, ", "),
	)
}

func newDBSchema(schema *schema.Schema) *dbSchema {
	configTableMap := make(map[string]*dbTable)
	tableMap := make(map[string]*dbTable)
	return &dbSchema{
		schema:         schema,
		configTableMap: configTableMap,
		tableMap:       tableMap,
	}
}

type dbSchema struct {
	Tables         []*dbTable
	schema         *schema.Schema
	configTableMap map[string]*dbTable
	tableMap       map[string]*dbTable
}

func (s *dbSchema) getTableForNode(nodeData *schema.NodeData) *dbTable {
	table := s.configTableMap[nodeData.EntConfigName]
	if table != nil {
		return table
	}

	// create and store in map if it doesn't exit
	table = s.createTableForNode(nodeData)
	s.configTableMap[nodeData.EntConfigName] = table
	return table
}

func (s *dbSchema) createTableForNode(nodeData *schema.NodeData) *dbTable {
	var columns []*dbColumn
	var constraints []dbConstraint

	for _, f := range nodeData.FieldInfo.Fields {
		if !f.CreateDBColumn() {
			continue
		}
		column := s.getColumnInfoForField(f, nodeData, &constraints)
		columns = append(columns, column)
	}

	return &dbTable{
		QuotedTableName: nodeData.TableName,
		Columns:         columns,
		Constraints:     constraints,
	}
}

func (s *dbSchema) addTable(table *dbTable) {
	s.Tables = append(s.Tables, table)
	s.tableMap[table.QuotedTableName] = table
}

func (s *dbSchema) generateSchema() {
	s.generateShemaTables()

	s.writeSchemaFile()

	s.generateDbSchema()
}

func (s *dbSchema) generateShemaTables() {

	addedAtLeastOneTable := false
	for _, info := range s.schema.Nodes {
		nodeData := info.NodeData
		s.addTable(s.getTableForNode(nodeData))

		if s.addEdgeTables(nodeData) {
			addedAtLeastOneTable = true
		}
	}

	if addedAtLeastOneTable {
		s.addEdgeConfigTable()
	}

	// sort tables by table name so that we are not always changing the order of the generated schema
	sort.Slice(s.Tables, func(i, j int) bool {
		return s.Tables[i].QuotedTableName < s.Tables[j].QuotedTableName
	})
}

func runPythonCommand(extraArgs ...string) {
	args := []string{
		util.GetAbsolutePath("../../python/auto_schema/gen_db_schema.py"),
		// TODO: this should be changed to use path to configs
		"-s=models/configs",
		fmt.Sprintf("-e=%s", data.GetSQLAlchemyDatabaseURIgo()),
	}
	if len(extraArgs) > 0 {
		args = append(args, extraArgs...)
	}
	cmd := exec.Command("python3", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err := cmd.Run()
	if err != nil {
		log.Fatalf("cmd.Run() failed with %s\n", err)
	}
}

func (s *dbSchema) generateDbSchema() {
	runPythonCommand()
}

func UpgradeDB() {
	runPythonCommand("-u=True")
}

func DowngradeDB(revision string) {
	runPythonCommand(fmt.Sprintf("-d=%s", revision))
}

func (s *dbSchema) writeSchemaFile() {
	file.Write(&file.TemplatedBasedFileWriter{
		Data:              s.getSchemaForTemplate(),
		AbsPathToTemplate: util.GetAbsolutePath("db_schema.tmpl"),
		TemplateName:      "db_schema.tmpl",
		// TODO: this should be change to use path to configs
		PathToFile: "models/configs/schema.py",
	})
}

func (s *dbSchema) getSchemaForTemplate() *dbSchemaTemplate {
	ret := &dbSchemaTemplate{}

	for _, table := range s.Tables {

		var lines []string
		// columns first
		for _, col := range table.Columns {
			lines = append(lines, col.getLineInTable())
		}
		// then constraints
		for _, constraint := range table.Constraints {
			lines = append(lines, constraint.getConstraintString())
		}

		ret.Tables = append(ret.Tables, dbSchemaTableInfo{
			TableName:   table.QuotedTableName,
			SchemaLines: lines,
		})
	}

	for _, edge := range s.schema.GetEdges() {
		ret.Edges = append(ret.Edges, dbEdgeInfo{
			EdgeName: edge.EdgeName,
			EdgeLine: s.getEdgeLine(edge),
		})
	}

	// sort edges
	sort.Slice(ret.Edges, func(i, j int) bool {
		return ret.Edges[i].EdgeName < ret.Edges[j].EdgeName
	})
	return ret
}

func (s *dbSchema) getEdgeLine(edge *ent.AssocEdgeData) string {
	kvPairs := []string{
		s.getEdgeKVPair("edge_name", strconv.Quote(edge.EdgeName)),
		s.getEdgeKVPair("edge_type", strconv.Quote(edge.EdgeType)),
		s.getEdgeKVPair("edge_table", strconv.Quote(edge.EdgeTable)),
		s.getEdgeKVPair("symmetric_edge", s.getSymmetricEdgeValInEdge(edge)),
		s.getEdgeKVPair("inverse_edge_type", s.getInverseEdgeValInEdge(edge)),
	}

	return fmt.Sprintf("{%s}", strings.Join(kvPairs, ", "))
}

func (s *dbSchema) getEdgeKVPair(key, val string) string {
	return strconv.Quote(key) + ":" + val
}

func (s *dbSchema) getSymmetricEdgeValInEdge(edge *ent.AssocEdgeData) string {
	if edge.SymmetricEdge {
		return "True"
	}
	return "False"
}

func (s *dbSchema) getInverseEdgeValInEdge(edge *ent.AssocEdgeData) string {
	if edge.InverseEdgeType == nil || !edge.InverseEdgeType.Valid {
		return "None"
	}
	return strconv.Quote(edge.InverseEdgeType.String)
}

func (s *dbSchema) addEdgeConfigTable() {
	tableName := "assoc_edge_config"
	var columns []*dbColumn
	var constraints []dbConstraint

	// actually, this may make sense as a manual EntConfig and node...

	edgeTypeCol := s.getEdgeTypeColumn()
	columns = append(columns, edgeTypeCol)
	edgeNameCol := s.getEdgeNameColumn()
	columns = append(columns, edgeNameCol)
	columns = append(columns, s.getSymmetricEdgeColumn())
	inverseEdgeTypeCol := s.getInverseEdgeTypeColumn()
	columns = append(columns, inverseEdgeTypeCol)
	columns = append(columns, s.getEdgeTableColumn())

	// // why not?
	columns = append(columns, s.getCreatedAtColumn())
	columns = append(columns, s.getUpdatedAtColumn())

	// primary key constraint on the edge_type col
	constraints = append(constraints, &primaryKeyConstraint{
		dbColumns: []*dbColumn{edgeTypeCol},
		tableName: tableName,
	})
	// TODO make edgeName column unique
	constraints = append(constraints, &uniqueConstraint{
		dbColumns: []*dbColumn{edgeNameCol},
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

	s.addTable(&dbTable{
		QuotedTableName: strconv.Quote(tableName),
		Columns:         columns,
		Constraints:     constraints,
	})
}

func (s *dbSchema) addEdgeTables(nodeData *schema.NodeData) bool {
	for _, assocEdge := range nodeData.EdgeInfo.Associations {
		// TODO add test for this. if we have an inverse edge, no need to create
		// a table for it since it's stored in the same table as original edge and that'll
		// handle creating table
		if assocEdge.IsInverseEdge {
			continue
		}
		// edge with shared table. nothing to do here
		if s.tableMap[strconv.Quote(assocEdge.TableName)] != nil {
			continue
		}
		table := s.createEdgeTable(nodeData, assocEdge)
		s.addTable(table)
	}
	return nodeData.EdgeInfo.HasAssociationEdges()
}

func (s *dbSchema) createEdgeTable(nodeData *schema.NodeData, assocEdge *edge.AssociationEdge) *dbTable {
	tableName := assocEdge.TableName

	var columns []*dbColumn
	id1Col := s.getID1Column()
	columns = append(columns, id1Col)
	columns = append(columns, s.getID1TypeColumn())
	edgeTypeCol := s.getEdgeTypeColumn()
	columns = append(columns, edgeTypeCol)
	id2Col := s.getID2Column()
	columns = append(columns, id2Col)
	columns = append(columns, s.getID2TypeColumn())
	columns = append(columns, s.getTimeColumn())
	columns = append(columns, s.getDataColumn())

	constraints := []dbConstraint{
		&primaryKeyConstraint{
			dbColumns: []*dbColumn{id1Col, edgeTypeCol, id2Col},
			tableName: tableName,
		},
	}

	// add unique constraint for edge
	// TODO this only works when it's one table per edge
	// we need to add logic to deal with this
	if assocEdge.Unique {
		constraints = append(constraints, &uniqueConstraint{
			dbColumns: []*dbColumn{
				id1Col,
				edgeTypeCol,
			},
			tableName: tableName,
		})
	}

	return &dbTable{
		QuotedTableName: strconv.Quote(tableName),
		Columns:         columns,
		Constraints:     constraints,
	}
}

func (s *dbSchema) getColumnInfoForField(f *field.Field, nodeData *schema.NodeData, constraints *[]dbConstraint) *dbColumn {
	dbType := f.GetDbTypeForField()
	var extraParts []string
	if f.Nullable() {
		extraParts = append(extraParts, "nullable=True")
	} else {
		extraParts = append(extraParts, "nullable=False")
	}
	if f.DefaultValue() != nil {
		extraParts = append(extraParts, fmt.Sprintf("server_default='%s'", f.DefaultValue()))
	}
	col := s.getColumn(f.FieldName, f.GetDbColName(), dbType, extraParts)

	s.addPrimaryKeyConstraint(f, nodeData, col, constraints)
	s.addForeignKeyConstraint(f, nodeData, col, constraints)
	s.addUniqueConstraint(f, nodeData, col, constraints)
	s.addIndexConstraint(f, nodeData, col, constraints)

	return col
}

func (s *dbSchema) addPrimaryKeyConstraint(f *field.Field, nodeData *schema.NodeData, col *dbColumn, constraints *[]dbConstraint) {
	if !f.SingleFieldPrimaryKey() {
		return
	}

	constraint := &primaryKeyConstraint{
		dbColumns: []*dbColumn{col},
		tableName: nodeData.GetTableName(),
	}
	*constraints = append(*constraints, constraint)
}

// adds a foreignKeyConstraint to the array of constraints
// also returns new dbType of column
func (s *dbSchema) addForeignKeyConstraint(f *field.Field, nodeData *schema.NodeData, col *dbColumn, constraints *[]dbConstraint) {
	fkey := f.GetUnquotedKeyFromTag("fkey")
	if fkey == "" {
		return
	}
	// get unquoted table name
	tableName := nodeData.GetTableName()

	fkeyParts := strings.Split(fkey, ".")
	fkeyConfigName := fkeyParts[0]
	fkeyField := fkeyParts[1]

	fkeyConfig := s.schema.Nodes[fkeyConfigName]
	if fkeyConfig == nil {
		util.Die(fmt.Errorf("invalid EntConfig %s set as ForeignKey of field %s on ent config %s", fkeyConfigName, f.FieldName, nodeData.EntConfigName))
	}

	fkeyTable := s.getTableForNode(fkeyConfig.NodeData)
	fkeyTableName, err := strconv.Unquote(fkeyTable.QuotedTableName)
	util.Die(err)

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
		util.Die(fmt.Errorf("invalid Field %s set as ForeignKey of field %s on ent config %s", fkeyField, f.FieldName, nodeData.EntConfigName))
	}

	constraint := &foreignKeyConstraint{
		tableName:     tableName,
		column:        col,
		fkeyTableName: fkeyTableName,
		fkeyColumn:    fkeyColumn,
	}
	*constraints = append(*constraints, constraint)
}

func (s *dbSchema) addUniqueConstraint(f *field.Field, nodeData *schema.NodeData, col *dbColumn, constraints *[]dbConstraint) {
	unique := f.GetUnquotedKeyFromTag("unique")
	if unique == "" {
		return
	}
	if unique != "true" {
		util.Die(fmt.Errorf("Invalid struct tag unique was not configured correctly"))
	}
	constraint := &uniqueConstraint{
		dbColumns: []*dbColumn{col},
		tableName: nodeData.GetTableName(),
	}
	*constraints = append(*constraints, constraint)
}

func (s *dbSchema) addIndexConstraint(f *field.Field, nodeData *schema.NodeData, col *dbColumn, constraints *[]dbConstraint) {
	index := f.GetUnquotedKeyFromTag("index")
	if index == "" {
		return
	}
	if index != "true" {
		util.Die(fmt.Errorf("Invalid struct tag index was not configured correctly"))
	}
	constraint := &indexConstraint{
		dbColumns: []*dbColumn{col},
		tableName: nodeData.GetTableName(),
	}
	*constraints = append(*constraints, constraint)
}

// TODO: eventually create EntConfigs/EntPatterns for these and take it from that instead of this manual behavior.
// There's too many of this...

// TODO remove these. only exists for assoc_edge_config column until we change this
// getCreatedAtColumn returns the dbColumn for every created_at column in a node table.
func (s *dbSchema) getCreatedAtColumn() *dbColumn {
	return s.getColumn(
		"CreatedAt",
		"created_at",
		"sa.TIMESTAMP()",
		[]string{
			"nullable=False",
		},
	)
}

// getUpdatedAtColumn returns the dbColumn for every updated_at column in a node table.
func (s *dbSchema) getUpdatedAtColumn() *dbColumn {
	return s.getColumn(
		"UpdatedAt",
		"updated_at",
		"sa.TIMESTAMP()",
		[]string{
			"nullable=False",
		},
	)
}

// getID1Column returns the id1 column for the first id in an edge table.
func (s *dbSchema) getID1Column() *dbColumn {
	return s.getColumn(
		"ID1",
		"id1",
		"UUID()",
		[]string{
			"nullable=False",
		},
	)
}

// getID1TypeColumn returns the id1_type column for the type of the first id in an edge table.
func (s *dbSchema) getID1TypeColumn() *dbColumn {
	return s.getColumn(
		"ID1Type",
		"id1_type",
		"sa.Text()",
		[]string{
			"nullable=False",
		},
	)
}

// getEdgeType returns the id1 column for the first id in an edge table.
func (s *dbSchema) getEdgeTypeColumn() *dbColumn {
	return s.getColumn(
		"EdgeType",
		"edge_type",
		"UUID()",
		[]string{
			"nullable=False",
		},
	)
}

// getID2Column returns the id2 column for the second id in an edge table.
func (s *dbSchema) getID2Column() *dbColumn {
	return s.getColumn(
		"ID2",
		"id2",
		"UUID()",
		[]string{
			"nullable=False",
		},
	)
}

// getID2TypeColumn returns the id2_type column for the type of the second id in an edge table.
func (s *dbSchema) getID2TypeColumn() *dbColumn {
	return s.getColumn(
		"ID2Type",
		"id2_type",
		"sa.Text()",
		[]string{
			"nullable=False",
		},
	)
}

// getTimeColumn returns the time column for the time the row was inserted in an edge table
func (s *dbSchema) getTimeColumn() *dbColumn {
	return s.getColumn(
		"Time",
		"time",
		"sa.TIMESTAMP()",
		[]string{
			"nullable=False",
		},
	)
}

// getData returns the data column for any arbitrary data that can be stored in an edge table
func (s *dbSchema) getDataColumn() *dbColumn {
	return s.getColumn(
		"Data",
		"data",
		"sa.Text()",
		[]string{
			"nullable=True",
		},
	)
}

func (s *dbSchema) getSymmetricEdgeColumn() *dbColumn {
	// TODO handle reserved keywords automatically.
	// this was originally symmetric which isn't allowed
	// see https://www.postgresql.org/docs/8.1/sql-keywords-appendix.html
	return s.getColumn(
		"SymmetricEdge",
		"symmetric_edge",
		"sa.Boolean()",
		[]string{
			"nullable=False",
			"server_default='false'",
		},
	)
}

func (schema *dbSchema) getEdgeNameColumn() *dbColumn {
	return schema.getColumn(
		"EdgeName",
		"edge_name",
		"sa.Text()",
		[]string{
			"nullable=False",
		},
	)
}

func (s *dbSchema) getInverseEdgeTypeColumn() *dbColumn {
	return s.getColumn(
		"InverseEdgeType",
		"inverse_edge_type",
		"UUID()",
		[]string{
			"nullable=True",
		},
	)
}

func (s *dbSchema) getEdgeTableColumn() *dbColumn {
	return s.getColumn(
		"EdgeTable",
		"edge_table",
		"sa.Text()",
		[]string{
			"nullable=False",
		},
	)
}

func (s *dbSchema) getColumn(fieldName, dbName, dbType string, extraParts []string) *dbColumn {
	return &dbColumn{EntFieldName: fieldName, DBColName: dbName, DBType: dbType, extraParts: extraParts}
}

// represents information needed by the schema template file to generate the schema for a table
type dbSchemaTableInfo struct {
	TableName   string
	SchemaLines []string // list of lines that will be generated for each table e.g. sa.Column(...), sa.PrimaryKeyConstraint(...) etc
}

type dbEdgeInfo struct {
	EdgeName string
	EdgeLine string // generated line for edge (python dict)
}

// wrapper object to represent the list of tables that will be passed to a schema template file
type dbSchemaTemplate struct {
	Tables []dbSchemaTableInfo
	Edges  []dbEdgeInfo
}
