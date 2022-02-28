package field_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/internal/schema/testhelper"
	"github.com/lolopinto/ent/internal/tsimport"
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

	assert.Equal(t, f2.TsBuilderImports(), []*tsimport.ImportPath{
		tsimport.NewEntImportPath("ID"),
		tsimport.NewEntImportPath("Ent"),
		tsimport.NewEntImportPath("Builder"),
	})
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

func TestDisableBuilderIDField(t *testing.T) {
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
					polymorphic: {
						disableBuilderType: true,
					},
				}),
			];
		}`),
		},
		base.TypeScript,
	)
	info := schema.Nodes["AddressConfig"]
	require.NotNil(t, info)

	fieldInfo := info.NodeData.FieldInfo

	f2 := fieldInfo.GetFieldByName("OwnerID")
	require.NotNil(t, f2)

	assert.Equal(t, f2.TsBuilderImports(), []*tsimport.ImportPath{
		tsimport.NewEntImportPath("ID"),
	})
	assert.Equal(t, f2.TsBuilderType(), "ID")
}

func TestUUIDFieldList(t *testing.T) {
	schema := testhelper.ParseSchemaForTest(t,
		map[string]string{
			"contact.ts": testhelper.GetCodeWithSchema(`
		import {BaseEntSchema, Field, StringType, UUIDListType} from "{schema}";

		export default class Contact extends BaseEntSchema {
			fields: Field[] = [
				StringType({ name: "FirstName" }),
				StringType({ name: "LastName" }),
				UUIDListType({
					name: "contactEmailIDs",
					fieldEdge:{
						schema: "ContactEmail",
					},
				}),
			];
		}`),
			"contact_email.ts": testhelper.GetCodeWithSchema(`
		import {BaseEntSchema, Field, StringType, UUIDType} from "{schema}";

		export default class ContactEmail extends BaseEntSchema {
			fields: Field[] = [
				StringType({ name: "EmailAddress" }),
				UUIDType({
					name: "OwnerID",
					fieldEdge: {schema: "Contact"},
				}),
			];
		}`),
		},
		base.TypeScript,
	)
	info := schema.Nodes["ContactConfig"]
	require.NotNil(t, info)

	fieldInfo := info.NodeData.FieldInfo

	f := fieldInfo.GetFieldByName("contactEmailIDs")
	require.NotNil(t, f)

	assert.Equal(t, f.TsBuilderImports(), []*tsimport.ImportPath{
		tsimport.NewEntImportPath("ID"),
	})
	assert.Equal(t, f.TsBuilderType(), "ID[]")
	assert.Len(t, info.NodeData.EdgeInfo.FieldEdges, 1)
	assert.True(t, info.NodeData.EdgeInfo.FieldEdges[0].IsList())

	info2 := schema.Nodes["ContactEmailConfig"]
	require.NotNil(t, info2)

	fieldInfo2 := info2.NodeData.FieldInfo

	f2 := fieldInfo2.GetFieldByName("OwnerID")
	require.NotNil(t, f2)

	assert.Equal(t, f2.TsBuilderImports(), []*tsimport.ImportPath{
		tsimport.NewEntImportPath("ID"),
		tsimport.NewLocalEntImportPath("Contact"),
		tsimport.NewEntImportPath("Builder"),
	})
	assert.Equal(t, f2.TsBuilderType(), "ID | Builder<Contact>")
	assert.Len(t, info2.NodeData.EdgeInfo.FieldEdges, 1)
	assert.False(t, info2.NodeData.EdgeInfo.FieldEdges[0].IsList())
}
