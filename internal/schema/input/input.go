package input

import "encoding/json"

type Schema struct {
	Nodes map[string]Node
}

type Node struct {
	TableName *string `json:"tableName"`
	Fields    []Field `json:"fields"`
}

type Field struct {
	Name            string    `json:"name"`
	Type            string    `json:"type"` // todo
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
