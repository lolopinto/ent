package input

import (
	"encoding/json"
	"go/types"

	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schemaparser"
)

type Schema struct {
	Nodes map[string]*Node
}

type Node struct {
	TableName       *string           `json:"tableName"`
	Fields          []*Field          `json:"fields"`
	AssocEdges      []*AssocEdge      `json:"assocEdges"`
	AssocEdgeGroups []*AssocEdgeGroup `json:"assocEdgeGroups"`
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
	UUID    DBType = "UUID"
	Int64ID        = "Int64ID"
	Boolean        = "Boolean"
	Int            = "Int"
	Float          = "Float"
	String         = "String"
	Time           = "Time"
	JSON           = "JSON"
)

type FieldType struct {
	DBType DBType `json:"dbType"`
}

type Field struct {
	Name            string     `json:"name"`
	Type            *FieldType `json:"type"`
	Nullable        bool       `json:"nullable"`
	StorageKey      string     `json:"storageKey"`
	// TODO need a way to indicate unique edge is Required also. this changes type generated in ent and graphql
	Unique          bool       `json:"unique"`
	HideFromGraphQL bool       `json:"hideFromGraphQL"`
	Private         bool       `json:"private"`
	GraphQLName     string     `json:"graphqlName"`
	Index           bool       `json:"index"`
	PrimaryKey      bool       `json:"primaryKey"`

	FieldEdge     *[2]string  `json:"fieldEdge"` // this only really makes sense on id fields...
	ForeignKey    *[2]string  `json:"foreignKey"`
	ServerDefault interface{} `json:"serverDefault"`
	// DisableUserEditable true == DefaultValueOnCreate required
	DisableUserEditable     bool `json:"disableUserEditable"`
	HasDefaultValueOnCreate bool `json:"hasDefaultValueOnCreate"`
	HasDefaultValueOnEdit   bool `json:"hasDefaultValueOnEdit"`

	// Go specific information here
	TagMap          map[string]string
	GoType          types.Type
	PkgPath         string
	DataTypePkgPath string
}

func (f *Field) GetEntType() enttype.EntType {
	switch f.Type.DBType {
	case UUID:
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
	}
	panic("unsupported type")
}

type AssocEdge struct {
	Name        string            `json:"name"`
	SchemaName  string            `json:"schemaName"`
	Symmetric   bool              `json:"symmetric"`
	Unique      bool              `json:"unique"`
	TableName   string            `json:"tableName"`
	InverseEdge *InverseAssocEdge `json:"inverseEdge"`

	// Go specific
	EntConfig   *schemaparser.EntConfigInfo
	EdgeActions interface{}
}

type AssocEdgeGroup struct {
	Name            string       `json:"name"`
	GroupStatusName string       `json:"groupStatusName"`
	TableName       string       `json:"tableName"`
	AssocEdges      []*AssocEdge `json:"assocEdges"`

	// Go specific
	EdgeActions interface{}
	ActionEdges []string
}

func (g *AssocEdgeGroup) AddAssocEdge(edge *AssocEdge) {
	g.AssocEdges = append(g.AssocEdges, edge)
}

type InverseAssocEdge struct {
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
