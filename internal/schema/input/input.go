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
)

type Schema struct {
	Nodes    map[string]*Node    `json:"schemas"`
	Patterns map[string]*Pattern `json:"patterns"`
}

type Pattern struct {
	Name       string       `json:"name"`
	AssocEdges []*AssocEdge `json:"assocEdges"`
}

type Node struct {
	TableName       *string                  `json:"tableName"`
	Fields          []*Field                 `json:"fields"`
	AssocEdges      []*AssocEdge             `json:"assocEdges"`
	AssocEdgeGroups []*AssocEdgeGroup        `json:"assocEdgeGroups"`
	Actions         []*Action                `json:"actions"`
	EnumTable       bool                     `json:"enumTable"`
	DBRows          []map[string]interface{} `json:"dbRows"`
	Constraints     []*Constraint            `json:"constraints"`
	Indices         []*Index                 `json:"indices"`
	HideFromGraphQL bool                     `json:"hideFromGraphQL"`
	EdgeConstName   string                   `json:"edgeConstName"`
	PatternName     string                   `json:"patternName"`
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
	DBType DBType `json:"dbType"`
	// required when DBType == DBType.List
	ListElemType *FieldType `json:"listElemType"`
	// required when DBType == DBType.Enum || DBType.StringEnum
	Values      []string          `json:"values"`
	EnumMap     map[string]string `json:"enumMap"`
	Type        string            `json:"type"`
	GraphQLType string            `json:"graphQLType"`
	// optional used by generator to specify different types e.g. email, phone, password
	CustomType CustomType               `json:"customType"`
	ImportType *enttype.InputImportType `json:"importType"`
}

type Field struct {
	Name       string     `json:"name"`
	Type       *FieldType `json:"type"`
	Nullable   bool       `json:"nullable"`
	StorageKey string     `json:"storageKey"`
	// TODO need a way to indicate unique edge is Required also. this changes type generated in ent and graphql
	Unique                  bool   `json:"unique"`
	HideFromGraphQL         bool   `json:"hideFromGraphQL"`
	Private                 bool   `json:"private"`
	GraphQLName             string `json:"graphqlName"`
	Index                   bool   `json:"index"`
	PrimaryKey              bool   `json:"primaryKey"`
	DefaultToViewerOnCreate bool   `json:"defaultToViewerOnCreate"`

	FieldEdge     *FieldEdge  `json:"fieldEdge"` // this only really makes sense on id fields...
	ForeignKey    *ForeignKey `json:"foreignKey"`
	ServerDefault interface{} `json:"serverDefault"`
	// DisableUserEditable true == DefaultValueOnCreate required OR set in trigger
	DisableUserEditable     bool `json:"disableUserEditable"`
	HasDefaultValueOnCreate bool `json:"hasDefaultValueOnCreate"`
	HasDefaultValueOnEdit   bool `json:"hasDefaultValueOnEdit"`

	Polymorphic         *PolymorphicOptions `json:"polymorphic"`
	DerivedWhenEmbedded bool                `json:"derivedWhenEmbedded"`
	DerivedFields       []*Field            `json:"derivedFields"`

	// Go specific information here
	TagMap          map[string]string
	GoType          types.Type
	PkgPath         string
	DataTypePkgPath string

	// set when parsed via tsent generate schema
	Import enttype.Import
}

type ForeignKey struct {
	Schema       string `json:"schema"`
	Column       string `json:"column"`
	Name         string `json:"name"`
	DisableIndex bool   `json:"disableIndex"`
}

type FieldEdge struct {
	Schema      string `json:"schema"`
	InverseEdge string `json:"inverseEdge"`
}

type PolymorphicOptions struct {
	Types                  []string `json:"types"`
	HideFromInverseGraphQL bool     `json:"hideFromInverseGraphQL"`
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
	Name        string            `json:"name"`
	SchemaName  string            `json:"schemaName"`
	Symmetric   bool              `json:"symmetric"`
	Unique      bool              `json:"unique"`
	TableName   string            `json:"tableName"`
	InverseEdge *InverseAssocEdge `json:"inverseEdge"`
	EdgeActions []*EdgeAction     `json:"edgeActions"`
	// Go specific
	EntConfig       *schemaparser.EntConfigInfo
	HideFromGraphQL bool   `json:"hideFromGraphQL"`
	EdgeConstName   string `json:"edgeConstName"`
	PatternName     string `json:"patternName"`
	// do we need a flag to know it's a pattern's edge?
	// PatternEdge
}

type AssocEdgeGroup struct {
	Name            string        `json:"name"`
	GroupStatusName string        `json:"groupStatusName"`
	TableName       string        `json:"tableName"`
	AssocEdges      []*AssocEdge  `json:"assocEdges"`
	EdgeActions     []*EdgeAction `json:"edgeActions"`
	StatusEnums     []string      `json:"statusEnums"`
	NullStateFn     string        `json:"nullStateFn"`
	NullStates      []string      `json:"nullStates"`

	// TS specific
	EdgeAction *EdgeAction `json:"edgeAction"`

	// Go specific
	ActionEdges []string
}

type EdgeAction struct {
	Operation         ent.ActionOperation `json:"operation"`
	CustomActionName  string              `json:"actionName"`
	CustomGraphQLName string              `json:"graphQLName"`
	CustomInputName   string              `json:"inputName"`
	HideFromGraphQL   bool                `json:"hideFromGraphQL"`
	ActionOnlyFields  []*ActionField      `json:"actionOnlyFields"`
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
	Operation         ent.ActionOperation `json:"operation"`
	Fields            []string            `json:"fields"`
	CustomActionName  string              `json:"actionName"`
	CustomGraphQLName string              `json:"graphQLName"`
	CustomInputName   string              `json:"inputName"`
	HideFromGraphQL   bool                `json:"hideFromGraphQL"`
	ActionOnlyFields  []*ActionField      `json:"actionOnlyFields"`
}

func (a *Action) GetTSStringOperation() string {
	return getTSStringOperation(a.Operation)
}

type NullableItem string

const NullableContents NullableItem = "contents"
const NullableContentsAndList NullableItem = "contentsAndList"
const NullableTrue NullableItem = "true"

type actionField struct {
	Name       string       `json:"name"`
	Type       ActionType   `json:"type"`
	Nullable   NullableItem `json:"nullable"`
	List       bool         `json:"list"`
	ActionName string       `json:"actionName"`
}

type ActionField struct {
	Name             string
	Type             ActionType
	Nullable         bool
	list             bool
	nullableContents bool
	ActionName       string
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

			return typ, nil
		}
		typ := &enttype.ObjectType{}
		typ.TSType = tsType
		typ.GraphQLType = gqlType
		typ.ActionName = f.ActionName
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
	Name       string          `json:"name"`
	Type       ConstraintType  `json:"type"`
	Columns    []string        `json:"columns"`
	ForeignKey *ForeignKeyInfo `json:"fkey"`
	Condition  string          `json:"condition"`
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
	Name    string   `json:"name"`
	Columns []string `json:"columns"`
	Unique  bool     `json:"unique"`
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
	TableName string       `json:"tableName"`
	Columns   []string     `json:"columns"`
	OnDelete  OnDeleteFkey `json:"ondelete"`
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
	Name          string `json:"name"`
	EdgeConstName string `json:"edgeConstName"`
}

func ParseSchema(input []byte) (*Schema, error) {
	s := &Schema{}
	if err := json.Unmarshal(input, s); err != nil {
		// don't think this applies but keeping it here just in case
		nodes := make(map[string]*Node)
		if err := json.Unmarshal(input, &nodes); err != nil {
			return nil, err
		}
		return &Schema{Nodes: nodes}, nil
	}
	// in the old route, it doesn't throw an error but just unmarshalls nothing 😭
	// TestCustomFields
	// also need to verify TestCustomListQuery|TestCustomUploadType works
	// so checking s.Nodes == nil instead of len() == 0
	if s.Nodes == nil {
		nodes := make(map[string]*Node)
		if err := json.Unmarshal(input, &nodes); err != nil {
			return nil, err
		}
		return &Schema{Nodes: nodes}, nil
	}
	return s, nil
}
