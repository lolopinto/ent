package actions

import (
	"errors"
	"fmt"
	"sync"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/util"
)

// Action will have a changeset. should the mutation builder care about that?
// no, it builds everything and then passes it to
// GetEdges() will
// GenChangeset(wg *sync.WaitGroup) will return soemthing that can be taken from a different action and combined together with this

type EntMutationBuilder struct {
	Viewer         viewer.ViewerContext
	ExistingEntity ent.Entity
	Operation      ent.WriteOperation
	EntConfig      ent.Config
	fields         map[string]interface{}
	edges          []*ent.EdgeOperation
	edgeTypes      map[ent.EdgeType]bool
	placeholderID  string
}

func (b *EntMutationBuilder) SetField(fieldName string, val interface{}) {
	if b.fields == nil {
		b.fields = make(map[string]interface{})
	}
	b.fields[fieldName] = val
}

func (b *EntMutationBuilder) GetPlaceholderID() string {
	if b.placeholderID == "" {
		b.placeholderID = fmt.Sprintf("$ent.idPlaceholder$ %s", util.GenerateRandCode(9))
	}
	return b.placeholderID
}

func (b *EntMutationBuilder) ExistingEnt() ent.Entity {
	return b.ExistingEntity
}

func (b *EntMutationBuilder) addEdgeType(edgeType ent.EdgeType) {
	if b.edgeTypes == nil {
		b.edgeTypes = make(map[ent.EdgeType]bool)
	}
	b.edgeTypes[edgeType] = true
}

func (b *EntMutationBuilder) addEdge(edge *ent.EdgeOperation) {
	b.edges = append(b.edges, edge)
}

func (b *EntMutationBuilder) AddInboundEdge(
	edgeType ent.EdgeType, id1 string, nodeType ent.NodeType, options ...func(*ent.EditedEdgeInfo)) error {

	b.addEdge(
		ent.NewInboundEdge(
			edgeType,
			ent.InsertOperation,
			id1,
			nodeType,
			b,
			options...,
		),
	)
	b.addEdgeType(edgeType)
	return nil
}

func (b *EntMutationBuilder) AddOutboundEdge(edgeType ent.EdgeType, id2 string, nodeType ent.NodeType, options ...func(*ent.EditedEdgeInfo)) error {
	// TODO figure out what I was tryign to do here...
	// for _, edge := range b.edges {
	// 	if edge.EdgeType == edgeType && edge.ID2 == id2 && nodeType == edge.ID2Type {
	// 		// already been added ignore for now
	// 		// the hack in resolver_manual.go in ent-rsvp calls it before this...
	// 		return nil
	// 	}
	// }

	b.addEdge(
		ent.NewOutboundEdge(
			edgeType,
			ent.InsertOperation,
			id2,
			nodeType,
			b,
			options...,
		),
	)
	b.addEdgeType(edgeType)
	return nil
}

func (b *EntMutationBuilder) RemoveInboundEdge(edgeType ent.EdgeType, id1 string, nodeType ent.NodeType) error {
	if b.ExistingEntity == nil {
		return errors.New("invalid cannot remove edge when there's no existing ent")
	}
	b.addEdge(
		ent.NewInboundEdge(
			edgeType,
			ent.DeleteOperation,
			id1,
			nodeType,
			b,
		),
	)
	b.addEdgeType(edgeType)
	return nil
}

func (b *EntMutationBuilder) RemoveOutboundEdge(edgeType ent.EdgeType, id2 string, nodeType ent.NodeType) error {
	if b.ExistingEntity == nil {
		return errors.New("invalid cannot remove edge when there's no existing ent")
	}

	b.addEdge(
		ent.NewOutboundEdge(
			edgeType,
			ent.DeleteOperation,
			id2,
			nodeType,
			b,
		),
	)

	b.addEdgeType(edgeType)
	return nil
}

func (b *EntMutationBuilder) GetChangeset(entity ent.Entity) (ent.Changeset, error) {
	edgeData, err := b.loadEdges()
	if err != nil {
		return nil, err
	}

	var ops []ent.DataOperation
	if b.Operation == ent.DeleteOperation {
		ops = append(ops, &ent.DeleteNodeOperation{
			ExistingEnt: b.ExistingEntity,
			EntConfig:   b.EntConfig,
		})
	} else {
		info := &ent.EditedNodeInfo{
			ExistingEnt:    b.ExistingEntity,
			Entity:         entity,
			EntConfig:      b.EntConfig,
			Fields:         b.fields,
			EditableFields: getFieldMapFromFields(b.fields),
			// TODO this needs to be removed because if we get here it's confirmed good since it's coming from changeset
		}
		ops = append(ops,
			&ent.NodeWithActionMapOperation{
				info,
				b.Operation,
			},
		)
	}
	for _, edge := range b.edges {
		ops = append(ops, edge)
		edgeInfo := edgeData[edge.EdgeType()]

		// symmetric edge. same edge type
		if edgeInfo.SymmetricEdge {
			ops = append(ops, edge.SymmetricEdge())
		}

		// inverse edge
		if edgeInfo.InverseEdgeType != nil && edgeInfo.InverseEdgeType.Valid {
			ops = append(ops, edge.InverseEdge(
				ent.EdgeType(edgeInfo.InverseEdgeType.String),
			))
		}
	}
	executor := ent.NewMutationExecutor(b.GetPlaceholderID(), ops)
	return &EntMutationChangeset{
		executor:      executor,
		placeholderId: b.GetPlaceholderID(),
		existingEnt:   b.ExistingEntity,
		entConfig:     b.EntConfig,
	}, nil
}

func (b *EntMutationBuilder) loadEdges() (map[ent.EdgeType]*ent.AssocEdgeData, error) {
	if b.edgeTypes == nil {
		return nil, nil
	}

	var wg sync.WaitGroup
	// TODO we need concurrent versions of this API
	// a multi-get version of the API
	// this is too hard.
	wg.Add(len(b.edgeTypes))
	edges := make(map[ent.EdgeType]*ent.AssocEdgeData)
	var errs []error
	for edgeType := range b.edgeTypes {
		edgeType := edgeType
		f := func(edgeType ent.EdgeType) {
			defer wg.Done()
			edge, err := ent.GetEdgeInfo(edgeType, nil)
			if err != nil {
				errs = append(errs, err)
			}
			edges[edgeType] = edge
		}
		go f(edgeType)
	}
	wg.Wait()

	if len(errs) != 0 {
		// TODO return more than one. we need an errSlice that's an error
		// maybe use same logic in privacy API to store PrivacyErrors that are expected but we don't wanna discard or treat as the main error
		return nil, errs[0]
	}

	return edges, nil
}

type EntMutationChangeset struct {
	executor      ent.Executor
	fields        map[string]interface{}
	placeholderId string
	existingEnt   ent.Entity
	entConfig     ent.Config
}

func (c *EntMutationChangeset) GetExecutor() ent.Executor {
	return c.executor
}

func (c *EntMutationChangeset) GetPlaceholderID() string {
	return c.placeholderId
}

func (c *EntMutationChangeset) ExistingEnt() ent.Entity {
	return c.existingEnt
}

func (c *EntMutationChangeset) EntConfig() ent.Config {
	return c.entConfig
}

func getFieldMapFromFields(fields map[string]interface{}) ent.ActionFieldMap {
	// copied from getFieldMapFromFields in ent_test
	ret := make(ent.ActionFieldMap)
	for k := range fields {
		ret[k] = &ent.MutatingFieldInfo{
			DB:       strcase.ToSnake(k),
			Required: true,
		}
	}
	return ret
}
