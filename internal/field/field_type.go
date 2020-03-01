package field

import (
	"fmt"
	"go/types"
	"sort"
	"strconv"
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/input"
)

type Field struct {
	// todo: abstract out these 2 also...
	FieldName                string
	tagMap                   map[string]string
	topLevelStructField      bool            // id, updated_at, created_at no...
	entType                  types.Type      // not all fields will have an entType. probably don't need this...
	fieldType                enttype.EntType // this is the underlying type for the field for graphql, db, etc
	dbColumn                 bool
	hideFromGraphQL          bool
	private                  bool
	nullable                 bool
	defaultValue             interface{}
	unique                   bool
	fkey                     *ForeignKeyInfo
	index                    bool
	dbName                   string // storage key/column name for the field
	graphQLName              string
	exposeToActionsByDefault bool
	// right now, it's blanket across all actions. probably want a way to make creations simpler
	// because often we may want to give the user a way to set a value for this field at creation and then not expose it
	// in default edit
	// so we could have exposeToActionsByDefault which is set to false by Private() and overrideExposeToCreate or something like that
	// which overrides that behavor for the create action
	// and also we need a way to restrict some fields to not even be set in triggers e.g. password can only be set by top-level-actions API
	// (e.g. graphql mutation/rest/worker job) and not via a trigger

	singleFieldPrimaryKey bool
	InverseEdge           *edge.AssociationEdge
	// this is the package path that should be imported when the field is rendered in the ent
	// TODO use it
	pkgPath string

	// this is the package path of the datatype that referenced this field
	dataTypePkgPath string
}

func newFieldFromInput(f *input.Field) *Field {
	ret := &Field{
		FieldName:                f.Name,
		nullable:                 f.Nullable,
		dbName:                   f.StorageKey,
		hideFromGraphQL:          f.HideFromGraphQL,
		private:                  f.Private,
		index:                    f.Index,
		graphQLName:              f.GraphQLName,
		defaultValue:             f.ServerDefault,
		unique:                   f.Unique,
		topLevelStructField:      true,
		dbColumn:                 true,
		exposeToActionsByDefault: true,

		// go specific things
		entType:         f.GoType,
		tagMap:          make(map[string]string),
		pkgPath:         f.PkgPath,
		dataTypePkgPath: f.DataTypePkgPath,
	}

	// todo need GoFieldName, TsFieldName, etc

	// default graphqlName
	if ret.graphQLName == "" {
		if ret.FieldName == "ID" {
			// TODO come up with a better way of handling this
			ret.graphQLName = "id"
		} else {
			ret.graphQLName = strcase.ToLowerCamel(ret.FieldName)
		}
	}

	if ret.dbName == "" {
		ret.dbName = strcase.ToSnake(ret.FieldName)
	}

	// override default tagMap if not nil
	if f.TagMap != nil {
		ret.tagMap = f.TagMap
	}

	// add db name to tag map regardless of source for now
	ret.addTag("db", strconv.Quote(ret.dbName))

	if ret.entType != nil {
		if ret.nullable {
			ret.setFieldType(enttype.GetNullableType(ret.entType, true))
		} else {
			ret.setFieldType(enttype.GetType(ret.entType))
		}
	}

	if ret.private {
		ret.setPrivate()
	}

	if f.ForeignKey != nil {
		ret.fkey = &ForeignKeyInfo{
			Config: f.ForeignKey[0],
			Field:  f.ForeignKey[1],
		}
	}

	// TODO f.Type

	return ret
}

func newField(fieldName string) *Field {
	graphQLName := strcase.ToLowerCamel(fieldName)
	// TODO come up with a better way of handling this
	if fieldName == "ID" {
		graphQLName = "id"
	}

	f := &Field{
		FieldName:                fieldName,
		topLevelStructField:      true,
		dbColumn:                 true,
		exposeToActionsByDefault: true,
		dbName:                   strcase.ToSnake(fieldName),
		graphQLName:              graphQLName,
		tagMap:                   make(map[string]string),
	}
	// seed with db name
	f.addTag("db", strconv.Quote(f.dbName))
	return f
}

func (f *Field) addTag(key, value string) {
	f.tagMap[key] = value
}

func (f *Field) GetDbColName() string {
	return f.dbName
}

func (f *Field) GetQuotedDBColName() string {
	// this works because there's enough places that need to quote this so easier to just get this from tagMap as long as we keep it there
	return f.tagMap["db"]
}

// We're going from field -> edge to be consistent and
// not have circular dependencies
func (f *Field) AddFieldEdgeToEdgeInfo(edgeInfo *edge.EdgeInfo) {
	fkeyInfo := f.ForeignKeyInfo()
	if fkeyInfo == nil {
		panic(fmt.Errorf("invalid field %s added", f.FieldName))
	}

	edgeInfo.AddFieldEdgeFromFieldInfo(f.FieldName, fkeyInfo.Config)
}

func (f *Field) AddForeignKeyEdgeToInverseEdgeInfo(edgeInfo *edge.EdgeInfo, nodeName string) {
	fkeyInfo := f.ForeignKeyInfo()
	if fkeyInfo == nil {
		panic(fmt.Errorf("invalid field %s added", f.FieldName))
	}
	edgeInfo.AddForeignKeyEdgeFromInverseFieldInfo(
		f.GetQuotedDBColName(),
		nodeName,
	)
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

func (f *Field) Private() bool {
	return f.private
}

// GetFieldNameInStruct returns the name of the field in the struct definition
// with capital letter for public fields. lowercase letter for package-private
func (f *Field) GetFieldNameInStruct() string {
	// private fields are package-private so we lowercase the name returned here
	if f.private {
		return strcase.ToLowerCamel(f.FieldName)
	}
	return f.FieldName
}

func (f *Field) InstanceFieldName() string {
	return strcase.ToLowerCamel(f.FieldName)
}

func (f *Field) ExposeToActionsByDefault() bool {
	return f.exposeToActionsByDefault
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

func (f *Field) GetFieldTag() string {
	// convert the map back to the struct tag string format
	var tags []string
	for key, value := range f.tagMap {
		// TODO: abstract this out better. only specific tags should we written to the ent
		if key == "db" || key == "graphql" {
			tags = append(tags, key+":"+value)
		}
	}
	if len(tags) == 0 {
		return ""
	}
	sort.Strings(tags)
	return "`" + strings.Join(tags, " ") + "`"
}

func (f *Field) setFieldType(fieldType enttype.Type) {
	fieldEntType, ok := fieldType.(enttype.EntType)
	if !ok {
		panic(fmt.Errorf("invalid type %T that cannot be stored in db etc", fieldType))
	}
	f.fieldType = fieldEntType
}

func (f *Field) setDBName(dbName string) {
	f.dbName = dbName
	f.addTag("db", f.dbName)
}

func (f *Field) setPrivate() {
	f.private = true
	f.hideFromGraphQL = true
	f.exposeToActionsByDefault = false
}
