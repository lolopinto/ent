package customtype

type CustomUnion struct {
	TSType     string
	GQLType    string
	Interfaces []*CustomInterface
}
