package schema_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSchemaWithFields(t *testing.T) {
	sources := make(map[string]string)
	sources["todo_config.go"] = `
	package configs

type TodoConfig struct {
	Text      string
	AccountID string
}`

	s := parseSchema(t, sources, "SchemaWithFields")

	fieldInfo := s.Nodes["TodoConfig"].NodeData.FieldInfo

	// 2 above plus the 3 added
	assert.Len(t, fieldInfo.Fields, 5)
}

func TestSchemaWithFieldsFunc(t *testing.T) {
	sources := make(map[string]string)
	sources["user_config.go"] = `package configs

	import "github.com/lolopinto/ent/ent"
	import "github.com/lolopinto/ent/ent/field"

	type UserConfig struct {}

	func (config *UserConfig) GetFields() ent.FieldMap {
		return ent.FieldMap {
			"Username": field.F(
				&field.StringDataType{},
				field.Unique(),
			),
		}
	}`

	s := parseSchema(t, sources, "SchemaWithFieldsFunc")

	fieldInfo := s.Nodes["UserConfig"].NodeData.FieldInfo

	// 1 above plus the 3 added
	assert.Len(t, fieldInfo.Fields, 4)
}

func TestSchemaWithBoth(t *testing.T) {
	sources := make(map[string]string)
	sources["user_config.go"] = `package configs

	import "github.com/lolopinto/ent/ent"
	import "github.com/lolopinto/ent/ent/field"

	type UserConfig struct {
		Text      string
	}

	func (config *UserConfig) GetFields() ent.FieldMap {
		return ent.FieldMap {
			"Username": field.F(
				&field.StringDataType{},
				field.Unique(),
			),
		}
	}`

	_, err := parseSchemaPlusError(t, sources, "SchemaWithBoth")
	assert.Error(t, err)
}

func TestSchemaWithNeither(t *testing.T) {
	sources := make(map[string]string)
	sources["user_config.go"] = `package configs

	type UserConfig struct {}`

	_, err := parseSchemaPlusError(t, sources, "SchemaWithNeither")
	assert.Error(t, err)
}
