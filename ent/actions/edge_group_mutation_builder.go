package actions

import (
	"strings"

	"github.com/lolopinto/ent/ent"
)

type EdgeGroupMutationBuilder struct {
	*EntMutationBuilder
	enumValue string
	idValue   string
	nodeType  ent.NodeType
	statusMap ent.AssocStatusMap
}

func NewEdgeGroupMutationBuilder(
	b *EntMutationBuilder,
	statusMap ent.AssocStatusMap,
	//	opts ...func(*EntMutationBuilder),
) *EdgeGroupMutationBuilder {
	//	b := NewMutationBuilder(viewer, operation, entity, entConfig, opts...)
	return &EdgeGroupMutationBuilder{
		EntMutationBuilder: b,
		statusMap:          statusMap,
	}
}

func (b *EdgeGroupMutationBuilder) SetEnumValue(enumValue string) {
	b.enumValue = enumValue
}

func (b *EdgeGroupMutationBuilder) SetIDValue(idValue string, nodeType ent.NodeType) {
	b.idValue = idValue
	b.nodeType = nodeType
}

func (b *EdgeGroupMutationBuilder) GetChangeset() (ent.Changeset, error) {
	for key, value := range b.statusMap {
		// TODO use enums here with generated types instead of this generated thing with strings
		if !value.UseInStatusAction {
			continue
		}
		if key == strings.ToLower(b.enumValue) {
			b.AddOutboundEdge(value.Edge, b.idValue, b.nodeType)
		} else {
			b.RemoveOutboundEdge(value.Edge, b.idValue, b.nodeType)
		}
	}
	return b.EntMutationBuilder.GetChangeset()
}
