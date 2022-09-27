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
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/edge"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/lolopinto/ent/internal/tsimport"
)

type Field struct {
	// note that if this changes, need to update FieldEqual
	// todo: abstract out these 2 also...
	FieldName           string
	tagMap              map[string]string
	topLevelStructField bool       // id, updated_at, created_at no...
	entType             types.Type // not all fields will have an entType. probably don't need this...

	fieldType enttype.TSGraphQLType // this is the underlying type for the field for graphql, db, etc
	// in certain scenarios we need a different type for graphql vs typescript
	graphqlFieldType enttype.TSGraphQLType
	tsFieldType      enttype.TSGraphQLType

	dbColumn        bool
	hideFromGraphQL bool
	private         bool
	polymorphic     *input.PolymorphicOptions
	// optional (in action)
	// need to break this into optional (not required in typescript actions)
	// ts nullable
	// graphql required (not nullable)
	nullable bool
	// special case to indicate that a field is optional in ts but nullable in graphql
	graphqlNullable          bool
	defaultValue             *string
	unique                   bool
	fkey                     *ForeignKeyInfo
	fieldEdge                *base.FieldEdgeInfo
	index                    bool
	dbName                   string // storage key/column name for the field
	graphQLName              string
	exposeToActionsByDefault bool
	disableBuilderType       bool
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
	disableUserEditable        bool
	disableUserGraphQLEditable bool
	hasDefaultValueOnCreate    bool
	hasDefaultValueOnEdit      bool
	hasFieldPrivacy            bool
	fetchOnDemand              bool

	forceRequiredInAction bool
	forceOptionalInAction bool

	patternName string
	userConvert *input.UserConvertType
}

// mostly used by tests
func NewFieldFromNameAndType(name string, typ enttype.TSGraphQLType) *Field {
	return &Field{
		FieldName: name,
		fieldType: typ,
	}
}

func newFieldFromInputTest(cfg codegenapi.Config, f *input.Field) (*Field, error) {
	return newFieldFromInput(cfg, "User", f)
}

func newFieldFromInput(cfg codegenapi.Config, nodeName string, f *input.Field) (*Field, error) {
	ret := &Field{
		FieldName:                  f.Name,
		nullable:                   f.Nullable,
		dbName:                     f.StorageKey,
		hideFromGraphQL:            f.HideFromGraphQL,
		private:                    f.Private != nil,
		polymorphic:                f.Polymorphic,
		index:                      f.Index,
		graphQLName:                f.GraphQLName,
		defaultValue:               f.ServerDefault,
		unique:                     f.Unique,
		topLevelStructField:        true,
		dbColumn:                   true,
		exposeToActionsByDefault:   true,
		singleFieldPrimaryKey:      f.PrimaryKey,
		disableUserEditable:        f.DisableUserEditable,
		disableUserGraphQLEditable: f.DisableUserGraphQLEditable,
		hasDefaultValueOnCreate:    f.HasDefaultValueOnCreate,
		hasDefaultValueOnEdit:      f.HasDefaultValueOnEdit,
		hasFieldPrivacy:            f.HasFieldPrivacy,
		fetchOnDemand:              f.FetchOnDemand,
		derivedWhenEmbedded:        f.DerivedWhenEmbedded,
		patternName:                f.PatternName,
		userConvert:                f.UserConvert,

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
			ret.graphQLName = codegenapi.GraphQLName(cfg, ret.FieldName)
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
		typ, err := f.GetEntType(nodeName)
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
		ret.setPrivate(f.Private)
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
		ret.disableBuilderType = f.ForeignKey.DisableBuilderType
	}

	if f.FieldEdge != nil {
		ret.fieldEdge = &base.FieldEdgeInfo{
			Schema:      getSchemaName(f.FieldEdge.Schema),
			InverseEdge: f.FieldEdge.InverseEdge,
		}
		ret.disableBuilderType = f.FieldEdge.DisableBuilderType
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
		ret.disableBuilderType = ret.polymorphic.DisableBuilderType
	}

	// if field privacy, whether on demand or ent load, the type here is nullable
	// same for fetch on load since the fetch can fail...
	if ret.hasFieldPrivacy || ret.fetchOnDemand {
		nullableType, ok := ret.fieldType.(enttype.NullableType)
		if ok {
			if err := ret.setGraphQLFieldType(nullableType.GetNullableType()); err != nil {
				return nil, err
			}
			if err := ret.setTsFieldType(nullableType.GetNullableType()); err != nil {
				return nil, err
			}
		}
	}

	return ret, nil
}

func newField(cfg codegenapi.Config, fieldName string) *Field {
	graphQLName := codegenapi.GraphQLName(cfg, fieldName)
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
func (f *Field) AddForeignKeyFieldEdgeToEdgeInfo(
	cfg codegenapi.Config,
	edgeInfo *edge.EdgeInfo,
	validSchema func(str string) bool,
) error {
	fkeyInfo := f.ForeignKeyInfo()
	if fkeyInfo == nil {
		return fmt.Errorf("invalid field %s added", f.FieldName)
	}

	return edgeInfo.AddFieldEdgeFromForeignKeyInfo(cfg, f.FieldName, fkeyInfo.Schema+"Config", f.Nullable(), f.fieldType, validSchema)
}

func (f *Field) AddFieldEdgeToEdgeInfo(
	cfg codegenapi.Config,
	edgeInfo *edge.EdgeInfo,
	validSchema func(str string) bool,
) error {
	fieldEdgeInfo := f.FieldEdgeInfo()
	if fieldEdgeInfo == nil {
		return fmt.Errorf("invalid field %s added", f.FieldName)
	}

	return edgeInfo.AddFieldEdgeFromFieldEdgeInfo(
		cfg,
		f.FieldName,
		fieldEdgeInfo,
		f.Nullable(),
		f.fieldType,
		validSchema,
	)
}

func (f *Field) AddForeignKeyEdgeToInverseEdgeInfo(
	cfg codegenapi.Config,
	edgeInfo *edge.EdgeInfo, nodeName string) error {
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
		cfg,
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
	// note this only applies to if the field should be exposed as readable
	// if the field is part of an action, it's exposed since either it's a create action or
	// has been explicitly specified by user
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
	if f.private {
		return nil
	}
	return f.fieldEdge
}

func (f *Field) GetGraphQLName() string {
	return f.graphQLName
}

func (f *Field) Private(cfg codegenapi.Config) bool {
	return f.private || f.HasAsyncAccessor(cfg)
}

func (f *Field) HasAsyncAccessor(cfg codegenapi.Config) bool {
	return f.fetchOnDemand || (f.hasFieldPrivacy && cfg.FieldPrivacyEvaluated() == codegenapi.OnDemand)
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

func (f *Field) EditableGraphQLField() bool {
	return !f.disableUserEditable && !f.disableUserGraphQLEditable
}

func (f *Field) HasDefaultValueOnCreate() bool {
	return f.hasDefaultValueOnCreate
}

func (f *Field) HasDefaultValueOnEdit() bool {
	return f.hasDefaultValueOnEdit
}

func (f *Field) HasFieldPrivacy() bool {
	return f.hasFieldPrivacy
}

func (f *Field) FetchOnDemand() bool {
	return f.fetchOnDemand
}

func (f *Field) FetchOnLoad() bool {
	return !f.fetchOnDemand
}

func (f *Field) IDField() bool {
	if !f.topLevelStructField {
		return false
	}
	// TOOD this needs a better name, way of figuring out etc
	// TODO kill this and replace with EvolvedIDField
	return strings.HasSuffix(f.FieldName, "ID") || strings.HasSuffix(f.FieldName, "_id")
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
	if enttype.IsListType(f.fieldType) {
		return false
	}

	// TODO kill above and convert to this
	// if there's a fieldEdge or a foreign key or an inverse edge to this, this is an ID field
	// and we should use the ID type and add a builder
	return f.fieldEdge != nil || f.fkey != nil || f.inverseEdge != nil || f.polymorphic != nil
}

func (f *Field) QueryFromEnt() bool {
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

func (f *Field) DefaultValue() *string {
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
func (f *Field) TsFieldName(cfg codegenapi.Config) string {
	// TODO need to solve these id issues generally
	if f.FieldName == "ID" {
		return "id"
	}
	if f.HasAsyncAccessor(cfg) {
		return "_" + strcase.ToLowerCamel(f.FieldName)
	}
	return strcase.ToLowerCamel(f.FieldName)
}

func (f *Field) TsBuilderFieldName() string {
	// TODO need to solve these id issues generally
	if f.FieldName == "ID" {
		return "id"
	}
	return strcase.ToLowerCamel(f.FieldName)
}

// either async function name or public field
func (f *Field) TSPublicAPIName() string {
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
	if f.tsFieldType != nil {
		return f.tsFieldType.GetTSType()
	}
	return f.tsRawUnderlyingType()
}

// type of the field in the class e.g. readonly name type;
func (f *Field) TsFieldType(cfg codegenapi.Config) string {
	// when fetch on demand, we set to undefined to start since we need to load it later
	// we use nullable value because we set the value after loading...
	if f.fetchOnDemand {
		return fmt.Sprintf("%s | undefined", f.TsType())
	}
	// there's a method that's nullable so return raw type
	if f.HasAsyncAccessor(cfg) {
		return f.tsRawUnderlyingType()
	}
	return f.TsType()
}

func (f *Field) tsRawUnderlyingType() string {
	return f.fieldType.GetTSType()
}

func (f *Field) GetTsType() string {
	return f.TsType()
}

func (f *Field) GetPossibleTypes() []enttype.EntType {
	typs := []enttype.EntType{f.fieldType}
	if f.tsFieldType != nil {
		typs = append(typs, f.tsFieldType)
	}

	return typs
}

func (f *Field) GetImportsForTypes() []*tsimport.ImportPath {
	var ret []*tsimport.ImportPath
	tt := f.GetPossibleTypes()
	for _, t := range tt {
		imp := enttype.ConvertImportPath(t)
		if imp != nil {
			if imp.ImportPath != "" {
				ret = append(ret, imp)
			}
		}
		if enttype.IsImportDepsType(t) {
			t2 := t.(enttype.ImportDepsType)
			imp := t2.GetImportDepsType()
			if imp != nil {
				// TODO ignoring relative. do we need it?
				ret = append(ret, imp)
			}
		}
	}

	if f.userConvert != nil {
		ret = append(ret, &tsimport.ImportPath{
			ImportPath: f.userConvert.Path,
			Import:     f.userConvert.Function,
		})
	}

	return ret
}

func (f *Field) GetTsTypeImports() []*tsimport.ImportPath {
	types := f.GetPossibleTypes()
	ret := []*tsimport.ImportPath{}
	for _, t := range types {
		// field type requires imports. assumes it has been reserved separately
		typ, ok := t.(enttype.TSTypeWithImports)
		if ok {
			ret = append(ret, typ.GetTsTypeImports()...)
		}

		enumType, ok := t.(enttype.EnumeratedType)
		if ok && (f.fkey != nil || f.patternName != "") {
			// foreign key with enum type requires an import
			// if pattern enum, this is defined in its own file
			ret = append(ret, tsimport.NewLocalEntImportPath(enumType.GetTSName()))
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

	if enttype.IsListType(f.fieldType) {
		return ""
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

func (f *Field) TsBuilderType(cfg codegenapi.Config) string {
	typ := f.tsRawUnderlyingType()
	typeName := f.getIDFieldType()
	if typeName == "" || f.disableBuilderType {
		return typ
	}
	return fmt.Sprintf("%s | Builder<%s, %s>", typ, f.transformBuilderEnt(typeName, cfg), cfg.GetTemplatizedViewer().GetImport())
}

func (f *Field) transformBuilderEnt(typ string, cfg codegenapi.Config) string {
	if typ != "Ent" {
		return typ
	}
	return fmt.Sprintf("%s<%s>", typ, cfg.GetTemplatizedViewer().GetImport())
}

// for getFooValue() where there's a nullable type but the input type isn't nullable
// because the underlying db value isn't
func (f *Field) TsBuilderUnionType(cfg codegenapi.Config) string {
	if f.tsFieldType == nil {
		return f.TsBuilderType(cfg)
	}
	// already null so we good
	typWithNull, ok := f.tsFieldType.(enttype.NonNullableType)
	if !ok {
		return f.TsBuilderType(cfg)
	}
	typ := typWithNull.GetTSType()
	typeName := f.getIDFieldType()
	if typeName == "" || f.disableBuilderType {
		return typ
	}
	return fmt.Sprintf("%s | Builder<%s, %s>", typ, f.transformBuilderEnt(typeName, cfg), cfg.GetTemplatizedViewer().GetImport())
}

func (f *Field) TsBuilderImports(cfg codegenapi.Config) []*tsimport.ImportPath {
	ret := f.GetTsTypeImports()
	typeName := f.getIDFieldType()
	if typeName == "" || f.disableBuilderType {
		return ret
	}
	var entImportPath *tsimport.ImportPath
	// for polymorphic fields...
	if typeName == "Ent" || typeName == "ID" {
		entImportPath = tsimport.NewEntImportPath(typeName)
	} else {
		entImportPath = tsimport.NewLocalEntImportPath(typeName)
	}

	viewer := cfg.GetTemplatizedViewer()
	ret = append(
		ret,
		entImportPath,
		tsimport.NewEntActionImportPath("Builder"),
		viewer.GetImportPath(),
	)
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

// should mirror TsFieldType because it's used to determine if nullable and if
// convertFunc
func (f *Field) GetTSFieldType(cfg codegenapi.Config) enttype.EntType {
	if f.HasAsyncAccessor(cfg) {
		return f.fieldType
	}
	if f.tsFieldType != nil {
		return f.tsFieldType
	}
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

func (f *Field) setTsFieldType(fieldType enttype.Type) error {
	gqlType, ok := fieldType.(enttype.TSGraphQLType)
	if !ok {
		return fmt.Errorf("invalid type %T that's not a graphql type", fieldType)
	}
	f.tsFieldType = gqlType
	return nil
}

func (f *Field) setPrivate(p *input.PrivateOptions) {
	f.private = true
	f.hideFromGraphQL = true
	f.exposeToActionsByDefault = p.ExposeToActions
}

func (f *Field) AddInverseEdge(cfg codegenapi.Config, edge *edge.AssociationEdge) error {
	if f.fieldEdge == nil {
		return fmt.Errorf("cannot add an inverse edge on a field without a field edge")
	}
	var err error
	f.inverseEdge, err = edge.CloneWithCommonInfo(cfg, f.fieldEdge.Schema+"Config")
	return err
}

func (f *Field) GetInverseEdge() *edge.AssociationEdge {
	return f.inverseEdge
}

func (f *Field) GetTSGraphQLTypeForFieldImports(input bool) []*tsimport.ImportPath {
	tsGQLType := f.fieldType
	if f.graphqlFieldType != nil {
		tsGQLType = f.graphqlFieldType
	}
	return tsGQLType.GetTSGraphQLImports(input)
}

// for non-required fields in actions, we want to make it optional if it's not a required field
// in the action
// in mutations, we ignore any graphql specific nature of the field and use underlying API
// TODO multiple booleans is a horrible code-smell. fix with options or something
func (f *Field) GetTSMutationGraphQLTypeForFieldImports(forceOptional, input bool) []*tsimport.ImportPath {
	var tsGQLType enttype.TSGraphQLType
	// spew.Dump(f.fieldType, f.graphqlFieldType)
	tsGQLType = f.fieldType
	nullableType, ok := f.fieldType.(enttype.NullableType)

	if forceOptional && ok {
		tsGQLType = nullableType.GetNullableType()
	} else if input && f.forceOptionalInAction && f.graphqlFieldType != nil {
		tsGQLType = f.graphqlFieldType
	}
	return tsGQLType.GetTSGraphQLImports(input)
}

// note that this is different from PrimaryKeyIDField
// which indicates id field
func (f *Field) IsEditableIDField() bool {
	if !f.EditableField() {
		return false
	}
	return enttype.IsIDType(f.fieldType)
}

func (f *Field) PrimaryKeyIDField() bool {
	return f.IsEditableIDField() && f.singleFieldPrimaryKey
}

func (f *Field) EmbeddableInParentAction() bool {
	// hmm what happens if ownerID field is not excluded...
	// but ownerType is by default...
	return !f.derivedWhenEmbedded

	// we could probably also auto-remove fields for which there's a foreignKey to primary key in source
	// ent or fields which have a fieldEdge to source schema?
}

func (f *Field) PatternField() bool {
	return f.patternName != ""
}

func (f *Field) GetPatternName() string {
	return f.patternName
}

func (f *Field) GetUserConvert() *input.UserConvertType {
	return f.userConvert
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
		FieldName:                  f.FieldName,
		nullable:                   f.nullable,
		graphqlNullable:            f.graphqlNullable,
		dbName:                     f.dbName,
		hideFromGraphQL:            f.hideFromGraphQL,
		private:                    f.private,
		polymorphic:                f.polymorphic,
		index:                      f.index,
		graphQLName:                f.graphQLName,
		defaultValue:               f.defaultValue,
		unique:                     f.unique,
		topLevelStructField:        f.topLevelStructField,
		dbColumn:                   f.dbColumn,
		exposeToActionsByDefault:   f.exposeToActionsByDefault,
		singleFieldPrimaryKey:      f.singleFieldPrimaryKey,
		disableUserEditable:        f.disableUserEditable,
		disableUserGraphQLEditable: f.disableUserGraphQLEditable,
		hasDefaultValueOnCreate:    f.hasDefaultValueOnCreate,
		hasDefaultValueOnEdit:      f.hasDefaultValueOnEdit,
		hasFieldPrivacy:            f.hasFieldPrivacy,
		forceRequiredInAction:      f.forceRequiredInAction,
		forceOptionalInAction:      f.forceOptionalInAction,
		derivedWhenEmbedded:        f.derivedWhenEmbedded,
		patternName:                f.patternName,

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
