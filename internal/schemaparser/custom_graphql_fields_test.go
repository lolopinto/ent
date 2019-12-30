package schemaparser

import "go/types"

func (f *Field) GetGoType() types.Type {
	return f.goType
}
