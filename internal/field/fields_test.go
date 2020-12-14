package field_test

import (
	"path/filepath"
	"testing"

	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/testhelper"
	"github.com/stretchr/testify/require"
)

func TestDerivedFields(t *testing.T) {
	absPath, err := filepath.Abs(".")
	require.NoError(t, err)

	schema := testhelper.ParseSchemaForTest(t,
		absPath,
		map[string]string{
			"address.ts": testhelper.GetCodeWithSchema(`
		import {Schema, Field, StringType, UUIDType} from "{schema}";

		export default class Address implements Schema {
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

	// 5 fields above + OwnerType field
	require.Len(t, fieldInfo.Fields, 6)

	// field exists
	f := fieldInfo.GetFieldByName("OwnerType")
	require.NotNil(t, f)
}
