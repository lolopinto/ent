package field

import (
	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/enttype"
)

type NonEntField struct {
	// note that if this changes, need to update NonEntFieldEqual
	FieldName string
	FieldType enttype.TSGraphQLType
	nullable  bool // required default = true
	// TODO these are both go things. ignore
	// Flag enum or ID
	Flag string
	// this is a go-thing. ignore for TypeScript
	NodeType string
}

func NewNonEntField(fieldName string, fieldType enttype.TSGraphQLType, nullable bool) *NonEntField {
	return &NonEntField{
		FieldName: fieldName,
		FieldType: fieldType,
		nullable:  nullable,
	}
}

func (f *NonEntField) Required() bool {
	return !f.nullable
}

func (f *NonEntField) GetGraphQLName() string {
	return strcase.ToLowerCamel(f.FieldName)
}

// don't have to deal with all the id field stuff field.Field has to deal with
func (f *NonEntField) GetTsType() string {
	return f.FieldType.GetTSType()
}

func (f *NonEntField) GetFieldType() enttype.EntType {
	return f.FieldType
}

func (f *NonEntField) TsFieldName() string {
	return strcase.ToLowerCamel(f.FieldName)
}

func (f *NonEntField) ForceRequiredInAction() bool {
	return !f.nullable
}

func (f *NonEntField) ForceOptionalInAction() bool {
	return false
}

func (f *NonEntField) DefaultValue() interface{} {
	return nil
}

func (f *NonEntField) Nullable() bool {
	return f.nullable
}

func (f *NonEntField) HasDefaultValueOnCreate() bool {
	return false
}
