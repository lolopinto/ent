package field

import (
	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/tsimport"
)

type NonEntField struct {
	// note that if this changes, need to update NonEntFieldEqual
	fieldName   string
	graphqlName string
	fieldType   enttype.TSType
	nullable    bool // required default = true
	// TODO these are both go things. ignore
	// Flag enum or ID
	Flag string
	// this is a go-thing. ignore for TypeScript
	NodeType        string
	hideFromGraphQL bool
}

func NewNonEntField(cfg codegenapi.Config, fieldName string, fieldType enttype.TSType, nullable, hideFromGraphQL bool) *NonEntField {
	return &NonEntField{
		fieldName:       fieldName,
		graphqlName:     codegenapi.GraphQLName(cfg, fieldName),
		fieldType:       fieldType,
		nullable:        nullable,
		hideFromGraphQL: hideFromGraphQL,
	}
}

func (f *NonEntField) SetFlag(flag string) *NonEntField {
	f.Flag = flag
	return f
}

func (f *NonEntField) SetNodeType(nodeType string) *NonEntField {
	f.NodeType = nodeType
	return f
}

func (f *NonEntField) GetFieldName() string {
	return f.fieldName
}

func (f *NonEntField) Required() bool {
	return !f.nullable
}

func (f *NonEntField) GetGraphQLName() string {
	return f.graphqlName
}

// don't have to deal with all the id field stuff field.Field has to deal with
func (f *NonEntField) GetTsType() string {
	return f.fieldType.GetTSType()
}

func (f *NonEntField) TsBuilderType(cfg codegenapi.Config) string {
	return f.fieldType.GetTSType()
}

func (f *NonEntField) GetFieldType() enttype.Type {
	return f.fieldType
}

func (f *NonEntField) GetGraphQLFieldType() enttype.TSType {
	return f.fieldType
}

func (f *NonEntField) TsFieldName(cfg codegenapi.Config) string {
	return strcase.ToLowerCamel(f.fieldName)
}

func (f *NonEntField) TsBuilderFieldName() string {
	return strcase.ToLowerCamel(f.fieldName)
}

func (f *NonEntField) TSPublicAPIName() string {
	return strcase.ToLowerCamel(f.fieldName)
}

func (f *NonEntField) ForceRequiredInAction() bool {
	return !f.nullable
}

func (f *NonEntField) ForceOptionalInAction() bool {
	return false
}

func (f *NonEntField) DefaultValue() *string {
	return nil
}

func (f *NonEntField) Nullable() bool {
	return f.nullable
}

func (f *NonEntField) ExposeToGraphQL() bool {
	return !f.hideFromGraphQL
}

func (f *NonEntField) HasDefaultValueOnCreate() bool {
	return false
}

func (f *NonEntField) IsEditableIDField() bool {
	return enttype.IsIDType(f.fieldType)
}

func (f *NonEntField) GetTsTypeImports() []*tsimport.ImportPath {
	ret := []*tsimport.ImportPath{}
	// field type requires imports. assumes it has been reserved separately
	typ, ok := f.fieldType.(enttype.TSTypeWithImports)
	if ok {
		ret = typ.GetTsTypeImports()
	}

	return ret
}
