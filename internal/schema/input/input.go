package input

import (
	"encoding/json"
	"fmt"
	"go/types"

	"github.com/iancoleman/strcase"
	"github.com/jinzhu/inflection"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/lolopinto/ent/internal/tsimport"
)

type Schema struct {
	Nodes    map[string]*Node    `json:"schemas,omitempty"`
	Patterns map[string]*Pattern `json:"patterns,omitempty"`
}

type Pattern struct {
	Name string `json:"name,omitempty"`
	// at this point, should we support everything in Node
	Fields     []*Field     `json:"fields,omitempty"`
	AssocEdges []*AssocEdge `json:"assocEdges,omitempty"`
}

type Node struct {
	TableName       *string                  `json:"tableName,omitempty"`
	Fields          []*Field                 `json:"fields,omitempty"`
	AssocEdges      []*AssocEdge             `json:"assocEdges,omitempty"`
	AssocEdgeGroups []*AssocEdgeGroup        `json:"assocEdgeGroups,omitempty"`
	Actions         []*Action                `json:"actions,omitempty"`
	EnumTable       bool                     `json:"enumTable,omitempty"`
	DBRows          []map[string]interface{} `json:"dbRows,omitempty"`
	Constraints     []*Constraint            `json:"constraints,omitempty"`
	Indices         []*Index                 `json:"indices,omitempty"`
	HideFromGraphQL bool                     `json:"hideFromGraphQL,omitempty"`
	EdgeConstName   string                   `json:"edgeConstName,omitempty"`
	PatternName     string                   `json:"patternName,omitempty"`
}

func (n *Node) AddAssocEdge(edge *AssocEdge) {
	n.AssocEdges = append(n.AssocEdges, edge)
}

func (n *Node) AddAssocEdgeGroup(edgeGroup *AssocEdgeGroup) {
	n.AssocEdgeGroups = append(n.AssocEdgeGroups, edgeGroup)
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
	List        DBType = "List"
)

type CustomType string

const (
	EmailType    CustomType = "email"
	PhoneType    CustomType = "phone"
	PasswordType CustomType = "password"
)

type FieldType struct {
	// Note that anytime anything changes here, have to update fieldTypeEqual in internal/schema/input/compare.go
	DBType DBType `json:"dbType,omitempty"`
	// required when DBType == DBType.List
	ListElemType *FieldType `json:"listElemType,omitempty"`
	// required when DBType == DBType.Enum || DBType.StringEnum
	Values      []string          `json:"values,omitempty"`
	EnumMap     map[string]string `json:"enumMap,omitempty"`
	Type        string            `json:"type,omitempty"`
	GraphQLType string            `json:"graphQLType,omitempty"`
	// optional used by generator to specify different types e.g. email, phone, password
	CustomType CustomType `json:"customType,omitempty"`

	ImportType       *tsimport.ImportPath
	ImportTypeIgnore *importType `json:"importType,omitempty"`
}

// needed to get the data from json and then discarded
type importType struct {
	Path string `json:"path"`
	Type string `json:"type"`
}

func (ft *FieldType) UnmarshalJSON(data []byte) error {
	type Alias FieldType
	err := json.Unmarshal(data, (*Alias)(ft))
	if err != nil {
		return err
	}
	if ft.ImportTypeIgnore == nil {
		return nil
	}
	ft.ImportType = &tsimport.ImportPath{
		ImportPath: ft.ImportTypeIgnore.Path,
		Import:     ft.ImportTypeIgnore.Type,
	}
	ft.ImportTypeIgnore = nil
	return nil
}

type Field struct {
	// Note that anytime anything changes here, have to update compareFields in internal/schema/input/compare.go
	Name       string     `json:"name,omitempty"`
	Type       *FieldType `json:"type,omitempty"`
	Nullable   bool       `json:"nullable,omitempty"`
	StorageKey string     `json:"storageKey,omitempty"`
	// TODO need a way to indicate unique edge is Required also. this changes type generated in ent and graphql
	Unique                  bool   `json:"unique,omitempty"`
	HideFromGraphQL         bool   `json:"hideFromGraphQL,omitempty"`
	Private                 bool   `json:"private,omitempty"`
	GraphQLName             string `json:"graphqlName,omitempty"`
	Index                   bool   `json:"index,omitempty"`
	PrimaryKey              bool   `json:"primaryKey,omitempty"`
	DefaultToViewerOnCreate bool   `json:"defaultToViewerOnCreate,omitempty"`

	FieldEdge     *FieldEdge  `json:"fieldEdge,omitempty"` // this only really makes sense on id fields...
	ForeignKey    *ForeignKey `json:"foreignKey,omitempty"`
	ServerDefault interface{} `json:"serverDefault,omitempty"`
	// DisableUserEditable true == DefaultValueOnCreate required OR set in trigger
	DisableUserEditable     bool `json:"disableUserEditable,omitempty"`
	HasDefaultValueOnCreate bool `json:"hasDefaultValueOnCreate,omitempty"`
	HasDefaultValueOnEdit   bool `json:"hasDefaultValueOnEdit,omitempty"`

	Polymorphic         *PolymorphicOptions `json:"polymorphic,omitempty"`
	DerivedWhenEmbedded bool                `json:"derivedWhenEmbedded,omitempty"`
	DerivedFields       []*Field            `json:"derivedFields,omitempty"`

	// Go specific information here
	TagMap          map[string]string
	GoType          types.Type
	PkgPath         string
	DataTypePkgPath string

	// set when parsed via tsent generate schema
	Import enttype.Import

	PatternName string `json:"patternName,omitempty"`
}

type ForeignKey struct {
	Schema             string `json:"schema,omitempty"`
	Column             string `json:"column,omitempty"`
	Name               string `json:"name,omitempty"`
	DisableIndex       bool   `json:"disableIndex,omitempty"`
	DisableBuilderType bool   `json:"disableBuilderType,omitempty"`
}

type FieldEdge struct {
	// Note that anytime anything changes here, have to update fieldEdgeEqual in internal/schema/input/compare.go
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
	// Note that anytime anything changes here, have to update InverseFieldEdgeEqual in internal/schema/input/compare.go
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
}

func getTypeFor(typ *FieldType, nullable bool, foreignKey *ForeignKey) (enttype.TSGraphQLType, error) {
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
	case JSON:
		if nullable {
			return &enttype.NullableJSONType{
				ImportType: typ.ImportType,
			}, nil
		}
		return &enttype.JSONType{
			ImportType: typ.ImportType,
		}, nil
	case JSONB:
		if nullable {
			return &enttype.NullableJSONBType{
				ImportType: typ.ImportType,
			}, nil
		}
		return &enttype.JSONBType{
			ImportType: typ.ImportType,
		}, nil

	case StringEnum, Enum:
		tsType := strcase.ToCamel(typ.Type)
		graphqlType := strcase.ToCamel(typ.GraphQLType)
		if foreignKey != nil {
			tsType = foreignKey.Schema
			graphqlType = foreignKey.Schema
		}
		if typ.Type == "" {
			return nil, fmt.Errorf("enum type name is required")
		}
		if typ.GraphQLType == "" {
			return nil, fmt.Errorf("enum graphql name is required")
		}
		if nullable {
			return &enttype.NullableEnumType{
				EnumDBType:  typ.DBType == Enum,
				Type:        tsType,
				GraphQLType: graphqlType,
				Values:      typ.Values,
				EnumMap:     typ.EnumMap,
			}, nil
		}
		return &enttype.EnumType{
			EnumDBType:  typ.DBType == Enum,
			Type:        tsType,
			GraphQLType: graphqlType,
			Values:      typ.Values,
			EnumMap:     typ.EnumMap,
		}, nil
	}
	return nil, fmt.Errorf("unsupported type %s", typ.DBType)
}

func (f *Field) GetImport() (enttype.Import, error) {
	if f.Import != nil {
		return f.Import, nil
	}
	typ, err := f.GetEntType()
	if err != nil {
		return nil, err
	}
	ctype, ok := typ.(enttype.TSCodegenableType)
	if !ok {
		return nil, fmt.Errorf("%s doesn't have a valid codegenable type", f.Name)
	}
	return ctype.GetImportType(), nil
}

func (f *Field) GetEntType() (enttype.TSGraphQLType, error) {
	if f.Type.DBType == List {
		if f.Type.ListElemType == nil {
			return nil, fmt.Errorf("list elem type for list is nil")
		}
		elemType, err := getTypeFor(f.Type.ListElemType, false, nil)
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
		return getTypeFor(f.Type, f.Nullable, f.ForeignKey)
	}
}

type AssocEdge struct {
	// Note that anytime anything changes here, have to update assocEdgeEqual in compare.go
	Name        string            `json:"name,omitempty"`
	SchemaName  string            `json:"schemaName,omitempty"`
	Symmetric   bool              `json:"symmetric,omitempty"`
	Unique      bool              `json:"unique,omitempty"`
	TableName   string            `json:"tableName,omitempty"`
	InverseEdge *InverseAssocEdge `json:"inverseEdge,omitempty"`
	EdgeActions []*EdgeAction     `json:"edgeActions,omitempty"`
	// Go specific
	EntConfig       *schemaparser.EntConfigInfo
	HideFromGraphQL bool   `json:"hideFromGraphQL,omitempty"`
	EdgeConstName   string `json:"edgeConstName,omitempty"`
	PatternName     string `json:"patternName,omitempty"`
	// do we need a flag to know it's a pattern's edge?
	// PatternEdge
}

type AssocEdgeGroup struct {
	Name            string        `json:"name,omitempty"`
	GroupStatusName string        `json:"groupStatusName,omitempty"`
	TableName       string        `json:"tableName,omitempty"`
	AssocEdges      []*AssocEdge  `json:"assocEdges,omitempty"`
	EdgeActions     []*EdgeAction `json:"edgeActions,omitempty"`
	StatusEnums     []string      `json:"statusEnums,omitempty"`
	NullStateFn     string        `json:"nullStateFn,omitempty"`
	NullStates      []string      `json:"nullStates,omitempty"`

	// TS specific
	EdgeAction *EdgeAction `json:"edgeAction,omitempty"`

	// Go specific
	ActionEdges []string
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

func (f *ActionField) GetEntType(inputName string) (enttype.TSGraphQLType, error) {
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

func (f *ActionField) getEntTypeHelper(inputName string, nullable bool) (enttype.TSGraphQLType, error) {
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
	Name    string   `json:"name,omitempty"`
	Columns []string `json:"columns,omitempty"`
	Unique  bool     `json:"unique,omitempty"`
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
