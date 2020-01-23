package field

import (
	"errors"
	"go/ast"
	"go/types"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
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
	// really only used in tests
	NonEntFields []*NonEntField
	m            sync.Mutex
}

func (fieldInfo *FieldInfo) addField(f *Field) {
	fieldInfo.m.Lock()
	defer fieldInfo.m.Unlock()
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
	f.hideFromGraphQL = true
}

func (fieldInfo *FieldInfo) TopLevelFields() []*Field {
	var fields []*Field

	for _, f := range fieldInfo.Fields {
		if f.topLevelStructField {
			fields = append(fields, f)
		}
	}
	return fields
}

// ForeignKeyInfo stores config and field name of the foreign key object
type ForeignKeyInfo struct {
	Config string
	Field  string
}

type Field struct {
	// todo: abstract out these 2 also...
	FieldName           string
	FieldTag            string
	tagMap              map[string]string
	topLevelStructField bool            // id, updated_at, created_at no...
	entType             types.Type      // not all fields will have an entType. probably don't need this...
	fieldType           enttype.EntType // this is the underlying type for the field for graphql, db, etc
	dbColumn            bool
	hideFromGraphQL     bool
	nullable            bool
	defaultValue        interface{}
	unique              bool
	fkey                *ForeignKeyInfo
	index               bool
	dbName              string // storage key/column name for the field
	graphQLName         string
	exposeToActions     bool // TODO: figure out a better way for this long term. this is to allow password be hidden from reads but allowed in writes
	// once password is a top level configurable type, it can control this e.g. exposeToCreate mutation yes!,
	// expose to edit mutation no! obviously no delete. but then can be added in custom mutations e.g. editPassword()
	// same with email address. shouldn't just be available to willy/nilly edit
	singleFieldPrimaryKey bool
	//	LinkedEdge            edge.Edge
	InverseEdge *edge.AssociationEdge
	pkgPath     string
}

func newField(fieldName string) *Field {
	graphQLName := strcase.ToLowerCamel(fieldName)
	// TODO come up with a better way of handling this
	if fieldName == "ID" {
		graphQLName = "id"
	}

	return &Field{
		FieldName:           fieldName,
		topLevelStructField: true,
		dbColumn:            true,
		exposeToActions:     true,
		dbName:              strcase.ToSnake(fieldName),
		graphQLName:         graphQLName,
	}
}

func (f *Field) GetDbColName() string {
	return f.dbName
}

func (f *Field) GetQuotedDBColName() string {
	// this works because there's enough places that need to quote this so easier to just get this from tagMap as long as we keep it there
	return f.tagMap["db"]
}

func GetNilableTypeInStructDefinition(f *Field) string {
	// See comment in GetNonNilableType
	// In cases, where we want a Nillable type, we need to explicitly add it here
	structType := GetNonNilableType(f)
	if !f.Nullable() {
		return structType
	}
	return "*" + structType
}

func GetNonNilableType(f *Field) string {
	override, ok := f.fieldType.(enttype.FieldWithOverridenStructType)
	if ok {
		return override.GetStructType()
	}
	// Because of the current API for Fields, the underlying type
	// is always "string", "int", "float64", etc so this is never nullable
	// and we can just return the string representation here
	// since nullable is currently encoded as a struct tag
	return f.entType.String()
}

func (f *Field) GetDbTypeForField() string {
	return f.fieldType.GetDBType()
}

func (f *Field) GetGraphQLTypeForField() string {
	return f.fieldType.GetGraphQLType()
}

func (f *Field) GetCastToMethod() string {
	return f.fieldType.GetCastToMethod()
}

func (f *Field) GetZeroValue() string {
	return f.fieldType.GetZeroValue()
}

func (f *Field) ExposeToGraphQL() bool {
	return !f.hideFromGraphQL
}

func (f *Field) Unique() bool {
	return f.unique
}

func (f *Field) Index() bool {
	return f.index
}

func (f *Field) ForeignKeyInfo() *ForeignKeyInfo {
	return f.fkey
}

func (f *Field) GetGraphQLName() string {
	return f.graphQLName
}

func (f *Field) InstanceFieldName() string {
	return strcase.ToLowerCamel(f.FieldName)
}

func (f *Field) ExposeToActions() bool {
	return f.exposeToActions
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

func (f *Field) IDField() bool {
	if !f.topLevelStructField {
		return false
	}
	// TOOD this needs a better name
	return strings.HasSuffix(f.FieldName, "ID")
}

func (f *Field) Nullable() bool {
	return f.nullable
}

func (f *Field) DefaultValue() interface{} {
	return f.defaultValue
}

func (f *Field) PkgPath() string {
	return f.pkgPath
}

func (f *Field) setFieldType(fieldType enttype.Type) {
	fieldEntType, ok := fieldType.(enttype.EntType)
	if !ok {
		panic("invalid type that cannot be stored in db etc")
	}
	f.fieldType = fieldEntType
}

func (f *Field) setForeignKeyInfoFromString(fkey string) error {
	parts := strings.Split(fkey, ".")
	if len(parts) != 2 {
		return errors.New("invalid foreign key struct tag format")
	}
	configName := parts[0]
	field := parts[1]
	f.fkey = &ForeignKeyInfo{
		Config: configName,
		Field:  field,
	}
	return nil
}

func GetFieldInfoForStruct(s *ast.StructType, info *types.Info) *FieldInfo {
	fieldInfo := newFieldInfo()

	// TODO eventually get these from ent.Node instead of doing this manually
	// add id field
	idField := newField("ID")
	idField.tagMap = getTagMapFromJustFieldName("ID")
	idField.exposeToActions = false
	idField.topLevelStructField = false
	idField.singleFieldPrimaryKey = true
	idField.fieldType = &enttype.IDType{}
	fieldInfo.addField(idField)

	// going to assume we don't want created at and updated at in graphql
	// TODO when we get this from ent.Node, use struct tag graphql: "_"
	// need to stop all this hardcoding going on

	// add created_at and updated_at fields
	createdAtField := newField("CreatedAt")
	createdAtField.tagMap = getTagMapFromJustFieldName("CreatedAt")
	createdAtField.hideFromGraphQL = true
	createdAtField.exposeToActions = false
	createdAtField.topLevelStructField = false
	createdAtField.fieldType = &enttype.TimeType{}
	fieldInfo.addField(createdAtField)

	updatedAtField := newField("UpdatedAt")
	updatedAtField.tagMap = getTagMapFromJustFieldName("UpdatedAt")
	updatedAtField.hideFromGraphQL = true
	// immutable instead...
	updatedAtField.exposeToActions = false
	updatedAtField.topLevelStructField = false
	updatedAtField.fieldType = &enttype.TimeType{}
	fieldInfo.addField(updatedAtField)

	getUnquotedKeyFromTag := func(tagMap map[string]string, key string) string {
		val := tagMap[key]
		if val == "" {
			return ""
		}
		rawVal, err := strconv.Unquote(val)
		util.Die(err)
		return rawVal
	}

	isKeyTrue := func(tagMap map[string]string, key string) bool {
		return getUnquotedKeyFromTag(tagMap, key) == "true"
	}

	for _, f := range s.Fields.List {
		fieldName := f.Names[0].Name

		field := newField(fieldName)
		// use this to rename GraphQL, db fields, etc
		// otherwise by default it passes this down
		//fmt.Printf("Field: %s Type: %s Tag: %v \n", fieldName, f.Type, f.Tag)

		// we're not even putting new graphql tags there :/
		field.FieldTag, field.tagMap = getTagInfo(fieldName, f.Tag, field.dbName)

		tagMap := field.tagMap

		// override dbName
		if tagMap["db"] != "" {
			field.dbName = getUnquotedKeyFromTag(tagMap, "db")
		}

		if tagMap["default"] != "" {
			field.defaultValue = getUnquotedKeyFromTag(tagMap, "default")
		}
		field.nullable = isKeyTrue(tagMap, "nullable")

		field.entType = info.TypeOf(f.Type)
		field.setFieldType(enttype.GetNullableType(field.entType, field.nullable))

		field.unique = isKeyTrue(tagMap, "unique")
		field.index = isKeyTrue(tagMap, "index")
		field.setForeignKeyInfoFromString(getUnquotedKeyFromTag(tagMap, "fkey"))

		// only care when there's something here
		if tagMap["graphql"] != "" {
			graphQLName := getUnquotedKeyFromTag(tagMap, "graphql")

			// even when the tab says hide, we're keeping the name because actions needs a graphqlName returned??
			if graphQLName == "_" {
				field.hideFromGraphQL = true
			} else {
				// overriden name
				field.graphQLName = graphQLName
			}
		}
		fieldInfo.addField(field)
	}

	return fieldInfo
}

func getTagInfo(fieldName string, tag *ast.BasicLit, defaultDBName string) (string, map[string]string) {
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
		tagsMap["db"] = strconv.Quote(defaultDBName)
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
	sort.Strings(tags)
	return "`" + strings.Join(tags, " ") + "`", tagsMap
}

func getTagMapFromJustFieldName(fieldName string) map[string]string {
	_, tagMap := getTagInfo(fieldName, nil, strcase.ToCamel(fieldName))
	return tagMap
}

type NonEntField struct {
	FieldName string
	FieldType enttype.Type
}

func (f *NonEntField) GetGraphQLName() string {
	return strcase.ToLowerCamel(f.FieldName)
}
