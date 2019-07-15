package field

import (
	"go/ast"
	"go/importer"
	"go/parser"
	"go/token"
	"go/types"
	"strconv"
	"testing"
)

func TestFieldInfo(t *testing.T) {
	fieldInfo := getTestFieldInfo(t, "AccountConfig")

	length := len(fieldInfo.Fields)
	if length != 8 {
		t.Errorf("expected %d fields generated. got %d instead", 8, length)
	}
}

func TestIDField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "ID")

	testField(
		t,
		f,
		&Field{
			FieldName:             "ID",
			singleFieldPrimaryKey: true,
			exposeToGraphQL:       true,
			topLevelStructField:   false,
			dbColumn:              true,
		},
		"id",
	)
	testDBType(t, f, "UUID()")
	testGraphQLType(t, f, "ID!")
}

func TestCreatedAtField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "CreatedAt")

	testField(
		t,
		f,
		&Field{
			FieldName:             "CreatedAt",
			singleFieldPrimaryKey: false,
			exposeToGraphQL:       false,
			topLevelStructField:   false,
			dbColumn:              true,
		},
		"",
	)
	testDBType(t, f, "sa.TIMESTAMP()")
	testGraphQLType(t, f, "Time!")
}

func TestUpdatedAtField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "UpdatedAt")

	testField(
		t,
		f,
		&Field{
			FieldName:             "UpdatedAt",
			singleFieldPrimaryKey: false,
			exposeToGraphQL:       false,
			topLevelStructField:   false,
			dbColumn:              true,
		},
		"",
	)
	testDBType(t, f, "sa.TIMESTAMP()")
	testGraphQLType(t, f, "Time!")
}

func TestDefaultGraphQLField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "FirstName")

	testField(
		t,
		f,
		&Field{
			FieldName:             "FirstName",
			singleFieldPrimaryKey: false,
			exposeToGraphQL:       true,
			topLevelStructField:   true,
			dbColumn:              true,
		},
		"firstName",
	)
}

func TestOverridenGraphQLField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "LastLoginAt")

	testField(
		t,
		f,
		&Field{
			FieldName:             "LastLoginAt",
			singleFieldPrimaryKey: false,
			exposeToGraphQL:       true,
			topLevelStructField:   true,
			dbColumn:              true,
		},
		"lastLoginTime",
	)
}

func TestHiddenGraphQLField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "NumberOfLogins")

	testField(
		t,
		f,
		&Field{
			FieldName:             "NumberOfLogins",
			singleFieldPrimaryKey: false,
			exposeToGraphQL:       false,
			topLevelStructField:   true,
			dbColumn:              true,
		},
		"",
	)
}

func TestTypesForStringField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "FirstName")

	testDBType(t, f, "sa.Text()")
	testGraphQLType(t, f, "String!")
	testStructType(t, f, "string")
}

func TestTypesForIntergerField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "NumberOfLogins")

	testDBType(t, f, "sa.Integer()")
	testGraphQLType(t, f, "Int!") // this is a weird ish test because it's not exposed to graphql but that's neither here nor there...
	testStructType(t, f, "int")
}

func TestTypesForTimeField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "LastLoginAt")

	testDBType(t, f, "sa.TIMESTAMP()")
	testGraphQLType(t, f, "Time!")
	testStructType(t, f, "time.Time")
}

func TestTypesForBoolField(t *testing.T) {
	f := getTestFieldByName(t, "TodoConfig", "Completed")

	testDBType(t, f, "sa.Boolean()")
	testGraphQLType(t, f, "Boolean!")
	testStructType(t, f, "bool")
}

func TestTypesForCustomStringField(t *testing.T) {
	f := getTestFieldByName(t, "TodoConfig", "AccountType")

	testDBType(t, f, "sa.Text()")        // string in db because yup
	testGraphQLType(t, f, "String!")     // string in graphql because enum not exposed
	testStructType(t, f, "ent.NodeType") // strongly typed in golang
}

func TestDefaultDBField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "FirstName")

	testColName(t, f, "first_name")
}

func TestOverridenDBField(t *testing.T) {
	f := getTestFieldByName(t, "AccountConfig", "LastLoginAt")

	testColName(t, f, "last_login_time")
}

//func TestDefaultStructType(t *testing.)

func testField(t *testing.T, f, expFieldProps *Field, expectedGraphQLFieldName string) {
	//	expectedFieldName string, primaryKey bool, dbColumn bool, structField bool) {
	if f.FieldName != expFieldProps.FieldName {
		t.Errorf(
			"field name was not as expected, expected %s, got %s",
			expFieldProps.FieldName,
			f.FieldName,
		)
	}

	if f.SingleFieldPrimaryKey() != expFieldProps.singleFieldPrimaryKey {
		t.Errorf(
			"expected primary key to be %v, got %v instead",
			expFieldProps.singleFieldPrimaryKey,
			f.SingleFieldPrimaryKey(),
		)
	}

	expose, fieldName := f.ExposeToGraphQL()
	if expose != expFieldProps.exposeToGraphQL {
		t.Errorf(
			"expected field exposed to graphql status to return %v, got %v instead",
			expFieldProps.exposeToGraphQL,
			expose,
		)
	}

	if fieldName != expectedGraphQLFieldName {
		t.Errorf(
			"expected graphql field name to be %s, got %s instead",
			fieldName,
			expectedGraphQLFieldName,
		)
	}

	structField := f.TopLevelStructField()
	if structField != expFieldProps.topLevelStructField {
		t.Errorf(
			"expected top level struct field to be %v, got %v instead",
			structField,
			expFieldProps.topLevelStructField,
		)
	}

	dbColumn := f.CreateDBColumn()
	if dbColumn != expFieldProps.dbColumn {
		t.Errorf(
			"expected create db column for field to be %v, got %v instead",
			dbColumn,
			expFieldProps.dbColumn,
		)
	}
}

func testDBType(t *testing.T, f *Field, expectedType string) {
	if f.GetDbTypeForField() != expectedType {
		t.Errorf(
			"expected db type for field %s to be %s, got %s instead",
			f.FieldName,
			expectedType,
			f.GetDbTypeForField(),
		)
	}
}

func testGraphQLType(t *testing.T, f *Field, expectedType string) {
	if f.GetGraphQLTypeForField() != expectedType {
		t.Errorf(
			"expected graphql type for field %s to be %s, got %s instead",
			f.FieldName,
			expectedType,
			f.GetGraphQLTypeForField(),
		)
	}
}

func testStructType(t *testing.T, f *Field, expectedType string) {
	typ := GetTypeInStructDefinition(f)
	if typ != expectedType {
		t.Errorf(
			"expected type in struct definition for field %s to be %s, got %s instead",
			f.fieldType,
			expectedType,
			typ,
		)
	}
}

func testColName(t *testing.T, f *Field, expectedColName string) {
	if f.GetDbColName() != expectedColName {
		t.Errorf(
			"expected col name for field %s to be %s, got %s instead",
			f.FieldName,
			expectedColName,
			f.GetDbColName(),
		)
	}
	if f.GetQuotedDBColName() != strconv.Quote(expectedColName) {
		t.Errorf(
			"expected quoted col name for field %s to be %s, got %s instead",
			f.FieldName,
			strconv.Quote(expectedColName),
			f.GetQuotedDBColName(),
		)
	}
}

func getTestFieldInfo(t *testing.T, configName string) *FieldInfo {
	data := parseConfigFileForStruct(t)
	fieldInfo := GetFieldInfoForStruct(data.structMap[configName], data.fset, data.info)

	if fieldInfo == nil {
		t.Errorf("invalid fieldInfo retrieved")
	}
	return fieldInfo
}

func getTestFieldByName(t *testing.T, configName string, fieldName string) *Field {
	fieldInfo := getTestFieldInfo(t, configName)
	return fieldInfo.GetFieldByName(fieldName)
}

type configData struct {
	structMap map[string]*ast.StructType
	fset      *token.FileSet
	info      types.Info
}

// TODO abstract this logic into a reusable place.
// or as part of codegen package
// instead of returning these 3 objects. create a type that's returned here and that inspectFile in ent_codegen.go takes
func parseConfigFileForStruct(t *testing.T) *configData {
	filePaths := []string{
		"../testdata/models/configs/account_config.go",
		"../testdata/models/configs/todo_config.go",
	}
	fset := token.NewFileSet()

	var files []*ast.File
	for _, path := range filePaths {
		file, err := parser.ParseFile(fset, path, nil, parser.AllErrors)
		if err != nil {
			t.Errorf("could not parse config file at path %s", path)
		}
		files = append(files, file)
	}

	structMap := make(map[string]*ast.StructType)

	info := types.Info{
		Types: make(map[ast.Expr]types.TypeAndValue),
		Defs:  make(map[*ast.Ident]types.Object),
		Uses:  make(map[*ast.Ident]types.Object),
	}
	conf := types.Config{
		Importer: importer.Default(),
	}
	_, err := conf.Check("models/configs", fset, files, &info)
	if err != nil {
		t.Errorf("was unable to chek the file as needed. error: %s", err)
	}

	for _, file := range files {
		var st *ast.StructType
		var structName string
		ast.Inspect(file, func(node ast.Node) bool {
			if s, ok := node.(*ast.StructType); ok {
				st = s
			}

			if t, ok := node.(*ast.TypeSpec); ok && t.Type != nil {
				structName = t.Name.Name
			}
			return true
		})

		if st == nil || structName == "" {
			t.Errorf("count not parse a struct type from config file")
		}
		structMap[structName] = st
	}
	return &configData{
		structMap: structMap,
		fset:      fset,
		info:      info,
	}
}
