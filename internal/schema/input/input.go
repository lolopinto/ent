package input

import (
	"encoding/json"
	"fmt"
	"go/types"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schemaparser"
)

type Schema struct {
	Nodes map[string]*Node
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
	HideFromGraphQL bool                     `json:"hideFromGraphQL"`
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
	UUID       DBType = "UUID"
	Int64ID           = "Int64ID"
	Boolean           = "Boolean"
	Int               = "Int"
	Float             = "Float"
	String            = "String"
	Time              = "Time"
	JSON              = "JSON"
	Enum              = "Enum"
	StringEnum        = "StringEnum"
)

type FieldType struct {
	DBType DBType `json:"dbType"`
	// required when DBType == DBType.Enum || DBType.StringEnum
	Values      []string `json:"values"`
	Type        string   `json:"type"`
	GraphQLType string   `json:"graphQLType"`
}

type Field struct {
	Name       string     `json:"name"`
	Type       *FieldType `json:"type"`
	Nullable   bool       `json:"nullable"`
	StorageKey string     `json:"storageKey"`
	// TODO need a way to indicate unique edge is Required also. this changes type generated in ent and graphql
	Unique          bool   `json:"unique"`
	HideFromGraphQL bool   `json:"hideFromGraphQL"`
	Private         bool   `json:"private"`
	GraphQLName     string `json:"graphqlName"`
	Index           bool   `json:"index"`
	PrimaryKey      bool   `json:"primaryKey"`

	FieldEdge     *[2]string  `json:"fieldEdge"` // this only really makes sense on id fields...
	ForeignKey    *[2]string  `json:"foreignKey"`
	ServerDefault interface{} `json:"serverDefault"`
	// DisableUserEditable true == DefaultValueOnCreate required
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
}

type PolymorphicOptions struct {
	Types                  []string `json:"types"`
	HideFromInverseGraphQL bool     `json:"hideFromInverseGraphQL"`
}

func (f *Field) GetEntType() enttype.EntType {
	switch f.Type.DBType {
	case UUID:
		if f.Nullable {
			return &enttype.NullableIDType{}
		}
		return &enttype.IDType{}
	case Int64ID:
		panic("unsupported type")
		return &enttype.IntegerType{}
	case Boolean:
		if f.Nullable {
			return &enttype.NullableBoolType{}
		}
		return &enttype.BoolType{}
	case Int:
		if f.Nullable {
			return &enttype.NullableIntegerType{}
		}
		return &enttype.IntegerType{}
	case Float:
		if f.Nullable {
			return &enttype.NullableFloatType{}
		}
		return &enttype.FloatType{}
	case String:
		if f.Nullable {
			return &enttype.NullableStringType{}
		}
		return &enttype.StringType{}
	case Time:
		if f.Nullable {
			return &enttype.NullableTimeType{}
		}
		return &enttype.TimeType{}
	case JSON:
		return &enttype.RawJSONType{}

	case StringEnum, Enum:
		typ := f.Type.Type
		graphqlType := f.Type.GraphQLType
		if f.ForeignKey != nil {
			typ = f.ForeignKey[0]
			graphqlType = f.ForeignKey[0]
		}
		if f.Type.Type == "" {
			panic("enum type name is required")
		}
		if f.Type.GraphQLType == "" {
			panic("enum graphql name is required")
		}
		if f.Nullable {
			return &enttype.NullableEnumType{
				EnumDBType:  f.Type.DBType == Enum,
				Type:        typ,
				GraphQLType: graphqlType,
				Values:      f.Type.Values,
			}
		}
		return &enttype.EnumType{
			EnumDBType:  f.Type.DBType == Enum,
			Type:        typ,
			GraphQLType: graphqlType,
			Values:      f.Type.Values,
		}
	}
	panic(fmt.Sprintf("unsupported type %s", f.Type.DBType))
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
	HideFromGraphQL bool `json:"hideFromGraphQL"`
}

type AssocEdgeGroup struct {
	Name            string        `json:"name"`
	GroupStatusName string        `json:"groupStatusName"`
	TableName       string        `json:"tableName"`
	AssocEdges      []*AssocEdge  `json:"assocEdges"`
	EdgeActions     []*EdgeAction `json:"edgeActions"`

	// Go specific
	ActionEdges []string
}

type EdgeAction struct {
	Operation         ent.ActionOperation `json:"operation"`
	CustomActionName  string              `json:"actionName"`
	CustomGraphQLName string              `json:"graphQLName"`
	CustomInputName   string              `json:"inputName"`
	HideFromGraphQL   bool                `json:"hideFromGraphQL"`
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

type ActionField struct {
	Name       string     `json:"name"`
	Type       ActionType `json:"type"`
	Nullable   bool       `json:"nullable"`
	ActionName string     `json:"actionName"`
}

func (f *ActionField) GetEntType() enttype.TSGraphQLType {
	switch f.Type {
	case ActionTypeID:
		if f.Nullable {
			return &enttype.NullableIDType{}
		}
		return &enttype.IDType{}
	case ActionTypeBoolean:
		if f.Nullable {
			return &enttype.NullableBoolType{}
		}
		return &enttype.BoolType{}
	case ActionTypeInt:
		if f.Nullable {
			return &enttype.NullableIntegerType{}
		}
		return &enttype.IntegerType{}
	case ActionTypeFloat:
		if f.Nullable {
			return &enttype.NullableFloatType{}
		}
		return &enttype.FloatType{}
	case ActionTypeString:
		if f.Nullable {
			return &enttype.NullableStringType{}
		}
		return &enttype.StringType{}
	case ActionTypeTime:
		if f.Nullable {
			return &enttype.NullableTimeType{}
		}
		return &enttype.TimeType{}
	case ActionTypeObject:
		tsType := fmt.Sprintf("custom%sInput", strcase.ToCamel(f.Name))

		if f.Nullable {
			typ := &enttype.NullableObjectType{}
			typ.TSType = tsType
			typ.ActionName = f.ActionName

			return typ
		}
		typ := &enttype.ObjectType{}
		typ.TSType = tsType
		typ.ActionName = f.ActionName
		return typ
	}
	panic(fmt.Sprintf("unsupported type %s", f.Type))
}

type ActionType string

const (
	// Note that these types should match ActionField.Type in schema.ts
	ActionTypeID      ActionType = "ID"
	ActionTypeBoolean            = "Boolean"
	ActionTypeInt                = "Int"
	ActionTypeFloat              = "Float"
	ActionTypeString             = "String"
	ActionTypeTime               = "Time"
	ActionTypeObject             = "Object"
)

type Constraint struct {
	Name       string          `json:"name"`
	Type       ConstraintType  `json:"type"`
	Columns    []string        `json:"columns"`
	ForeignKey *ForeignKeyInfo `json:"fkey"`
	Condition  string          `json:"condition"`
}

type ConstraintType string

const (
	// Note that these type should match enum ConstraintType in schema.ts
	PrimaryKey ConstraintType = "primary"
	ForeignKey                = "foreign"
	Unique                    = "unique"
	Check                     = "check"
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
	Cascade                 = "CASCADE"
	SetNull                 = "SET NULL"
	SetDefault              = "SET DEFAULT"
	NoAction                = "NO ACTION"
)

func (g *AssocEdgeGroup) AddAssocEdge(edge *AssocEdge) {
	g.AssocEdges = append(g.AssocEdges, edge)
}

type InverseAssocEdge struct {
	// TODO need to be able to mark this as unique
	// this is an easy way to get 1->many
	Name string `json:"name"`
}

func ParseSchema(input []byte) (*Schema, error) {
	nodes := make(map[string]*Node)
	if err := json.Unmarshal(input, &nodes); err != nil {
		return nil, err
	}

	return &Schema{
		Nodes: nodes,
	}, nil
}
