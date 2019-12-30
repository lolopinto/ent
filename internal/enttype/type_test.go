package enttype

import "go/types"

func (f *fieldWithActualType) GetActualType() types.Type {
	return f.actualType
}
