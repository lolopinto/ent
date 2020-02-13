package field

import "testing"

func TestIntsField(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"Ints": field.F(
					field.IntsType(),
				),
			}
		}`,
		&Field{
			FieldName:                "Ints",
			dbName:                   "ints",
			graphQLName:              "ints",
			topLevelStructField:      true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
		},
	)
	// stored as string because it'll be json encoded
	testDBType(t, field, "sa.Text()")
	// this currently indicates not nullable but should fix this for slices since we can pass null here
	// this needs to be [Int!] without @required of some sort
	testGraphQLType(t, field, "[Int!]!")
	testStructType(t, field, "[]int")
}

func TestStringsField(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"Strings": field.F(
					field.StringsType(),
				),
			}
		}`,
		&Field{
			FieldName:                "Strings",
			dbName:                   "strings",
			graphQLName:              "strings",
			topLevelStructField:      true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
		},
	)
	// stored as string because it'll be json encoded
	testDBType(t, field, "sa.Text()")
	// this currently indicates not nullable but should fix this for slices since we can pass null here
	// this needs to be [String!] without @required of some sort
	testGraphQLType(t, field, "[String!]!")
	testStructType(t, field, "[]string")
}

func TestFloatsField(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"Floats": field.F(
					field.FloatsType(),
				),
			}
		}`,
		&Field{
			FieldName:                "Floats",
			dbName:                   "floats",
			graphQLName:              "floats",
			topLevelStructField:      true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
		},
	)
	// stored as string because it'll be json encoded
	testDBType(t, field, "sa.Text()")
	// this currently indicates not nullable but should fix this for slices since we can pass null here
	// this needs to be [Float!] without @required of some sort
	testGraphQLType(t, field, "[Float!]!")
	testStructType(t, field, "[]float64")
}

func TestScalarJSON(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"ScalarJSON": field.F(
					field.JSONType(""),
				),
			}
		}`,
		&Field{
			FieldName:                "ScalarJSON",
			dbName:                   "scalar_json",
			graphQLName:              "scalarJSON",
			topLevelStructField:      true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
		},
	)
	testDBType(t, field, "sa.Text()")
	testGraphQLType(t, field, "String!")
	testStructType(t, field, "string")
}

func TestJSONObject(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "encoding/json"
		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"JSONObject": field.F(
					field.JSONType(json.RawMessage{}),
				),
			}
		}`,
		&Field{
			FieldName:                "JSONObject",
			dbName:                   "json_object",
			graphQLName:              "jSONObject", // lol
			topLevelStructField:      true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
			pkgPath:                  "encoding/json",
		},
	)
	testDBType(t, field, "sa.Text()")
	// TODO this isn't right. we need to differentiate between things that expose GraphQL vs not and have this return string vs this
	testGraphQLType(t, field, "RawMessage!")
	testStructType(t, field, "json.RawMessage")
}

func TestJSONObjectPointer(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "encoding/json"
		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"JSONObject": field.F(
					field.JSONType(&json.RawMessage{}),
				),
			}
		}`,
		&Field{
			FieldName:                "JSONObject",
			dbName:                   "json_object",
			graphQLName:              "jSONObject", // lol
			topLevelStructField:      true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
			pkgPath:                  "encoding/json",
		},
	)
	testDBType(t, field, "sa.Text()")
	// TODO this isn't right. we need to differentiate between things that expose GraphQL vs not and have this return string vs this
	testGraphQLType(t, field, "RawMessage")
	testStructType(t, field, "*json.RawMessage")
}

func TestJSONObjectList(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "encoding/json"
		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"JSONObjects": field.F(
					field.JSONType([]json.RawMessage{}),
				),
			}
		}`,
		&Field{
			FieldName:                "JSONObjects",
			dbName:                   "json_objects",
			graphQLName:              "jSONObjects", // lol
			topLevelStructField:      true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
			pkgPath:                  "encoding/json",
		},
	)
	testDBType(t, field, "sa.Text()")
	// TODO this isn't right. we need to differentiate between things that expose GraphQL vs not and have this return string vs this
	testGraphQLType(t, field, "[RawMessage!]!")
	testStructType(t, field, "[]json.RawMessage")
}

func TestJSONObjectPointerList(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "encoding/json"
		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"JSONObjects": field.F(
					field.JSONType([]*json.RawMessage{}),
				),
			}
		}`,
		&Field{
			FieldName:                "JSONObjects",
			dbName:                   "json_objects",
			graphQLName:              "jSONObjects", // lol
			topLevelStructField:      true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
			pkgPath:                  "encoding/json",
		},
	)
	testDBType(t, field, "sa.Text()")
	// TODO this isn't right. we need to differentiate between things that expose GraphQL vs not and have this return string vs this
	testGraphQLType(t, field, "[RawMessage]!")
	testStructType(t, field, "[]*json.RawMessage")
}

func TestJSONMap(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"Map": field.F(
					field.JSONType(map[string]string{}),
				),
			}
		}`,
		&Field{
			FieldName:                "Map",
			dbName:                   "map",
			graphQLName:              "map",
			topLevelStructField:      true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
		},
	)
	testDBType(t, field, "sa.Text()")
	testGraphQLType(t, field, "Map")
	testStructType(t, field, "map[string]string")
}

func TestJSONPointerToMap(t *testing.T) {
	field := verifyField(
		t,
		`package configs

		import "github.com/lolopinto/ent/ent"
		import "github.com/lolopinto/ent/ent/field"

		type UserConfig struct {}
		
		func (config *UserConfig) GetFields() ent.FieldMap {
			return ent.FieldMap {
				"Map": field.F(
					field.JSONType(&map[string]string{}),
				),
			}
		}`,
		&Field{
			FieldName:                "Map",
			dbName:                   "map",
			graphQLName:              "map",
			topLevelStructField:      true,
			exposeToActionsByDefault: true,
			dbColumn:                 true,
		},
	)
	testDBType(t, field, "sa.Text()")
	testGraphQLType(t, field, "Map")
	testStructType(t, field, "*map[string]string")
}
