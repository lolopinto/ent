package enttype

import "go/types"

func (f *fieldWithActualType) GetActualType() types.Type {
	return f.actualType
}

func newFieldWithActualType(typ types.Type, forceNullable, forceNonNullable bool) *fieldWithActualType {
	return &fieldWithActualType{
		actualType:       typ,
		forceNullable:    forceNullable,
		forceNonNullable: forceNonNullable,
	}
}

func NewNamedType(typ types.Type, forceNullable, forceNonNullable bool) *NamedType {
	return &NamedType{
		fieldWithActualType{
			actualType:       typ,
			forceNullable:    forceNullable,
			forceNonNullable: forceNonNullable,
		},
	}
}

func NewPointerType(typ types.Type, forceNullable, forceNonNullable bool) *PointerType {
	ptrType := typ.(*types.Pointer)
	return &PointerType{
		ptrType,
		fieldWithActualType{
			actualType:       typ,
			forceNullable:    forceNullable,
			forceNonNullable: forceNonNullable,
		},
	}
}
