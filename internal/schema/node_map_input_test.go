package schema_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/input"
	"github.com/stretchr/testify/assert"
)

func TestParseFromInputSchema(t *testing.T) {
	inputSchema := &input.Schema{
		Nodes: map[string]input.Node{
			"User": input.Node{
				Fields: []*input.Field{
					&input.Field{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
					},
					&input.Field{
						Name: "firstName",
						Type: &input.FieldType{
							DBType: input.String,
						},
					},
				},
			},
		},
	}

	schema := schema.ParseFromInputSchema(inputSchema)

	assert.Len(t, schema.Nodes, 1)

	// still config name because of artifact of go and old schema
	userConfig := schema.Nodes["UserConfig"]
	assert.NotNil(t, userConfig)

	// no table name provided and one automatically generated
	assert.Equal(t, "users", userConfig.NodeData.TableName)
	field, err := schema.GetFieldByName("UserConfig", "id")
	assert.Nil(t, err)
	assert.NotNil(t, field)
}

func TestParseFromInputSchemaWithTable(t *testing.T) {
	// rename of user -> accounts or something
	tableName := "accounts"
	inputSchema := &input.Schema{
		Nodes: map[string]input.Node{
			"User": input.Node{
				TableName: &tableName,
				Fields: []*input.Field{
					&input.Field{
						Name: "id",
						Type: &input.FieldType{
							DBType: input.UUID,
						},
					},
				},
			},
		},
	}

	schema := schema.ParseFromInputSchema(inputSchema)

	assert.Len(t, schema.Nodes, 1)

	// still config name because of artifact of friends
	userConfig := schema.Nodes["UserConfig"]
	assert.NotNil(t, userConfig)

	assert.Equal(t, "accounts", userConfig.NodeData.TableName)
}
