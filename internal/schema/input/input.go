package input

import (
	"encoding/json"
	"fmt"

	"github.com/iancoleman/strcase"
	"github.com/jinzhu/inflection"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/tsimport"
)

type Schema struct {
	Nodes        map[string]*Node    `json:"schemas,omitempty"`
	Patterns     map[string]*Pattern `json:"patterns,omitempty"`
	GlobalSchema *GlobalSchema       `json:"globalSchema"`
}

type Pattern struct {
	// Note that anytime anything changes here, have to update patternEqual in compare.go
	Name string `json:"name,omitempty"`
	// at this point, should we support everything in Node
	Fields       []*Field     `json:"fields,omitempty"`
	AssocEdges   []*AssocEdge `json:"assocEdges,omitempty"`
	DisableMixin bool         `json:"disableMixin,omitempty"`
}

type Node struct {
	// Note that anytime anything changes here, have to update nodeEqual in compare.go
	TableName        string                    `json:"tableName,omitempty"`
	Fields           []*Field                  `json:"fields,omitempty"`
	FieldOverrides   map[string]*FieldOverride `json:"fieldOverrides"`
	AssocEdges       []*AssocEdge              `json:"assocEdges,omitempty"`
	AssocEdgeGroups  []*AssocEdgeGroup         `json:"assocEdgeGroups,omitempty"`
	Actions          []*Action                 `json:"actions,omitempty"`
	EnumTable        bool                      `json:"enumTable,omitempty"`
	DBRows           []map[string]interface{}  `json:"dbRows,omitempty"`
	Constraints      []*Constraint             `json:"constraints,omitempty"`
	Indices          []*Index                  `json:"indices,omitempty"`
	HideFromGraphQL  bool                      `json:"hideFromGraphQL,omitempty"`
	EdgeConstName    string                    `json:"edgeConstName,omitempty"`
	PatternName      string                    `json:"patternName,omitempty"`
	TransformsSelect bool                      `json:"transformsSelect,omitempty"`
	TransformsDelete bool                      `json:"transformsDelete,omitempty"`
	SchemaPath       string                    `json:"schemaPath,omitempty"`
	Patterns         []string                  `json:"patternNames,omitempty"`
	// these 2 not used yet so ignoring for now
	// TransformsInsert bool `json:"transformsInsert,omitempty"`
	// TransformsUpdate bool `json:"transformsUpdate,omitempty"`
}

func (n *Node) AddAssocEdge(edge *AssocEdge) {
	n.AssocEdges = append(n.AssocEdges, edge)
}

func (n *Node) AddAssocEdgeGroup(edgeGroup *AssocEdgeGroup) {
	n.AssocEdgeGroups = append(n.AssocEdgeGroups, edgeGroup)
}

type GlobalSchema struct {
	ExtraEdgeFields []*Field     `json:"extraEdgeFields,omitempty"`
	GlobalEdges     []*AssocEdge `json:"globalEdges,omitempty"`
	InitForEdges    bool         `json:"initForEdges,omitempty"`
}

type DBType string

const (
	// Note that these types should match enum DBType in schema.ts
	UUID        DBType = "UUID"
	Int64ID     DBType = "Int64ID"
	Boolean     DBType = "Boolean"
	Int         DBType = "Int"
	BigInt      DBType = "BigInt"
	Float       DBType = "Float"
	String      DBType = "String"
	Timestamp   DBType = "Timestamp"
	Timestamptz DBType = "Timestamptz"
	Time        DBType = "Time"
	Timetz      DBType = "Timetz"
	Date        DBType = "Date"
	JSON        DBType = "JSON"
	JSONB       DBType = "JSONB"
	Enum        DBType = "Enum"
	StringEnum  DBType = "StringEnum"
	IntEnum     DBType = "IntEnum"
	List        DBType = "List"
)

type CustomType string

const (
	EmailType    CustomType = "email"
	PhoneType    CustomType = "phone"
	PasswordType CustomType = "password"
)

type FieldType struct {
	// Note that anytime anything changes here, have to update fieldTypeEqual in compare.go
	DBType DBType `json:"dbType,omitempty"`
	// required when DBType == DBType.List
	// also sometimes used when DBType == JSON or JSONB for json that we store as json(b) in the db but represent as lists
	// in graphql and typescript
	ListElemType *FieldType `json:"listElemType,omitempty"`
	// required when DBType == DBType.Enum || DBType.StringEnum
	Values               []string          `json:"values,omitempty"`
	EnumMap              map[string]string `json:"enumMap,omitempty"`
	IntEnumMap           map[string]int    `json:"intEnumMap,omitempty"`
	DeprecatedIntEnumMap map[string]int    `json:"deprecatedIntEnumMap,omitempty"`
	Type                 string            `json:"type,omitempty"`
	GraphQLType          string            `json:"graphQLType,omitempty"`
	// optional used by generator to specify different types e.g. email, phone, password
	CustomType CustomType `json:"customType,omitempty"`

	ImportType *tsimport.ImportPath `json:"importType,omitempty"`

	// list because go-lang map not stable and don't want generated fields to change often
	SubFields   []*Field `json:"subFields,omitempty"`
	UnionFields []*Field `json:"unionFields,omitempty"`
}

type UserConvertType struct {
	Path     string `json:"path,omitempty"`
	Function string `json:"function,omitempty"`
}

type Field struct {
	// Note that anytime anything changes here, have to update fieldEqual in compare.go
	Name       string     `json:"name,omitempty"`
	Type       *FieldType `json:"type,omitempty"`
	Nullable   bool       `json:"nullable,omitempty"`
	StorageKey string     `json:"storageKey,omitempty"`
	// TODO need a way to indicate unique edge is Required also. this changes type generated in ent and graphql
	Unique                  bool            `json:"unique,omitempty"`
	HideFromGraphQL         bool            `json:"hideFromGraphQL,omitempty"`
	Private                 *PrivateOptions `json:"private,omitempty"`
	GraphQLName             string          `json:"graphqlName,omitempty"`
	Index                   bool            `json:"index,omitempty"`
	PrimaryKey              bool            `json:"primaryKey,omitempty"`
	DefaultToViewerOnCreate bool            `json:"defaultToViewerOnCreate,omitempty"`

	FieldEdge     *FieldEdge  `json:"fieldEdge,omitempty"` // this only really makes sense on id fields...
	ForeignKey    *ForeignKey `json:"foreignKey,omitempty"`
	ServerDefault *string     `json:"serverDefault,omitempty"`
	// DisableUserEditable true == DefaultValueOnCreate required OR set in trigger
	DisableUserEditable        bool `json:"disableUserEditable,omitempty"`
	DisableUserGraphQLEditable bool `json:"disableUserGraphQLEditable,omitempty"`
	HasDefaultValueOnCreate    bool `json:"hasDefaultValueOnCreate,omitempty"`
	HasDefaultValueOnEdit      bool `json:"hasDefaultValueOnEdit,omitempty"`
	HasFieldPrivacy            bool `json:"hasFieldPrivacy,omitempty"`

	Polymorphic         *PolymorphicOptions `json:"polymorphic,omitempty"`
	DerivedWhenEmbedded bool                `json:"derivedWhenEmbedded,omitempty"`
	DerivedFields       []*Field            `json:"derivedFields,omitempty"`
	UserConvert         *UserConvertType    `json:"convert,omitempty"`
	FetchOnDemand       bool                `json:"fetchOnDemand,omitempty"`

	// set when parsed via tsent generate schema
	Import enttype.Import `json:"-"`

	PatternName string `json:"patternName,omitempty"`
}

func (f *Field) ApplyOverride(override *FieldOverride) {
	if override.GraphQLName != "" {
		f.GraphQLName = override.GraphQLName
	}
	if override.ServerDefault != nil {
		f.ServerDefault = override.ServerDefault
	}
	if override.StorageKey != "" {
		f.StorageKey = override.StorageKey
	}
	if override.HideFromGraphQL != nil {
		f.HideFromGraphQL = *override.HideFromGraphQL
	}
	if override.Index != nil {
		f.Index = *override.Index
	}
	if override.Unique != nil {
		f.Unique = *override.Unique
	}
	if override.Nullable != nil {
		f.Nullable = *override.Nullable
	}
}

type FieldOverride struct {
	Nullable        *bool   `json:"nullable,omitempty"`
	StorageKey      string  `json:"storageKey,omitempty"`
	Unique          *bool   `json:"unique,omitempty"`
	HideFromGraphQL *bool   `json:"hideFromGraphQL,omitempty"`
	GraphQLName     string  `json:"graphqlName,omitempty"`
	Index           *bool   `json:"index,omitempty"`
	ServerDefault   *string `json:"serverDefault,omitempty"`
}

type ForeignKey struct {
	// Note that anytime anything changes here, have to update foreignKeyEqual in compare.go
	Schema             string `json:"schema,omitempty"`
	Column             string `json:"column,omitempty"`
	Name               string `json:"name,omitempty"`
	DisableIndex       bool   `json:"disableIndex,omitempty"`
	DisableBuilderType bool   `json:"disableBuilderType,omitempty"`
}

type FieldEdge struct {
	// Note that anytime anything changes here, have to update fieldEdgeEqual in compare.go
	Schema             string            `json:"schema,omitempty"`
	InverseEdge        *InverseFieldEdge `json:"inverseEdge,omitempty"`
	DisableBuilderType bool              `json:"disableBuilderType,omitempty"`
}

func (f *FieldEdge) InverseEdgeName() string {
	if f.InverseEdge == nil {
		return ""
	}
	return f.InverseEdge.Name
}

type InverseFieldEdge struct {
	// Note that anytime anything changes here, have to update InverseFieldEdgeEqual in compare.go
	Name            string `json:"name,omitempty"`
	TableName       string `json:"tableName,omitempty"`
	HideFromGraphQL bool   `json:"hideFromGraphQL,omitempty"`
	EdgeConstName   string `json:"edgeConstName,omitempty"`
}

type PolymorphicOptions struct {
	// Note that anytime anything changes here, have to update PolymorphicOptionsEqual in compare.go
	Types                  []string `json:"types,omitempty"`
	HideFromInverseGraphQL bool     `json:"hideFromInverseGraphQL,omitempty"`
	DisableBuilderType     bool     `json:"disableBuilderType,omitempty"`
	Name                   string   `json:"name,omitempty"`
}

type PrivateOptions struct {
	ExposeToActions bool `json:"exposeToActions,omitempty"`
}

func getJSONOrJSONBType(typ *FieldType, nullable bool) enttype.TSType {
	importType := typ.ImportType
	var subFields interface{}
	var unionFields interface{}
	if len(typ.SubFields) != 0 {
		// only set this if we actually have fields. otherwise, we want this to be nil
		subFields = typ.SubFields
		if importType == nil && typ.Type != "" {
			importType = &tsimport.ImportPath{
				ImportPath: getImportPathForCustomInterfaceFile(typ.Type),
				Import:     typ.Type,
			}
		}
	}
	if len(typ.UnionFields) != 0 {
		// only set this if we actually have fields. otherwise, we want this to be nil
		unionFields = typ.UnionFields
		if importType == nil && typ.Type != "" {
			importType = &tsimport.ImportPath{
				// intentionally no path since we don't support top level unions and this should lead to some kind of error
				Import: typ.Type,
			}
		}
	}

	common := enttype.CommonJSONType{}
	common.ImportType = importType
	common.CustomTsInterface = typ.Type
	common.CustomGraphQLInterface = typ.GraphQLType
	common.SubFields = subFields
	common.UnionFields = unionFields

	if typ.DBType == JSON {
		if nullable {
			return &enttype.NullableJSONType{
				CommonJSONType: common,
			}
		}
		return &enttype.JSONType{
			CommonJSONType: common,
		}
	}

	//	case JSONB:
	if nullable {
		return &enttype.NullableJSONBType{
			CommonJSONType: common,
		}
	}
	return &enttype.JSONBType{
		CommonJSONType: common,
	}
}

func getTypeFor(nodeName, fieldName string, typ *FieldType, nullable bool, foreignKey *ForeignKey) (enttype.TSType, error) {
	switch typ.DBType {
	case UUID:
		if nullable {
			return &enttype.NullableIDType{}, nil
		}
		return &enttype.IDType{}, nil
	case Int64ID:
		return nil, fmt.Errorf("unsupported Int64ID type")
		//		return &enttype.IntegerType{}, nil
	case Boolean:
		if nullable {
			return &enttype.NullableBoolType{}, nil
		}
		return &enttype.BoolType{}, nil
	case Int:
		if nullable {
			return &enttype.NullableIntegerType{}, nil
		}
		return &enttype.IntegerType{}, nil
	case BigInt:
		if nullable {
			return &enttype.NullableBigIntegerType{}, nil
		}
		return &enttype.BigIntegerType{}, nil
	case Float:
		if nullable {
			return &enttype.NullableFloatType{}, nil
		}
		return &enttype.FloatType{}, nil
	case String:
		switch typ.CustomType {
		case EmailType:
			if nullable {
				return &enttype.NullableEmailType{}, nil
			}
			return &enttype.EmailType{}, nil
		case PasswordType:
			if nullable {
				return &enttype.NullablePasswordType{}, nil
			}
			return &enttype.PasswordType{}, nil
		case PhoneType:
			if nullable {
				return &enttype.NullablePhoneType{}, nil
			}
			return &enttype.PhoneType{}, nil
		}
		if nullable {
			return &enttype.NullableStringType{}, nil
		}
		return &enttype.StringType{}, nil
	case Timestamp:
		if nullable {
			return &enttype.NullableTimestampType{}, nil
		}
		return &enttype.TimestampType{}, nil
	case Timestamptz:
		if nullable {
			return &enttype.NullableTimestamptzType{}, nil
		}
		return &enttype.TimestamptzType{}, nil
	case Time:
		if nullable {
			return &enttype.NullableTimeType{}, nil
		}
		return &enttype.TimeType{}, nil
	case Timetz:
		if nullable {
			return &enttype.NullableTimetzType{}, nil
		}
		return &enttype.TimetzType{}, nil
	case Date:
		if nullable {
			return &enttype.NullableDateType{}, nil
		}
		return &enttype.DateType{}, nil
	case JSON, JSONB:

		if typ.ListElemType != nil {
			if nullable {
				return &enttype.NullableArrayListType{
					ElemType:           getJSONOrJSONBType(typ, false),
					ElemDBTypeNotArray: true,
				}, nil
			}
			return &enttype.ArrayListType{
				ElemType:           getJSONOrJSONBType(typ, false),
				ElemDBTypeNotArray: true,
			}, nil
		}

		return getJSONOrJSONBType(typ, nullable), nil

	case StringEnum, Enum:
		tsType := strcase.ToCamel(typ.Type)
		graphqlType := strcase.ToCamel(typ.GraphQLType)
		// if tsType and graphqlType not explicitly specified,add schema prefix to generated enums
		if tsType == "" {
			tsType = strcase.ToCamel(nodeName) + strcase.ToCamel(fieldName)
		}
		if graphqlType == "" {
			graphqlType = strcase.ToCamel(nodeName) + strcase.ToCamel(fieldName)
		}
		if foreignKey != nil {
			tsType = foreignKey.Schema
			graphqlType = foreignKey.Schema
		}
		if nullable {
			return &enttype.NullableStringEnumType{
				EnumDBType:  typ.DBType == Enum,
				Type:        tsType,
				GraphQLType: graphqlType,
				Values:      typ.Values,
				EnumMap:     typ.EnumMap,
			}, nil
		}
		return &enttype.StringEnumType{
			EnumDBType:  typ.DBType == Enum,
			Type:        tsType,
			GraphQLType: graphqlType,
			Values:      typ.Values,
			EnumMap:     typ.EnumMap,
		}, nil

	case IntEnum:
		tsType := strcase.ToCamel(typ.Type)
		graphqlType := strcase.ToCamel(typ.GraphQLType)
		// if tsType and graphqlType not explicitly specified,add schema prefix to generated enums
		if tsType == "" {
			tsType = strcase.ToCamel(nodeName) + strcase.ToCamel(fieldName)
		}
		if graphqlType == "" {
			graphqlType = strcase.ToCamel(nodeName) + strcase.ToCamel(fieldName)
		}
		if nullable {
			return &enttype.NullableIntegerEnumType{
				Type:              tsType,
				GraphQLType:       graphqlType,
				EnumMap:           typ.IntEnumMap,
				DeprecatedEnumMap: typ.DeprecatedIntEnumMap,
			}, nil
		}
		return &enttype.IntegerEnumType{
			Type:              tsType,
			GraphQLType:       graphqlType,
			EnumMap:           typ.IntEnumMap,
			DeprecatedEnumMap: typ.DeprecatedIntEnumMap,
		}, nil

	}
	return nil, fmt.Errorf("unsupported type %s", typ.DBType)
}

func (f *Field) GetImport(nodeName string) (enttype.Import, error) {
	if f.Import != nil {
		return f.Import, nil
	}
	typ, err := f.GetEntType(nodeName)
	if err != nil {
		return nil, err
	}
	ctype, ok := typ.(enttype.TSCodegenableType)
	if !ok {
		return nil, fmt.Errorf("%s doesn't have a valid codegenable type", f.Name)
	}
	return ctype.GetImportType(), nil
}

// need nodeName for enum
// ideally, there's a more elegant way of doing this in the future
// but we don't know the parent
func (f *Field) GetEntType(nodeName string) (enttype.TSType, error) {
	if f.Type.DBType == List {
		if f.Type.ListElemType == nil {
			return nil, fmt.Errorf("list elem type for list is nil")
		}
		elemType, err := getTypeFor(nodeName, f.Name, f.Type.ListElemType, false, nil)
		if err != nil {
			return nil, err
		}
		if f.Nullable {
			return &enttype.NullableArrayListType{
				ElemType: elemType,
			}, nil
		}
		return &enttype.ArrayListType{
			ElemType: elemType,
		}, nil
	} else {
		return getTypeFor(nodeName, f.Name, f.Type, f.Nullable, f.ForeignKey)
	}
}

type AssocEdge struct {
	// Note that anytime anything changes here, have to update assocEdgeEqual in compare.go
	Name            string            `json:"name,omitempty"`
	SchemaName      string            `json:"schemaName,omitempty"`
	Symmetric       bool              `json:"symmetric,omitempty"`
	Unique          bool              `json:"unique,omitempty"`
	TableName       string            `json:"tableName,omitempty"`
	InverseEdge     *InverseAssocEdge `json:"inverseEdge,omitempty"`
	EdgeActions     []*EdgeAction     `json:"edgeActions,omitempty"`
	HideFromGraphQL bool              `json:"hideFromGraphQL,omitempty"`
	EdgeConstName   string            `json:"edgeConstName,omitempty"`
	PatternName     string            `json:"patternName,omitempty"`
	// do we need a flag to know it's a pattern's edge?
	// PatternEdge
}

type AssocEdgeGroup struct {
	// Note that anytime anything changes here, have to update assocEdgeGroupEqual in compare.go
	Name            string        `json:"name,omitempty"`
	GroupStatusName string        `json:"groupStatusName,omitempty"`
	TableName       string        `json:"tableName,omitempty"`
	AssocEdges      []*AssocEdge  `json:"assocEdges,omitempty"`
	EdgeActions     []*EdgeAction `json:"edgeActions,omitempty"`
	ViewerBased     bool          `json:"viewerBased"`
	StatusEnums     []string      `json:"statusEnums,omitempty"`
	NullStateFn     string        `json:"nullStateFn,omitempty"`
	NullStates      []string      `json:"nullStates,omitempty"`

	// TS specific
	EdgeAction *EdgeAction `json:"edgeAction,omitempty"`

	// Go specific
	ActionEdges []string `json:"-"`
}

type EdgeAction struct {
	// Note that anytime anything changes here, have to update edgeActionEqual in compare.go
	Operation         ent.ActionOperation `json:"operation,omitempty"`
	CustomActionName  string              `json:"actionName,omitempty"`
	CustomGraphQLName string              `json:"graphQLName,omitempty"`
	CustomInputName   string              `json:"inputName,omitempty"`
	HideFromGraphQL   bool                `json:"hideFromGraphQL,omitempty"`
	ActionOnlyFields  []*ActionField      `json:"actionOnlyFields,omitempty"`
}

func getTSStringOperation(op ent.ActionOperation) string {
	switch op {
	case ent.CreateAction:
		return "ActionOperation.Create"
	case ent.EditAction:
		return "ActionOperation.Edit"
	case ent.DeleteAction:
		return "ActionOperation.Delete"
	case ent.MutationsAction:
		return "ActionOperation.Mutations"
	case ent.AddEdgeAction:
		return "ActionOperation.AddEdge"
	case ent.RemoveEdgeAction:
		return "ActionOperation.RemoveEdge"
	case ent.EdgeGroupAction:
		return "ActionOperation.EdgeGroup"
	default:
		// TODO throw?
		return ""
	}
}

func (e *EdgeAction) GetTSStringOperation() string {
	return getTSStringOperation(e.Operation)
}

type Action struct {
	// Note that anytime anything changes here, have to update actionEqual in compare.go
	Operation         ent.ActionOperation `json:"operation,omitempty"`
	Fields            []string            `json:"fields,omitempty"`
	ExcludedFields    []string            `json:"excludedFields,omitempty"`
	OptionalFields    []string            `json:"optionalFields,omitempty"`
	RequiredFields    []string            `json:"requiredFields,omitempty"`
	NoFields          bool                `json:"noFields,omitempty"`
	CustomActionName  string              `json:"actionName,omitempty"`
	CustomGraphQLName string              `json:"graphQLName,omitempty"`
	CustomInputName   string              `json:"inputName,omitempty"`
	HideFromGraphQL   bool                `json:"hideFromGraphQL,omitempty"`
	ActionOnlyFields  []*ActionField      `json:"actionOnlyFields,omitempty"`
}

func (a *Action) GetTSStringOperation() string {
	return getTSStringOperation(a.Operation)
}

type NullableItem string

const NullableContents NullableItem = "contents"
const NullableContentsAndList NullableItem = "contentsAndList"
const NullableTrue NullableItem = "true"

type actionField struct {
	Name           string       `json:"name"`
	Type           ActionType   `json:"type"`
	Nullable       NullableItem `json:"nullable"`
	List           bool         `json:"list"`
	ActionName     string       `json:"actionName"`
	ExcludedFields []string     `json:"excludedFields"`
}

type ActionField struct {
	// Note that anytime anything changes here, have to update actionOnlyFieldEqual in compare.go
	Name             string
	Type             ActionType
	Nullable         bool
	list             bool
	nullableContents bool
	ActionName       string
	ExcludedFields   []string
}

func (f *ActionField) UnmarshalJSON(data []byte) error {
	var af actionField
	err := json.Unmarshal(data, &af)
	if err != nil {
		return err
	}

	f.list = af.List
	f.Name = af.Name
	f.ActionName = af.ActionName
	f.Type = af.Type
	f.ExcludedFields = af.ExcludedFields

	switch af.Nullable {
	case NullableContentsAndList:
		if !af.List {
			return fmt.Errorf("list required to use this option")
		}
		f.Nullable = true
		f.nullableContents = true

	case NullableContents:
		if !af.List {
			return fmt.Errorf("list required to use this option")
		}
		f.nullableContents = true

	case NullableTrue:
		f.Nullable = true

	}

	return nil
}

func (f *ActionField) MarshalJSON() ([]byte, error) {
	var af actionField
	af.List = f.list
	af.Name = f.Name
	af.ActionName = f.ActionName
	af.Type = f.Type
	af.ExcludedFields = f.ExcludedFields

	if f.Nullable && f.nullableContents {
		af.Nullable = NullableContentsAndList
	} else if f.nullableContents {
		af.Nullable = NullableContents
	} else if f.Nullable {
		af.Nullable = NullableTrue
	}
	return json.Marshal(af)
}

func (f *ActionField) GetEntType(inputName string) (enttype.TSType, error) {
	if !f.list {
		return f.getEntTypeHelper(inputName, f.Nullable)
	}
	typ, err := f.getEntTypeHelper(inputName, f.nullableContents)
	if err != nil {
		return nil, err
	}
	return &enttype.ListWrapperType{
		Type:     typ,
		Nullable: f.Nullable,
	}, nil
}

func (f *ActionField) getEntTypeHelper(inputName string, nullable bool) (enttype.TSType, error) {
	switch f.Type {
	case ActionTypeID:
		if nullable {
			return &enttype.NullableIDType{}, nil
		}
		return &enttype.IDType{}, nil
	case ActionTypeBoolean:
		if nullable {
			return &enttype.NullableBoolType{}, nil
		}
		return &enttype.BoolType{}, nil
	case ActionTypeInt:
		if nullable {
			return &enttype.NullableIntegerType{}, nil
		}
		return &enttype.IntegerType{}, nil
	case ActionTypeFloat:
		if nullable {
			return &enttype.NullableFloatType{}, nil
		}
		return &enttype.FloatType{}, nil
	case ActionTypeString:
		if nullable {
			return &enttype.NullableStringType{}, nil
		}
		return &enttype.StringType{}, nil
	case ActionTypeTime:
		if nullable {
			return &enttype.NullableTimestampType{}, nil
		}
		return &enttype.TimestampType{}, nil
	case ActionTypeObject:
		tsType := fmt.Sprintf("custom%sInput", strcase.ToCamel(inflection.Singular(f.Name)))
		gqlType := fmt.Sprintf("%s%s", strcase.ToCamel(inflection.Singular(f.Name)), strcase.ToCamel(inputName))

		if nullable {
			typ := &enttype.NullableObjectType{}
			typ.TSType = tsType
			typ.ActionName = f.ActionName
			typ.GraphQLType = gqlType
			typ.ExcludedFields = f.ExcludedFields

			return typ, nil
		}
		typ := &enttype.ObjectType{}
		typ.TSType = tsType
		typ.GraphQLType = gqlType
		typ.ActionName = f.ActionName
		typ.ExcludedFields = f.ExcludedFields
		return typ, nil
	}
	return nil, fmt.Errorf("unsupported type %s", f.Type)
}

type ActionType string

const (
	// Note that these types should match ActionField.Type in schema.ts
	ActionTypeID      ActionType = "ID"
	ActionTypeBoolean ActionType = "Boolean"
	ActionTypeInt     ActionType = "Int"
	ActionTypeFloat   ActionType = "Float"
	ActionTypeString  ActionType = "String"
	ActionTypeTime    ActionType = "Time"
	ActionTypeObject  ActionType = "Object"
)

type Constraint struct {
	// Note that anytime anything changes here, have to update constraintEqual in compare.go
	Name       string          `json:"name,omitempty"`
	Type       ConstraintType  `json:"type,omitempty"`
	Columns    []string        `json:"columns,omitempty"`
	ForeignKey *ForeignKeyInfo `json:"fkey,omitempty"`
	Condition  string          `json:"condition,omitempty"`
}

func (c *Constraint) GetConstraintTypeString() string {
	switch c.Type {
	case PrimaryKeyConstraint:
		return "ConstraintType.PrimaryKey"
	case ForeignKeyConstraint:
		return "ConstraintType.ForeignKey"
	case UniqueConstraint:
		return "ConstraintType.Unique"
	case CheckConstraint:
		return "ConstraintType.Check"
	default:
		// TODO throw?
		return ""
	}
}

type Index struct {
	// Note that anytime anything changes here, have to update indexEqual in compare.go
	Name     string    `json:"name,omitempty"`
	Columns  []string  `json:"columns,omitempty"`
	Unique   bool      `json:"unique,omitempty"`
	FullText *FullText `json:"fullText,omitempty"`
	// for regular indices. doesn't apply for full text...
	IndexType IndexType `json:"indexType,omitempty"`
}

type FullTextLanguage string

const (
	// rename to search config?
	English FullTextLanguage = "english"
	French  FullTextLanguage = "french"
	German  FullTextLanguage = "german"
	Simple  FullTextLanguage = "simple"
)

// full text only supports gin | gist
// TODO https://github.com/lolopinto/ent/issues/1029
// Index only currently supports gin | btree (will eventually support gist)
type IndexType string

const (
	Gin   IndexType = "gin"
	Gist  IndexType = "gist"
	Btree IndexType = "btree"
)

type FullTextWeight struct {
	A []string `json:"A,omitempty"`
	B []string `json:"B,omitempty"`
	C []string `json:"C,omitempty"`
	D []string `json:"D,omitempty"`
}

func (w *FullTextWeight) HasWeights() bool {
	return len(w.A) > 0 ||
		len(w.B) > 0 ||
		len(w.C) > 0 ||
		len(w.D) > 0
}

type FullText struct {
	GeneratedColumnName string           `json:"generatedColumnName,omitempty"`
	Language            FullTextLanguage `json:"language,omitempty"`
	LanguageColumn      string           `json:"languageColumn,omitempty"`
	IndexType           IndexType        `json:"indexType,omitempty"`
	Weights             *FullTextWeight  `json:"weights,omitempty"`
}

type ConstraintType string

const (
	// Note that these type should match enum ConstraintType in schema.ts
	PrimaryKeyConstraint ConstraintType = "primary"
	ForeignKeyConstraint ConstraintType = "foreign"
	UniqueConstraint     ConstraintType = "unique"
	CheckConstraint      ConstraintType = "check"
)

type ForeignKeyInfo struct {
	// Note that anytime anything changes here, have to update foreignKeyInfoEqual in compare.go
	TableName string       `json:"tableName,omitempty"`
	Columns   []string     `json:"columns,omitempty"`
	OnDelete  OnDeleteFkey `json:"ondelete,omitempty"`
}

type OnDeleteFkey string

const (
	// Note that these type should match enum ForeignKeyInfo.ondelete in schema.ts
	Restrict   OnDeleteFkey = "RESTRICT"
	Cascade    OnDeleteFkey = "CASCADE"
	SetNull    OnDeleteFkey = "SET NULL"
	SetDefault OnDeleteFkey = "SET DEFAULT"
	NoAction   OnDeleteFkey = "NO ACTION"
)

func (g *AssocEdgeGroup) AddAssocEdge(edge *AssocEdge) {
	g.AssocEdges = append(g.AssocEdges, edge)
}

type InverseAssocEdge struct {
	// Note that anytime anything changes here, have to update inverseAssocEdgeEqual in compare.go
	// TODO need to be able to mark this as unique
	// this is an easy way to get 1->many
	Name          string `json:"name,omitempty"`
	EdgeConstName string `json:"edgeConstName,omitempty"`
}

func ParseSchema(input []byte) (*Schema, error) {
	s := &Schema{}
	if err := json.Unmarshal(input, s); err != nil {
		return nil, err
	}
	return s, nil
}

// copied from step.go
func getImportPathForCustomInterfaceFile(tsType string) string {
	return fmt.Sprintf("src/ent/generated/%s", strcase.ToSnake(tsType))
}
