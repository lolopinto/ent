package db

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/pkg/errors"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/file"
	"github.com/lolopinto/ent/internal/schema/input"

	"github.com/lolopinto/ent/data"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/util"
)

type Step struct {
}

func (s *Step) Name() string {
	return "db"
}

func (s *Step) ProcessData(data *codegen.Data) error {
	// generate python schema file and then make changes to underlying db
	db := newDBSchema(data.Schema, data.CodePath.GetRootPathToConfigs())
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
	TableName       string
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

type colBasedConstraint interface {
	getName() string
	getConstraintMethod() string
	getColumns() []*dbColumn
}

func getConstraintString(constraint colBasedConstraint) string {
	var formattedStrParts []string
	formattedObjs := []interface{}{constraint.getConstraintMethod()}

	for _, col := range constraint.getColumns() {
		// append all the %s we need for the names of the col in the formatted string
		formattedStrParts = append(formattedStrParts, "%s")

		// add quoted strings in order so we list the names of the columns in the call to sa.UniqueConstraint
		formattedObjs = append(formattedObjs, strconv.Quote(col.DBColName))
	}

	// add the name to the end of the list of formatted objs
	formattedObjs = append(formattedObjs, strconv.Quote(constraint.getName()))

	formattedStr := "%s(" + strings.Join(formattedStrParts, ", ") + ", name=%s)"
	return fmt.Sprintf(
		formattedStr,
		formattedObjs...,
	)
}

type primaryKeyConstraint struct {
	dbColumns []*dbColumn
	tableName string
	name      string
}

func (constraint *primaryKeyConstraint) getConstraintString() string {
	return getConstraintString(constraint)
}

func (constraint *primaryKeyConstraint) getName() string {
	if constraint.name != "" {
		return constraint.name
	}
	return schema.GetPrimaryKeyName(constraint.tableName, getNamesFromColumns(constraint.dbColumns)...)
}

func (constraint *primaryKeyConstraint) getConstraintMethod() string {
	return "sa.PrimaryKeyConstraint"
}

func (constraint *primaryKeyConstraint) getColumns() []*dbColumn {
	return constraint.dbColumns
}

type foreignKeyConstraint struct {
	tableName     string
	name          string
	columns       []*dbColumn
	fkeyTableName string
	fkeyColumns   []*dbColumn
	onDelete      string
}

func (constraint *foreignKeyConstraint) getConstraintString() string {
	onDelete := constraint.onDelete
	if onDelete == "" {
		onDelete = "CASCADE"
	}

	var colParts []string
	for _, col := range constraint.columns {
		colParts = append(colParts, strconv.Quote(col.DBColName))
	}
	cols := strings.Join(colParts, ",")

	var fkeyColParts []string
	for _, fkeyCol := range constraint.fkeyColumns {
		fkeyColParts = append(
			fkeyColParts,
			strconv.Quote(strings.Join([]string{constraint.fkeyTableName, fkeyCol.DBColName}, ".")),
		)
	}
	fkeyCols := strings.Join(fkeyColParts, ",")

	return fmt.Sprintf(
		//    sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], name="contacts_account_id_fkey", ondelete="CASCADE"),
		"sa.ForeignKeyConstraint([%s], [%s], name=%s, ondelete=%s)",
		cols,
		fkeyCols,
		strconv.Quote(constraint.name),
		strconv.Quote(onDelete),
	)
}

func getNamesFromColumns(cols []*dbColumn) []string {
	ret := make([]string, len(cols))
	for idx, col := range cols {
		ret[idx] = col.DBColName
	}
	return ret
}

type uniqueConstraint struct {
	dbColumns []*dbColumn
	tableName string
	name      string
}

func (constraint *uniqueConstraint) getConstraintString() string {
	return getConstraintString(constraint)
}

func (constraint *uniqueConstraint) getName() string {
	if constraint.name != "" {
		return constraint.name
	}
	return schema.GetUniqueKeyName(constraint.tableName, getNamesFromColumns(constraint.dbColumns)...)
}

func (constraint *uniqueConstraint) getConstraintMethod() string {
	return "sa.UniqueConstraint"
}

func (constraint *uniqueConstraint) getColumns() []*dbColumn {
	return constraint.dbColumns
}

type indexConstraint struct {
	dbColumns []*dbColumn
	tableName string
	unique    bool
	name      string
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

	idxName := constraint.name
	if idxName == "" {
		idxNameParts = append(idxNameParts, "idx")
		idxName = getNameFromParts(idxNameParts)
	}

	args := []string{
		strconv.Quote(idxName),
	}
	args = append(args, colNames...)
	if constraint.unique {
		args = append(args, "unique=True")
	}

	return fmt.Sprintf(
		"sa.Index(%s)", strings.Join(args, ", "),
	)
}

type checkConstraint struct {
	name      string
	condition string
}

func (constraint *checkConstraint) getConstraintString() string {
	return fmt.Sprintf("sa.CheckConstraint(%s, %s)", strconv.Quote(constraint.condition), strconv.Quote(constraint.name))
}

func newDBSchema(schema *schema.Schema, pathToConfigs string) *dbSchema {
	configTableMap := make(map[string]*dbTable)
	tableMap := make(map[string]*dbTable)
	return &dbSchema{
		schema:         schema,
		configTableMap: configTableMap,
		tableMap:       tableMap,
		pathToConfigs:  pathToConfigs,
	}
}

type dbSchema struct {
	Tables         []*dbTable
	schema         *schema.Schema
	configTableMap map[string]*dbTable
	tableMap       map[string]*dbTable
	pathToConfigs  string
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
		TableName:       nodeData.TableName,
		QuotedTableName: nodeData.GetQuotedTableName(),
		Columns:         columns,
		Constraints:     constraints,
	}
}

func (s *dbSchema) processConstraints(nodeData *schema.NodeData, columns []*dbColumn, constraints *[]dbConstraint) {
	for _, constraint := range nodeData.Constraints {
		switch constraint.Type {
		case input.PrimaryKey:
			err := s.addPrimaryKeyConstraint(nodeData, constraint, columns, constraints)
			util.Die(err)
			break

		case input.Unique:
			err := s.addUniqueConstraint(nodeData, constraint, columns, constraints)
			util.Die(err)
			break

		case input.ForeignKey:
			err := s.addForeignKeyConstraint(nodeData, constraint, columns, constraints)
			util.Die(err)
			break

		case input.Check:
			err := s.addCheckConstraint(nodeData, constraint, constraints)
			util.Die(err)

		default:
			util.Die(fmt.Errorf("unsupported constraint type %s", constraint.Type))
		}
	}

	// let's just use exising constraint for this
	for _, index := range nodeData.Indices {
		cols, err := findConstraintDBColumns(index.Columns, columns)
		util.Die(err)
		constraint := &indexConstraint{
			dbColumns: cols,
			tableName: nodeData.GetTableName(),
			unique:    index.Unique,
			name:      index.Name,
		}
		*constraints = append(*constraints, constraint)
	}
}

func (s *dbSchema) addTable(table *dbTable) {
	s.Tables = append(s.Tables, table)
	s.tableMap[table.TableName] = table
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

	// make sure to add lookup table enums to the schema
	for _, info := range s.schema.Enums {
		if !info.LookupTableEnum() {
			continue
		}
		// need to use getTableForNode because that adds to map
		table := s.getTableForNode(info.NodeData)
		s.addTable(table)
		// can process enum constraints immediately
		s.processConstraints(info.NodeData, table.Columns, &table.Constraints)
	}

	// process constraints after because easier to access tableMap for fkey constraints
	for _, info := range s.schema.Nodes {
		nodeData := info.NodeData

		table := s.tableMap[nodeData.TableName]

		s.processConstraints(nodeData, table.Columns, &table.Constraints)
	}

	if addedAtLeastOneTable {
		s.addEdgeConfigTable()
	}

	// sort tables by table name so that we are not always changing the order of the generated schema
	sort.Slice(s.Tables, func(i, j int) bool {
		return s.Tables[i].TableName < s.Tables[j].TableName
	})
}

func runPythonCommand(pathToConfigs string, extraArgs ...string) {
	args := []string{
		fmt.Sprintf("-s=%s", pathToConfigs),
		fmt.Sprintf("-e=%s", data.GetSQLAlchemyDatabaseURIgo()),
	}
	if len(extraArgs) > 0 {
		args = append(args, extraArgs...)
	}
	cmd := exec.Command("auto_schema", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	err := cmd.Run()
	if err != nil {
		log.Fatalf("cmd.Run() failed with %s\n", err)
	}
}

func (s *dbSchema) generateDbSchema() {
	runPythonCommand(s.pathToConfigs)
}

func UpgradeDB(codePathInfo *codegen.CodePath) {
	runPythonCommand(codePathInfo.GetRootPathToConfigs(), "-u=True")
}

func DowngradeDB(codePathInfo *codegen.CodePath, revision string) {
	runPythonCommand(codePathInfo.GetRootPathToConfigs(), fmt.Sprintf("-d=%s", revision))
}

func (s *dbSchema) writeSchemaFile() {
	util.Die(file.Write(&file.TemplatedBasedFileWriter{
		Data:              s.getSchemaForTemplate(),
		AbsPathToTemplate: util.GetAbsolutePath("db_schema.tmpl"),
		TemplateName:      "db_schema.tmpl",
		PathToFile:        fmt.Sprintf("%s/schema.py", s.pathToConfigs),
	}))
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

	addData := func(nodeData *schema.NodeData) {
		pkeys := []string{}
		for _, field := range nodeData.FieldInfo.Fields {
			// we only support single field primary keys here so this is the solution
			// eventually, this needs to change...
			if field.SingleFieldPrimaryKey() {
				pkeys = append(pkeys, strconv.Quote(field.GetDbColName()))
			}
		}

		var rows []string
		for _, row := range nodeData.DBRows {
			var kvPairs []string

			var keys []string
			seenKeys := make(map[string]bool)
			for k := range row {
				if seenKeys[k] {
					continue
				}
				seenKeys[k] = true
				keys = append(keys, k)
			}
			// sort the keys so we can have stable values for testing purposes
			// go through this once in case there's missing keys in some rows
			sort.Strings(keys)

			for _, k := range keys {
				v, ok := row[k]
				if !ok {
					continue
				}

				var val interface{}
				if v == nil {
					val = "None"
				} else {
					// we're assuming a scalar. works for strings, booleans, int, float etc
					b, err := json.Marshal(v)
					val = string(b)
					if err != nil {
						panic(errors.Wrap(err, "Error unmarshalling value"))
					}
				}
				kvPairs = append(kvPairs, fmt.Sprintf("'%s': %v", k, val))
			}
			rows = append(rows, fmt.Sprintf("{%s}", strings.Join(kvPairs, ", ")))
		}

		ret.Data = append(ret.Data, dbDataInfo{
			TableName: nodeData.TableName,
			Rows:      rows,
			Pkeys:     fmt.Sprintf("[%s]", strings.Join(pkeys, ", ")),
		})
	}

	// add data values
	for _, info := range s.schema.Enums {
		if info.LookupTableEnum() {
			addData(info.NodeData)
		}
	}

	for _, node := range s.schema.Nodes {
		if !node.NodeData.EnumTable {
			continue
		}

		nodeData := node.NodeData
		addData(nodeData)
	}

	// sort edges
	sort.Slice(ret.Edges, func(i, j int) bool {
		return ret.Edges[i].EdgeName < ret.Edges[j].EdgeName
	})

	// sort data
	sort.Slice(ret.Data, func(i, j int) bool {
		return ret.Data[i].TableName < ret.Data[j].TableName
	})
	return ret
}

func (s *dbSchema) getEdgeLine(edge *ent.AssocEdgeData) string {
	kvPairs := []string{
		s.getEdgeKVPair("edge_name", strconv.Quote(edge.EdgeName)),
		s.getEdgeKVPair("edge_type", strconv.Quote(string(edge.EdgeType))),
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
	if !edge.InverseEdgeType.Valid {
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
		name:      "assoc_edge_config_edge_type_pkey",
	})
	// TODO make edgeName column unique
	constraints = append(constraints, &uniqueConstraint{
		dbColumns: []*dbColumn{edgeNameCol},
		tableName: tableName,
	})
	// foreign key constraint on the edge_type column on the same table
	constraints = append(constraints, &foreignKeyConstraint{
		tableName:     tableName,
		columns:       []*dbColumn{inverseEdgeTypeCol},
		fkeyTableName: tableName,
		fkeyColumns:   []*dbColumn{edgeTypeCol},
		onDelete:      "RESTRICT",
		name:          "assoc_edge_config_inverse_edge_type_fkey",
	})

	s.addTable(&dbTable{
		TableName:       tableName,
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
		if s.tableMap[assocEdge.TableName] != nil {
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
		TableName:       tableName,
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

	// index is still on a per field type so we leave this here
	s.addIndexConstraint(f, nodeData, col, constraints)

	return col
}

func findColumn(columns []*dbColumn, name string) *dbColumn {
	for _, col := range columns {
		if col.DBColName == name || col.EntFieldName == name {
			return col
		}
	}
	return nil
}

func findConstraintDBColumns(constraintCols []string, columns []*dbColumn) ([]*dbColumn, error) {
	var dbColumns []*dbColumn

	for _, col := range constraintCols {
		dbColumn := findColumn(columns, col)
		if dbColumn == nil {
			return nil, fmt.Errorf("couldn't find column with name %s", col)
		}
		dbColumns = append(dbColumns, dbColumn)
	}
	return dbColumns, nil
}

func (s *dbSchema) addPrimaryKeyConstraint(nodeData *schema.NodeData, inputConstraint *input.Constraint, columns []*dbColumn, constraints *[]dbConstraint) error {
	dbColumns, err := findConstraintDBColumns(inputConstraint.Columns, columns)

	if err != nil {
		return err
	}

	constraint := &primaryKeyConstraint{
		name:      inputConstraint.Name,
		dbColumns: dbColumns,
		tableName: nodeData.GetTableName(),
	}
	*constraints = append(*constraints, constraint)
	return nil
}

var structNameRegex = regexp.MustCompile("([A-Za-z]+)Config")

// adds a foreignKeyConstraint to the array of constraints
// also returns new dbType of column
func (s *dbSchema) addForeignKeyConstraint(nodeData *schema.NodeData, inputConstraint *input.Constraint, columns []*dbColumn, constraints *[]dbConstraint) error {

	fkeyTableName := inputConstraint.ForeignKey.TableName
	fkeyTable := s.tableMap[fkeyTableName]
	if fkeyTable == nil {
		return fmt.Errorf("couldn't find table %s", fkeyTableName)
	}

	dbColumns, err := findConstraintDBColumns(inputConstraint.Columns, columns)
	if err != nil {
		return err
	}

	var fkeyColumns []*dbColumn

	for idx, colName := range inputConstraint.ForeignKey.Columns {
		fkeyCol := findColumn(fkeyTable.Columns, colName)
		if fkeyCol == nil {
			return fmt.Errorf("couldn't find foreign column with name %s", colName)
		}

		// if the foreign key is a uuid and we have it as string, convert the type we
		// store in the db from string to UUID. This only works the first time the table
		// is defined.
		// Need to handle uuid as a first class type in Config files and/or handle the conversion from string to uuid after the fact
		if fkeyCol.DBType == "postgresql.UUID()" {
			col := dbColumns[idx]
			if col.DBType == "sa.Text()" {
				col.DBType = "postgresql.UUID()"
			}
		}
		fkeyColumns = append(fkeyColumns, fkeyCol)
	}

	constraint := &foreignKeyConstraint{
		tableName:     nodeData.GetTableName(),
		columns:       dbColumns,
		fkeyTableName: fkeyTable.TableName,
		fkeyColumns:   fkeyColumns,
		name:          inputConstraint.Name,
		onDelete:      fmt.Sprintf("%s", inputConstraint.ForeignKey.OnDelete),
	}
	*constraints = append(*constraints, constraint)
	return nil
}

func (s *dbSchema) addUniqueConstraint(nodeData *schema.NodeData, inputConstraint *input.Constraint, columns []*dbColumn, constraints *[]dbConstraint) error {
	dbColumns, err := findConstraintDBColumns(inputConstraint.Columns, columns)

	if err != nil {
		return err
	}
	constraint := &uniqueConstraint{
		dbColumns: dbColumns,
		tableName: nodeData.GetTableName(),
		name:      inputConstraint.Name,
	}
	*constraints = append(*constraints, constraint)
	return nil
}

func (s *dbSchema) addIndexConstraint(f *field.Field, nodeData *schema.NodeData, col *dbColumn, constraints *[]dbConstraint) {
	if !f.Index() {
		return
	}
	constraint := &indexConstraint{
		dbColumns: []*dbColumn{col},
		tableName: nodeData.GetTableName(),
	}
	*constraints = append(*constraints, constraint)
}

func (s *dbSchema) addCheckConstraint(nodeData *schema.NodeData, inputConstraint *input.Constraint, constraints *[]dbConstraint) error {
	if len(inputConstraint.Columns) != 0 {
		return fmt.Errorf("constraint with columns not supported")
	}
	constraint := &checkConstraint{
		name:      inputConstraint.Name,
		condition: inputConstraint.Condition,
	}
	*constraints = append(*constraints, constraint)
	return nil
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
		"postgresql.UUID()",
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
		"postgresql.UUID()",
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
		"postgresql.UUID()",
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
		"postgresql.UUID()",
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

type dbDataInfo struct {
	TableName string
	Pkeys     string
	Rows      []string
}

// wrapper object to represent the list of tables that will be passed to a schema template file
type dbSchemaTemplate struct {
	Tables []dbSchemaTableInfo
	Edges  []dbEdgeInfo
	Data   []dbDataInfo
}
