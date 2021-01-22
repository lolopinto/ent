package schema

import (
	"github.com/lolopinto/ent/internal/schema/enum"
	"github.com/lolopinto/ent/internal/schema/input"
)

type EnumInfo struct {
	Enum     *enum.Enum
	GQLEnum  *enum.GQLEnum
	NodeData *NodeData
	// InputNode needed to generate columns etc for db columns
	// Presence of this indicates should be in its own file
	// e.g. lookup table enums
	// we only use this as a flag
	InputNode *input.Node
}

func (info *EnumInfo) LookupTableEnum() bool {
	return info.InputNode != nil
}
