package field

import (
	"fmt"

	"github.com/lolopinto/ent/internal/codegen/codegenapi"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/names"
	"github.com/lolopinto/ent/internal/tsimport"
)

type NonEntField struct {
	// note that if this changes, need to update NonEntFieldEqual
	fieldName   string
	graphqlName string
	fieldType   enttype.TSType
	nullable    bool // required default = true
	optional    bool
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
		graphqlName:     names.ToGraphQLName(cfg, fieldName),
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

func (f *NonEntField) SetOptional(optional bool) *NonEntField {
	f.optional = optional
	return f
}

func (f *NonEntField) GetFieldName() string {
	return f.fieldName
}

func (f *NonEntField) Required() bool {
	if f.nullable || f.optional {
		return false
	}
	return true
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

func (f *NonEntField) GetGraphQLMutationFieldType(forceOptional bool) enttype.TSType {
	t2, ok := f.fieldType.(enttype.NullableType)
	if forceOptional && ok {
		return t2.GetNullableType()
	}
	return f.fieldType
}

func (f *NonEntField) TsFieldName(cfg codegenapi.Config) string {
	return names.ToTsFieldName(f.fieldName)
}

func (f *NonEntField) TsBuilderFieldName() string {
	return names.ToTsFieldName(f.fieldName)
}

func (f *NonEntField) TSPublicAPIName() string {
	return names.ToTsFieldName(f.fieldName)
}

func (f *NonEntField) ForceRequiredInAction() bool {
	return f.Required()
}

func (f *NonEntField) ForceOptionalInAction() bool {
	return f.optional
}

func (f *NonEntField) DefaultToViewerOnCreate() bool {
	return false
}

func (f *NonEntField) DefaultValue() *string {
	return nil
}

func (f *NonEntField) Nullable() bool {
	return f.nullable
}

func (f *NonEntField) Optional() bool {
	return f.optional
}

func (f *NonEntField) ExposeToGraphQL() bool {
	return !f.hideFromGraphQL
}

func (f *NonEntField) HasDefaultValueOnCreate() bool {
	return false
}

func (f *NonEntField) IsEditableIDField(ctx EditableContext) bool {
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

func (f *NonEntField) GetTSGraphQLTypeForFieldImports(input bool) []*tsimport.ImportPath {
	return f.fieldType.GetTSGraphQLImports(input)
}

func (f *NonEntField) SingleFieldPrimaryKey() bool {
	return false
}

type NonEntFieldOption func(*NonEntField)

func OptionalField() NonEntFieldOption {
	return func(f *NonEntField) {
		f.optional = true
		f.nullable = true
	}
}

func (f *NonEntField) Clone(opts ...NonEntFieldOption) (*NonEntField, error) {
	ret := &NonEntField{
		fieldName:       f.fieldName,
		graphqlName:     f.graphqlName,
		fieldType:       f.fieldType,
		nullable:        f.nullable,
		optional:        f.optional,
		Flag:            f.Flag,
		NodeType:        f.NodeType,
		hideFromGraphQL: f.hideFromGraphQL,
	}

	for _, opt := range opts {
		opt(ret)
	}

	if ret.nullable && ret.nullable != f.nullable {
		nullableType, ok := ret.fieldType.(enttype.NullableType)
		if !ok {
			return nil, fmt.Errorf("can't make non-nullable field %s nullable", ret.fieldName)
		}
		ret.fieldType = nullableType.GetNullableType()
	}

	return ret, nil
}
