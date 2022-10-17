package field_test

import (
	"testing"

	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/schema/testhelper"
	"github.com/lolopinto/ent/internal/tsimport"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDerivedFields(t *testing.T) {
	schema := testhelper.ParseSchemaForTest(t,
		map[string]string{
			"address.ts": testhelper.GetCodeWithSchema(`
		import {EntSchema, StringType, UUIDType} from "{schema}";

		const Address = new EntSchema({
			fields: {
				Street: StringType(),
				City: StringType(),
				State: StringType(),
				ZipCode: StringType(), 
				OwnerID: UUIDType({
					index: true, 
					polymorphic: true,
				}),
			},
		});
		export default Address`),
		},
	)
	info := schema.Nodes["Address"]
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

	cfg := &codegenapi.DummyConfig{}
	assert.Equal(t, f2.TsBuilderImports(cfg), []*tsimport.ImportPath{
		tsimport.NewEntImportPath("ID"),
		tsimport.NewEntImportPath("Ent"),
		tsimport.NewEntActionImportPath("Builder"),
		tsimport.NewEntImportPath("Viewer"),
	})
	assert.Equal(t, f2.TsBuilderType(cfg), "ID | Builder<Ent<Viewer>, Viewer>")
}

func TestDuplicateFields(t *testing.T) {
	schema, err := testhelper.ParseSchemaForTestFull(t,
		map[string]string{
			"address.ts": testhelper.GetCodeWithSchema(`
		import {EntSchema, StringType, UUIDType} from "{schema}";

		const Address = new EntSchema({
			fields: {
				Street: StringType(),
				street: StringType(),
			},
		});
		export default Address`),
		},
	)

	require.Error(t, err)
	require.Equal(t, err.Error(), "field with column street already exists")
	require.Nil(t, schema)
}

func TestDisableBuilderIDField(t *testing.T) {
	schema := testhelper.ParseSchemaForTest(t,
		map[string]string{
			"address.ts": testhelper.GetCodeWithSchema(`
		import {EntSchema, StringType, UUIDType} from "{schema}";

		const Address = new EntSchema({
			fields: {
				Street: StringType(),
				City: StringType(),
				State: StringType(),
				ZipCode: StringType(), 
				OwnerID: UUIDType({
					index: true, 
					polymorphic: {
						disableBuilderType: true,
					},
				}),
			},
		});
		export default Address`),
		},
	)
	info := schema.Nodes["Address"]
	require.NotNil(t, info)

	fieldInfo := info.NodeData.FieldInfo

	f2 := fieldInfo.GetFieldByName("OwnerID")
	require.NotNil(t, f2)

	cfg := &codegenapi.DummyConfig{}
	assert.Equal(t, f2.TsBuilderImports(cfg), []*tsimport.ImportPath{
		tsimport.NewEntImportPath("ID"),
	})
	assert.Equal(t, f2.TsBuilderType(cfg), "ID")
}

func TestUUIDFieldList(t *testing.T) {
	schema := testhelper.ParseSchemaForTest(t,
		map[string]string{
			"contact.ts": testhelper.GetCodeWithSchema(`
		import {EntSchema, FieldMap, StringType, UUIDListType} from "{schema}";

		const Contact = new EntSchema({
			fields: {
				FirstName: StringType(),
				LastName: StringType(),
				contactEmailIDs: UUIDListType({
					fieldEdge:{
						schema: "ContactEmail",
					},
				}),
			},
		});
		export default Contact`),
			"contact_email.ts": testhelper.GetCodeWithSchema(`
		import {EntSchema, FieldMap, StringType, UUIDType} from "{schema}";

		const ContactEmail = new EntSchema({
			fields: {
				EmailAddress: StringType(),
				OwnerID: UUIDType({
					fieldEdge: {schema: "Contact"},
				}),
			},
		});
		export default ContactEmail`),
		},
	)
	info := schema.Nodes["Contact"]
	require.NotNil(t, info)

	fieldInfo := info.NodeData.FieldInfo

	f := fieldInfo.GetFieldByName("contactEmailIDs")
	require.NotNil(t, f)

	cfg := &codegenapi.DummyConfig{}

	assert.Equal(t, f.TsBuilderImports(cfg), []*tsimport.ImportPath{
		tsimport.NewEntImportPath("ID"),
	})
	assert.Equal(t, f.TsBuilderType(cfg), "ID[]")
	assert.Len(t, info.NodeData.EdgeInfo.FieldEdges, 1)
	assert.True(t, info.NodeData.EdgeInfo.FieldEdges[0].IsList())

	info2 := schema.Nodes["ContactEmail"]
	require.NotNil(t, info2)

	fieldInfo2 := info2.NodeData.FieldInfo

	f2 := fieldInfo2.GetFieldByName("OwnerID")
	require.NotNil(t, f2)

	assert.Equal(t, f2.TsBuilderImports(cfg), []*tsimport.ImportPath{
		tsimport.NewEntImportPath("ID"),
		tsimport.NewLocalEntImportPath("Contact"),
		tsimport.NewEntActionImportPath("Builder"),
		tsimport.NewEntImportPath("Viewer"),
	})
	assert.Equal(t, f2.TsBuilderType(cfg), "ID | Builder<Contact, Viewer>")
	assert.Len(t, info2.NodeData.EdgeInfo.FieldEdges, 1)
	assert.False(t, info2.NodeData.EdgeInfo.FieldEdges[0].IsList())

	edge := info.NodeData.EdgeInfo.GetFieldEdgeByName("contactEmails")
	require.NotNil(t, edge)
	require.Equal(t, edge.GetTSGraphQLTypeImports(), []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewGQLClassImportPath("GraphQLList"),
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewLocalGraphQLEntImportPath(edge.NodeInfo.Node),
	})
}

func TestNullableUUIDFieldList(t *testing.T) {
	schema := testhelper.ParseSchemaForTest(t,
		map[string]string{
			"contact.ts": testhelper.GetCodeWithSchema(`
		import {EntSchema, StringType, UUIDListType} from "{schema}";

		const Contact = new EntSchema({
			fields: {
				FirstName: StringType(),
				LastName: StringType(),
				contactEmailIDs: UUIDListType({
					nullable: true,
					fieldEdge:{
						schema: "ContactEmail",
					},
				}),
			},
		});
		export default Contact`),
			"contact_email.ts": testhelper.GetCodeWithSchema(`
		import {EntSchema, StringType, UUIDType} from "{schema}";

		const ContactEmail = new EntSchema({
			fields: {
				EmailAddress: StringType(),
				OwnerID: UUIDType({
					fieldEdge: {schema: "Contact"},
				}),
			},
		});
		export default ContactEmail`),
		},
	)
	info := schema.Nodes["Contact"]
	require.NotNil(t, info)

	fieldInfo := info.NodeData.FieldInfo

	f := fieldInfo.GetFieldByName("contactEmailIDs")
	require.NotNil(t, f)

	cfg := &codegenapi.DummyConfig{}

	assert.Equal(t, f.TsBuilderImports(cfg), []*tsimport.ImportPath{
		tsimport.NewEntImportPath("ID"),
	})
	assert.Equal(t, f.TsBuilderType(cfg), "ID[] | null")
	assert.Len(t, info.NodeData.EdgeInfo.FieldEdges, 1)
	assert.True(t, info.NodeData.EdgeInfo.FieldEdges[0].IsList())

	info2 := schema.Nodes["ContactEmail"]
	require.NotNil(t, info2)

	fieldInfo2 := info2.NodeData.FieldInfo

	f2 := fieldInfo2.GetFieldByName("OwnerID")
	require.NotNil(t, f2)

	assert.Equal(t, f2.TsBuilderImports(cfg), []*tsimport.ImportPath{
		tsimport.NewEntImportPath("ID"),
		tsimport.NewLocalEntImportPath("Contact"),
		tsimport.NewEntActionImportPath("Builder"),
		tsimport.NewEntImportPath("Viewer"),
	})
	assert.Equal(t, f2.TsBuilderType(cfg), "ID | Builder<Contact, Viewer>")
	assert.Len(t, info2.NodeData.EdgeInfo.FieldEdges, 1)
	assert.False(t, info2.NodeData.EdgeInfo.FieldEdges[0].IsList())

	edge := info.NodeData.EdgeInfo.GetFieldEdgeByName("contactEmails")
	require.NotNil(t, edge)
	require.Equal(t, edge.GetTSGraphQLTypeImports(), []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLList"),
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewLocalGraphQLEntImportPath(edge.NodeInfo.Node),
	})
}
