package input

import "encoding/json"

type Schema struct {
	Nodes map[string]Node
}

type Node struct {
	TableName *string `json:"tableName"`
	Fields    []Field `json:"fields"`
}

type DBType int

const (
	// Note that these types should match enum DBType in schema.ts
	UUID DBType = iota
	Int64ID
	Boolean
	Int
	Float
	String
	Time
	JSON
)

type FieldType struct {
	DBType DBType
}

type Field struct {
	Name            string    `json:"name"`
	Type            FieldType `json:"type"`
	Nullable        *bool     `json:"nullable"`
	StorageKey      *string   `json:"storageKey"`
	Unique          *bool     `json:"unique"`
	HideFromGraphQL *bool     `json:"hideFromGraphQL"`
	Private         *bool     `json:"private"`
	GraphQLName     *string   `json:"graphqlName"`
	Index           *bool     `json:"index"`
	ForeignKey      [2]string `json:"foreignKey"`
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
