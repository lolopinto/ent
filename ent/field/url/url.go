package url

import "github.com/lolopinto/ent/ent/field"

type FieldType struct {
	domain string
	field.StringType
}

func (t *FieldType) RestrictToDomain(domain string) *FieldType {
	t.domain = domain
	return t
}

func Field() *FieldType {
	return &FieldType{}
}

var _ field.DataType = &FieldType{}
