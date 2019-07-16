package field

import (
	"go/ast"
	"go/token"
	"go/types"
	"strconv"
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/util"
)

func newFieldInfo() *FieldInfo {
	fieldMap := make(map[string]*Field)
	return &FieldInfo{
		fieldMap: fieldMap,
	}
}

type FieldInfo struct {
	Fields   []*Field
	fieldMap map[string]*Field
}

func (fieldInfo *FieldInfo) addField(f *Field) {
	fieldInfo.Fields = append(fieldInfo.Fields, f)
	fieldInfo.fieldMap[f.FieldName] = f
}

func (fieldInfo *FieldInfo) GetFieldByName(fieldName string) *Field {
	return fieldInfo.fieldMap[fieldName]
}

func (fieldInfo *FieldInfo) InvalidateFieldForGraphQL(f *Field) {
	fByName := fieldInfo.GetFieldByName(f.FieldName)
	if fByName == nil {
		panic("invalid field passed to InvalidateFieldForGraphQL")
	}
	if fByName != f {
		panic("invalid field passed to InvalidateFieldForGraphQL")
	}
	f.exposeToGraphQL = false
}

type Field struct {
	// todo: abstract out these 2 also...
	FieldName             string
	FieldTag              string
	tagMap                map[string]string
	topLevelStructField   bool       // id, updated_at, created_at no...
	entType               types.Type // not all fields will have an entType. probably don't need this...
	fieldType             fieldType  // this is the underlying type for the field for graphql, db, etc
	dbColumn              bool
	exposeToGraphQL       bool
	singleFieldPrimaryKey bool
}

func (f *Field) GetDbColName() string {
	colName, err := strconv.Unquote(f.tagMap["db"])
	util.Die(err)

	return colName
}

func (f *Field) GetQuotedDBColName() string {
	return f.tagMap["db"]
}

func GetTypeInStructDefinition(f *Field) string {
	override, ok := f.fieldType.(fieldWithOverridenStructType)
	if ok {
		return override.GetStructType()
	}
	return f.entType.String()
}

func (f *Field) GetDbTypeForField() string {
	return f.fieldType.GetDBType()
}

func (f *Field) GetGraphQLTypeForField() string {
	return f.fieldType.GetGraphQLType()
}

func (f *Field) ExposeToGraphQL() (bool, string) {
	if !f.exposeToGraphQL {
		return false, ""
	}
	fieldName := f.GetUnquotedKeyFromTag("graphql")

	// field that should not be exposed to graphql e.g. passwords etc
	if fieldName == "_" {
		return false, ""
	}

	// TODO come up with a better way of handling this
	if f.FieldName == "ID" {
		fieldName = "id"
	}

	// no fieldName so generate one
	if fieldName == "" {
		fieldName = strcase.ToLowerCamel(f.FieldName)
	}
	return true, fieldName
}

func (f *Field) TopLevelStructField() bool {
	return f.topLevelStructField
}

func (f *Field) CreateDBColumn() bool {
	return f.dbColumn
}

func (f *Field) SingleFieldPrimaryKey() bool {
	return f.singleFieldPrimaryKey
}

func (f *Field) GetUnquotedKeyFromTag(key string) string {
	val := f.tagMap[key]
	if val == "" {
		return ""
	}
	rawVal, err := strconv.Unquote(val)
	util.Die(err)
	return rawVal
}

func GetFieldInfoForStruct(s *ast.StructType, fset *token.FileSet, info types.Info) *FieldInfo {
	fieldInfo := newFieldInfo()

	// TODO eventually get these from ent.Node instead of doing this manually
	// add id field
	fieldInfo.addField(&Field{
		FieldName:             "ID",
		tagMap:                getTagMapFromJustFieldName("ID"),
		exposeToGraphQL:       true,
		topLevelStructField:   false,
		dbColumn:              true,
		singleFieldPrimaryKey: true,
		fieldType:             &idType{},
	})

	// going to assume we don't want created at and updated at in graphql
	// TODO when we get this from ent.Node, use struct tag graphql: "_"
	// need to stop all this hardcoding going on

	// add created_at and updated_at fields
	fieldInfo.addField(&Field{
		FieldName:           "CreatedAt",
		tagMap:              getTagMapFromJustFieldName("CreatedAt"),
		exposeToGraphQL:     false,
		topLevelStructField: false,
		dbColumn:            true,
		fieldType:           &timeType{},
	})
	fieldInfo.addField(&Field{
		FieldName:           "UpdatedAt",
		tagMap:              getTagMapFromJustFieldName("UpdatedAt"),
		exposeToGraphQL:     false,
		topLevelStructField: false,
		dbColumn:            true,
		fieldType:           &timeType{},
	})

	for _, f := range s.Fields.List {
		fieldName := f.Names[0].Name
		// use this to rename GraphQL, db fields, etc
		// otherwise by default it passes this down
		//fmt.Printf("Field: %s Type: %s Tag: %v \n", fieldName, f.Type, f.Tag)

		tagStr, tagMap := getTagInfo(fieldName, f.Tag)

		entType := info.TypeOf(f.Type)
		fieldInfo.addField(&Field{
			FieldName:           fieldName,
			entType:             info.TypeOf(f.Type),
			fieldType:           getTypeForEntType(entType),
			FieldTag:            tagStr,
			tagMap:              tagMap,
			topLevelStructField: true,
			dbColumn:            true,
			exposeToGraphQL:     true,
		})
	}

	return fieldInfo
}

func getTagInfo(fieldName string, tag *ast.BasicLit) (string, map[string]string) {
	tagsMap := make(map[string]string)
	if t := tag; t != nil {
		// struct tag format should be something like `graphql:"firstName" db:"first_name"`
		tags := strings.Split(t.Value, "`")
		if len(tags) != 3 {
			panic("invalid struct tag format. handle better. struct tag not enclosed by backticks")
		}

		// each tag is separated by a space
		tags = strings.Split(tags[1], " ")
		for _, tagInfo := range tags {
			// TODO maybe eventually use a fancier struct tag library. for now, handle here
			// get each tag and create a map
			singleTag := strings.Split(tagInfo, ":")
			if len(singleTag) != 2 {
				panic("invalid struct tag format. handle better")
			}
			tagsMap[singleTag[0]] = singleTag[1]
		}
	}

	// add the db tag it it doesn't exist
	_, ok := tagsMap["db"]
	if !ok {
		tagsMap["db"] = strconv.Quote(strcase.ToSnake(fieldName))
	}

	//fmt.Println(len(tagsMap))
	//fmt.Println(tagsMap)
	// convert the map back to the struct tag string format
	var tags []string
	for key, value := range tagsMap {
		// TODO: abstract this out better. only specific tags should we written to the ent
		if key == "db" || key == "graphql" {
			tags = append(tags, key+":"+value)
		}
	}
	return "`" + strings.Join(tags, " ") + "`", tagsMap
}

func getTagMapFromJustFieldName(fieldName string) map[string]string {
	_, tagMap := getTagInfo(fieldName, nil)
	return tagMap
}
