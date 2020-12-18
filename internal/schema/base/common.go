package base

import (
	"fmt"
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/schema/input"
)

// common things needed across edges/fields etc
// only allowed to import input
type FieldEdgeInfo struct {
	Config      string
	EdgeName    string
	Polymorphic *PolymorphicOptions
}

type PolymorphicOptions struct {
	*input.PolymorphicOptions
	NodeTypeField string
	Unique        bool // is this a unique field vs say an indexed field
}

func NewFieldEdgeInfo(fieldName string, polymorphic *input.PolymorphicOptions, unique bool) (*FieldEdgeInfo, error) {
	var edgeName string
	if strings.HasSuffix(fieldName, "ID") {
		edgeName = strings.TrimSuffix(fieldName, "ID")
	} else if strings.HasSuffix(fieldName, "_id") {
		edgeName = strings.TrimSuffix(fieldName, "_id")
	} else {
		return nil, fmt.Errorf("invalid field name %s for polymorphic field", fieldName)
	}

	nodeTypeField := strcase.ToLowerCamel(edgeName + "Type")

	return &FieldEdgeInfo{
		EdgeName: edgeName,
		Polymorphic: &PolymorphicOptions{
			polymorphic,
			nodeTypeField,
			unique,
		},
	}, nil
}
