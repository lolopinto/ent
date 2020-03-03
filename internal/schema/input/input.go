package input

import (
	"encoding/json"
	"go/types"
)

type Schema struct {
	Nodes map[string]Node
}

type Node struct {
	TableName *string `json:"tableName"`
	Fields    []Field `json:"fields"`
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
	Name            string    `json:"name"`
	Type            FieldType `json:"type"` // todo
	Nullable        bool      `json:"nullable"`
	StorageKey      string    `json:"storageKey"`
	Unique          bool      `json:"unique"`
	HideFromGraphQL bool      `json:"hideFromGraphQL"`
	Private         bool      `json:"private"`
	GraphQLName     string    `json:"graphqlName"`
	Index           bool      `json:"index"`
	PrimaryKey      bool      `json:"primaryKey"`

	ForeignKey    *[2]string  `json:"foreignKey"`
	ServerDefault interface{} `json:"serverDefault"`

	// Go specific information here
	TagMap          map[string]string
	GoType          types.Type
	PkgPath         string
	DataTypePkgPath string
}

func ParseSchema(input []byte) (*Schema, error) {
	nodes := make(map[string]Node)
	if err := json.Unmarshal(input, &nodes); err != nil {
		return nil, err
	}

	return &Schema{
		Nodes: nodes,
	}, nil
}
