package schema

import "github.com/lolopinto/ent/internal/schema/enum"

type EnumInfo struct {
	Enum    enum.Enum
	GQLEnum enum.GQLEnum
	// if null should be in its own file
	// Enum usually null if using lookup table enums e.g. input.Node.EnumTable == true
	NodeData *NodeData
}
