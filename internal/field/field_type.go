package field

import (
	"errors"
	"fmt"
	"go/types"
	"sort"
	"strconv"
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/jinzhu/inflection"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
)

type Field struct {
	// todo: abstract out these 2 also...
	FieldName           string
	tagMap              map[string]string
	topLevelStructField bool       // id, updated_at, created_at no...
	entType             types.Type // not all fields will have an entType. probably don't need this...

	fieldType enttype.TSGraphQLType // this is the underlying type for the field for graphql, db, etc
	// in certain scenarios we need a different type for graphql vs typescript
	graphqlFieldType enttype.TSGraphQLType
	dbColumn         bool
	hideFromGraphQL  bool
	private          bool
	polymorphic      *input.PolymorphicOptions
	// optional (in action)
	// need to break this into optional (not required in typescript actions)
	// ts nullable
	// graphql required (not nullable)
	nullable bool
	// special case to indicate that a field is optional in ts but nullable in graphql
	graphqlNullable          bool
	defaultValue             interface{}
	unique                   bool
	fkey                     *ForeignKeyInfo
	fieldEdge                *base.FieldEdgeInfo
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
	derivedWhenEmbedded bool

	singleFieldPrimaryKey bool
	inverseEdge           *edge.AssociationEdge
	// this is the package path that should be imported when the field is rendered in the ent
	// TODO use it
	pkgPath string

	// this is the package path of the datatype that referenced this field
	dataTypePkgPath string

	// these 3 should override exposeToActionsByDefault and topLevelStructField at some point since they're built to be reusable and work across types
	disableUserEditable     bool
	hasDefaultValueOnCreate bool
	hasDefaultValueOnEdit   bool

	forceRequiredInAction bool
	forceOptionalInAction bool
}

func newFieldFromInput(f *input.Field) (*Field, error) {
	ret := &Field{
		FieldName:                f.Name,
		nullable:                 f.Nullable,
		dbName:                   f.StorageKey,
		hideFromGraphQL:          f.HideFromGraphQL,
		private:                  f.Private,
		polymorphic:              f.Polymorphic,
		index:                    f.Index,
		graphQLName:              f.GraphQLName,
		defaultValue:             f.ServerDefault,
		unique:                   f.Unique,
		topLevelStructField:      true,
		dbColumn:                 true,
		exposeToActionsByDefault: true,
		singleFieldPrimaryKey:    f.PrimaryKey,
		disableUserEditable:      f.DisableUserEditable,
		hasDefaultValueOnCreate:  f.HasDefaultValueOnCreate,
		hasDefaultValueOnEdit:    f.HasDefaultValueOnEdit,
		derivedWhenEmbedded:      f.DerivedWhenEmbedded,

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
			if err := ret.setFieldType(enttype.GetNullableType(ret.entType, true)); err != nil {
				return nil, err
			}
		} else {
			if err := ret.setFieldType(enttype.GetType(ret.entType)); err != nil {
				return nil, err
			}
		}
	} else if f.Type != nil {
		typ, err := f.GetEntType()
		if err != nil {
			return nil, err
		}
		if err := ret.setFieldType(typ); err != nil {
			return nil, err
		}
	} else {
		return nil, errors.New("invalid input. no way to get the type")
	}

	if ret.private {
		ret.setPrivate()
	}

	getSchemaName := func(config string) string {
		// making TS and golang consistent
		// removing the Config suffix from golang
		return strings.TrimSuffix(config, "Config")
	}

	if f.ForeignKey != nil {
		if !f.ForeignKey.DisableIndex && !f.Unique {
			ret.index = true
		}
		ret.fkey = &ForeignKeyInfo{
			Schema:       getSchemaName(f.ForeignKey.Schema),
			Field:        f.ForeignKey.Column,
			Name:         f.ForeignKey.Name,
			DisableIndex: f.ForeignKey.DisableIndex,
		}
	}

	if f.FieldEdge != nil {
		ret.fieldEdge = &base.FieldEdgeInfo{
			Schema:   getSchemaName(f.FieldEdge.Schema),
			EdgeName: f.FieldEdge.InverseEdge,
		}
	}

	if ret.polymorphic != nil {
		if ret.fieldEdge != nil {
			return nil, fmt.Errorf("cannot specify fieldEdge on polymorphic field %s", ret.FieldName)
		}
		// set fieldEdge here based on polymorphic info

		fieldEdge, err := base.NewFieldEdgeInfo(ret.FieldName, ret.polymorphic, ret.unique)
		if err != nil {
			return nil, err
		}
		ret.fieldEdge = fieldEdge
	}

	return ret, nil
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
func (f *Field) AddForeignKeyFieldEdgeToEdgeInfo(edgeInfo *edge.EdgeInfo) error {
	fkeyInfo := f.ForeignKeyInfo()
	if fkeyInfo == nil {
		return fmt.Errorf("invalid field %s added", f.FieldName)
	}

	return edgeInfo.AddFieldEdgeFromForeignKeyInfo(f.FieldName, fkeyInfo.Schema+"Config", f.Nullable())
}

func (f *Field) AddFieldEdgeToEdgeInfo(edgeInfo *edge.EdgeInfo) error {
	fieldEdgeInfo := f.FieldEdgeInfo()
	if fieldEdgeInfo == nil {
		return fmt.Errorf("invalid field %s added", f.FieldName)
	}

	return edgeInfo.AddFieldEdgeFromFieldEdgeInfo(
		f.FieldName,
		fieldEdgeInfo,
		f.Nullable(),
	)
}

func (f *Field) AddForeignKeyEdgeToInverseEdgeInfo(edgeInfo *edge.EdgeInfo, nodeName string) error {
	fkeyInfo := f.ForeignKeyInfo()
	if fkeyInfo == nil {
		return fmt.Errorf("invalid field %s added", f.FieldName)
	}
	// nothing to do here
	if fkeyInfo.DisableIndex {
		return nil
	}
	edgeName := fkeyInfo.Name
	if edgeName == "" {
		edgeName = inflection.Plural(nodeName)
	}
	return edgeInfo.AddEdgeFromForeignKeyIndex(
		f.GetQuotedDBColName(),
		edgeName,
		nodeName,
	)
}

func (f *Field) GetDbTypeForField() string {
	return f.fieldType.GetDBType()
}

func (f *Field) GetGraphQLTypeForField() string {
	if f.graphqlFieldType != nil {
		return f.graphqlFieldType.GetGraphQLType()
	}
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

func (f *Field) FieldEdgeInfo() *base.FieldEdgeInfo {
	return f.fieldEdge
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

func (f *Field) EditableField() bool {
	return !f.disableUserEditable
}

func (f *Field) HasDefaultValueOnCreate() bool {
	return f.hasDefaultValueOnCreate
}

func (f *Field) HasDefaultValueOnEdit() bool {
	return f.hasDefaultValueOnEdit
}

func (f *Field) IDField() bool {
	if !f.topLevelStructField {
		return false
	}
	// TOOD this needs a better name, way of figuring out etc
	// TODO kill this and replace with EvolvedIDField
	return strings.HasSuffix(f.FieldName, "ID")
}

func (f *Field) IDType() bool {
	return enttype.IsIDType(f.fieldType)
}

func (f *Field) EvolvedIDField() bool {
	// hmm not all foreign keys are id types... since the primary key can really be anything
	// we "special case" enums for now but need to handle this later
	// TODO
	_, ok := f.fieldType.(enttype.EnumeratedType)
	if ok {
		return false
	}

	// TODO kill above and convert to this
	// if there's a fieldEdge or a foreign key or an inverse edge to this, this is an ID field
	// and we should use the ID type and add a builder
	return f.fieldEdge != nil || f.fkey != nil || f.inverseEdge != nil || f.polymorphic != nil
}

func (f *Field) QueryFromEnt() bool {
	// TODO #476
	return f.index && f.polymorphic != nil
}

func (f *Field) QueryFromEntName() string {
	if !f.QueryFromEnt() {
		return ""
	}
	ret := strings.TrimSuffix(f.CamelCaseName(), "ID")
	ret = strings.TrimSuffix(ret, "_id")
	return ret
}

// TODO probably gonna collapse into above
func (f *Field) QueryFrom() bool {
	// TODO #476
	if !f.index || f.polymorphic != nil {
		return false
	}
	return !strings.HasSuffix(f.FieldName, "ID")
}

func (f *Field) Nullable() bool {
	return f.nullable
}

func (f *Field) ForceRequiredInAction() bool {
	return f.forceRequiredInAction
}

func (f *Field) ForceOptionalInAction() bool {
	return f.forceOptionalInAction
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

// TODO add GoFieldName and kill FieldName as public...
func (f *Field) TsFieldName() string {
	// TODO need to solve these id issues generally
	if f.FieldName == "ID" {
		return "id"
	}
	return strcase.ToLowerCamel(f.FieldName)
}

func (f *Field) CamelCaseName() string {
	return strcase.ToCamel(f.FieldName)
}

func (f *Field) TsType() string {
	if f.EvolvedIDField() {
		if f.Nullable() {
			return (&enttype.NullableIDType{}).GetTSType()
		}
		return (&enttype.IDType{}).GetTSType()
	}
	return f.fieldType.GetTSType()
}

func (f *Field) ForeignImports() []string {
	ret := []string{}
	// field type requires imports. assumes it has been reserved separately
	typ, ok := f.fieldType.(enttype.TSTypeWithImports)
	if ok {
		ret = typ.GetTsTypeImports()
	}

	if f.fkey != nil {
		// foreign key with enum type requires an import
		enumType, ok := f.fieldType.(enttype.EnumeratedType)
		if ok {
			ret = append(ret, enumType.GetTSName())
		}
	}
	return ret
}

func (f *Field) getIDFieldTypeName() string {
	_, ok := f.fieldType.(enttype.EnumeratedType)
	// hmm not all foreign keys are id types... since the primary key can really be anything
	// we "special case" enums for now but need to handle this later
	// same logic from EvolvedIDField
	if ok {
		return ""
	}

	if f.polymorphic != nil {
		return "Ent"
	}
	var typeName string
	if f.fkey != nil {
		typeName = f.fkey.Schema
	} else if f.fieldEdge != nil {
		typeName = f.fieldEdge.Schema
	}
	return typeName
}

func (f *Field) getIDFieldType() string {
	return f.getIDFieldTypeName()
}

func (f *Field) TsBuilderType() string {
	typ := f.TsType()
	typeName := f.getIDFieldType()
	if typeName == "" {
		return typ
	}
	return fmt.Sprintf("%s | Builder<%s>", typ, typeName)
}

func (f *Field) TsBuilderImports() []string {
	ret := []string{}
	typ, ok := f.fieldType.(enttype.TSTypeWithImports)
	if ok {
		ret = typ.GetTsTypeImports()
	}
	typeName := f.getIDFieldType()
	if typeName == "" {
		return ret
	}
	ret = append(ret, typeName, "Builder")
	return ret
}

func (f *Field) GetNotNullableTsType() string {
	var baseType enttype.TSGraphQLType
	baseType = f.fieldType
	nonNullableType, ok := f.fieldType.(enttype.NonNullableType)
	if ok {
		baseType = nonNullableType.GetNonNullableType()
	}
	return baseType.GetTSType()
}

func (f *Field) GetFieldType() enttype.EntType {
	return f.fieldType
}

func (f *Field) setFieldType(fieldType enttype.Type) error {
	// TODO does this break golang?
	// if so, might be time?
	// we can pin to an old release to get the golang code generation working
	fieldEntType, ok := fieldType.(enttype.TSGraphQLType)
	if !ok {
		return fmt.Errorf("invalid type %T that cannot be stored in db etc", fieldType)
	}
	f.fieldType = fieldEntType
	return nil
}

func (f *Field) setGraphQLFieldType(fieldType enttype.Type) error {
	gqlType, ok := fieldType.(enttype.TSGraphQLType)
	if !ok {
		return fmt.Errorf("invalid type %T that's not a graphql type", fieldType)
	}
	f.graphqlFieldType = gqlType
	return nil
}

func (f *Field) setPrivate() {
	f.private = true
	f.hideFromGraphQL = true
	f.exposeToActionsByDefault = false
}

func (f *Field) AddInverseEdge(edge *edge.AssociationEdge) error {
	if f.fieldEdge == nil {
		return fmt.Errorf("cannot add an inverse edge on a field without a field edge")
	}
	var err error
	f.inverseEdge, err = edge.CloneWithCommonInfo(f.fieldEdge.Schema + "Config")
	return err
}

func (f *Field) GetInverseEdge() *edge.AssociationEdge {
	return f.inverseEdge
}

// for non-required fields in actions, we want to make it optional if it's not a required field
// in the action
func (f *Field) GetTSGraphQLTypeForFieldImports(forceOptional bool) []enttype.FileImport {
	var tsGQLType enttype.TSGraphQLType
	nullableType, ok := f.fieldType.(enttype.NullableType)

	if forceOptional && ok {
		tsGQLType = nullableType.GetNullableType()
	} else {
		// already null and/or not forceOptional
		tsGQLType = f.fieldType
	}
	return tsGQLType.GetTSGraphQLImports()
}

func (f *Field) IsEditableIDField() bool {
	if !f.EditableField() {
		return false
	}
	_, ok := f.GetFieldType().(enttype.IDMarkerInterface)
	return ok
}

func (f *Field) EmbeddableInParentAction() bool {
	if !f.EditableField() {
		return false
	}

	if f.EvolvedIDField() {
		return false
	}

	return !f.derivedWhenEmbedded
}

type Option func(*Field)

func Optional() Option {
	return func(f *Field) {
		// optional doesn't mean nullable...
		f.forceOptionalInAction = true
		f.graphqlNullable = true
	}
}

func Required() Option {
	return func(f *Field) {
		f.nullable = false
		f.forceRequiredInAction = true
	}
}

func (f *Field) Clone(opts ...Option) (*Field, error) {
	ret := &Field{
		FieldName:                f.FieldName,
		nullable:                 f.nullable,
		graphqlNullable:          f.graphqlNullable,
		dbName:                   f.dbName,
		hideFromGraphQL:          f.hideFromGraphQL,
		private:                  f.private,
		polymorphic:              f.polymorphic,
		index:                    f.index,
		graphQLName:              f.graphQLName,
		defaultValue:             f.defaultValue,
		unique:                   f.unique,
		topLevelStructField:      f.topLevelStructField,
		dbColumn:                 f.dbColumn,
		exposeToActionsByDefault: f.exposeToActionsByDefault,
		singleFieldPrimaryKey:    f.singleFieldPrimaryKey,
		disableUserEditable:      f.disableUserEditable,
		hasDefaultValueOnCreate:  f.hasDefaultValueOnCreate,
		hasDefaultValueOnEdit:    f.hasDefaultValueOnEdit,
		forceRequiredInAction:    f.forceRequiredInAction,
		forceOptionalInAction:    f.forceOptionalInAction,
		derivedWhenEmbedded:      f.derivedWhenEmbedded,

		// go specific things
		entType: f.entType,
		// can't just clone this. have to update this...
		fieldType:        f.fieldType,
		graphqlFieldType: f.graphqlFieldType,
		tagMap:           f.tagMap,
		pkgPath:          f.pkgPath,
		dataTypePkgPath:  f.dataTypePkgPath,

		// derived fields
		fkey:      f.fkey,
		fieldEdge: f.fieldEdge,
	}

	for _, opt := range opts {
		opt(ret)
	}

	if ret.nullable != f.nullable && !ret.nullable {
		nonNullableType, ok := ret.fieldType.(enttype.NonNullableType)
		if !ok {
			return nil, fmt.Errorf("couldn't covert the type %v to its non-nullable version for field %s", ret.fieldType, ret.FieldName)
		}
		if err := ret.setFieldType(nonNullableType.GetNonNullableType()); err != nil {
			return nil, err
		}
	}
	if ret.graphqlNullable && !f.graphqlNullable {
		nullableType, ok := ret.fieldType.(enttype.NullableType)
		if !ok {
			return nil, fmt.Errorf("couldn't covert the type %v to its nullable version for field %s", ret.fieldType, ret.FieldName)
		}
		if err := ret.setGraphQLFieldType(nullableType.GetNullableType()); err != nil {
			return nil, err
		}
	}
	return ret, nil
}
