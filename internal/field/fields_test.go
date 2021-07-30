package field_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/testhelper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDerivedFields(t *testing.T) {
	schema := testhelper.ParseSchemaForTest(t,
		map[string]string{
			"address.ts": testhelper.GetCodeWithSchema(`
		import {BaseEntSchema, Field, StringType, UUIDType} from "{schema}";

		export default class Address extends BaseEntSchema {
			fields: Field[] = [
				StringType({ name: "Street" }),
				StringType({ name: "City" }),
				StringType({ name: "State" }),
				StringType({ name: "ZipCode" }), 
				UUIDType({
					name: "OwnerID",
					index: true, 
					polymorphic: true,
				}),
			];
		}`),
		},
		base.TypeScript,
	)
	info := schema.Nodes["AddressConfig"]
	require.NotNil(t, info)

	fieldInfo := info.NodeData.FieldInfo

	// 5 fields above + OwnerType field + id,createdat,updatedat
	require.Len(t, fieldInfo.Fields, 9)

	// field exists
	f := fieldInfo.GetFieldByName("OwnerType")
	require.NotNil(t, f)
	// TODO need to test this derived field more but testField is in different package
	// and a lot of the fields in Field are private and its a whole thing...
	// this field is simple enough so we ignore for now

	f2 := fieldInfo.GetFieldByName("OwnerID")
	require.NotNil(t, f2)

	assert.Equal(t, f2.TsBuilderImports(), []string{"ID", "Ent", "Builder"})
	assert.Equal(t, f2.TsBuilderType(), "ID | Builder<Ent>")
}

func TestDuplicateFields(t *testing.T) {
	schema, err := testhelper.ParseSchemaForTestFull(t,
		map[string]string{
			"address.ts": testhelper.GetCodeWithSchema(`
		import {Schema, Field, StringType, UUIDType} from "{schema}";

		export default class Address implements Schema {
			fields: Field[] = [
				StringType({ name: "Street" }),
				StringType({ name: "street" }),
			];
		}`),
		},
		base.TypeScript,
	)

	require.Error(t, err)
	require.Equal(t, err.Error(), "field with column street already exists")
	require.Nil(t, schema)
}
