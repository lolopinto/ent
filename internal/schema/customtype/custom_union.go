package customtype

import (
	"fmt"
	"strings"

	"github.com/lolopinto/ent/internal/schema/enum"
)

type CustomUnion struct {
	TSType     string
	GQLName    string
	Interfaces []*CustomInterface
}

func (cu *CustomUnion) GetTSType() string {
	return cu.TSType
}

func (cu *CustomUnion) GetGraphQLName() string {
	return cu.GQLName
}

func (cu *CustomUnion) GetGraphQLType() string {
	return cu.GQLName + "Type"
}

func (cu *CustomUnion) IsCustomInterface() bool {
	return false
}

func (cu *CustomUnion) IsCustomUnion() bool {
	return true
}

func (cu *CustomUnion) GetTypeDeclaration() (string, error) {
	if len(cu.Interfaces) == 0 {
		return "", fmt.Errorf("need at least one type in union %s", cu.TSType)
	}
	types := make([]string, len(cu.Interfaces))
	for idx, ci := range cu.Interfaces {
		types[idx] = ci.TSType
	}

	return fmt.Sprintf("export type %s = %s", cu.TSType, strings.Join(types, " | ")), nil
}

func (cu *CustomUnion) GetTSTypes() []string {
	types := []string{cu.TSType}
	for _, ci := range cu.Interfaces {
		types = append(types, ci.GetTSTypes()...)
	}

	return types
}

func (ci *CustomUnion) GetAllEnums() []*enum.Enum {
	ret := []*enum.Enum{}
	for _, child := range ci.Interfaces {
		ret = append(ret, child.GetAllEnums()...)
	}
	return ret
}

func (cu *CustomUnion) GetAllCustomTypes() []CustomType {
	var ret []CustomType

	for _, child := range cu.Interfaces {
		ret = append(ret, child.GetAllCustomTypes()...)
	}

	// put self last
	ret = append(ret, cu)

	return ret
}
