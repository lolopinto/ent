package actions

import (
	"errors"
	"sync"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
)

type MutationBuilder interface {
	// TODO this needs to be aware of validators
	// triggers and observers
	// observers need to be added to the changeset
	// critical observers need to be added to the changeset
	// regular observers done later

	// placeholder id to be used by fields/values in the mutation and replaced after we have a created ent
	//	GetPlaceholderID() string
	//GetOperation() ent.WriteOperation // TODO Create|Edit|Delete as top level mutations not actions
	Entity() ent.Entity // expected to be null for create operations. entity being mutated
	GetChangeset() (ent.Changeset, error)
}

// Action will have a changeset. should the mutation builder care about that?
// no, it builds everything and then passes it to
// GetEdges() will
// GenChangeset(wg *sync.WaitGroup) will return soemthing that can be taken from a different action and combined together with this

type EntMutationBuilder struct {
	Viewer      viewer.ViewerContext
	ExistingEnt ent.Entity
	Operation   ent.WriteOperation
	EntConfig   ent.Config
	fields      map[string]interface{}
	edges       []*ent.EdgeOperation
	edgeTypes   map[ent.EdgeType]bool
}

func (b *EntMutationBuilder) SetField(fieldName string, val interface{}) {
	if b.fields == nil {
		b.fields = make(map[string]interface{})
	}
	b.fields[fieldName] = val
}

func (b *EntMutationBuilder) getPartialEdgeOp(
	edgeType ent.EdgeType, op ent.WriteOperation, options ...func(*ent.EditedEdgeInfo)) *ent.EdgeOperation {
	info := &ent.EditedEdgeInfo{}
	for _, opt := range options {
		opt(info)
	}
	// TODO kill EditedEdgeInfo. too many things...

	edgeOp := &ent.EdgeOperation{
		EdgeType:  edgeType,
		Operation: op,
		Time:      info.Time,
		Data:      info.Data,
	}
	return edgeOp
}

// TODO...
const idPlaceHolder = "$ent.idPlaceholder$"

func (b *EntMutationBuilder) addEdgeType(edgeType ent.EdgeType) {
	if b.edgeTypes == nil {
		b.edgeTypes = make(map[ent.EdgeType]bool)
	}
	b.edgeTypes[edgeType] = true
}

func (b *EntMutationBuilder) addEdge(edge *ent.EdgeOperation) {
	b.edges = append(b.edges, edge)
}

func (b *EntMutationBuilder) AddInboundEdge(edgeType ent.EdgeType, id1 string, nodeType ent.NodeType, options ...func(*ent.EditedEdgeInfo)) error {
	edgeOp := b.getPartialEdgeOp(edgeType, ent.InsertOperation, options...)
	edgeOp.ID1 = id1
	edgeOp.ID1Type = nodeType
	if b.ExistingEnt == nil {
		edgeOp.ID2 = idPlaceHolder
	} else {
		edgeOp.ID2 = b.ExistingEnt.GetID()
		edgeOp.ID2Type = b.ExistingEnt.GetType()
	}

	b.addEdge(edgeOp)
	b.addEdgeType(edgeType)
	return nil
}

func (b *EntMutationBuilder) AddOutboundEdge(edgeType ent.EdgeType, id2 string, nodeType ent.NodeType, options ...func(*ent.EditedEdgeInfo)) error {
	for _, edge := range b.edges {
		if edge.EdgeType == edgeType && edge.ID2 == id2 && nodeType == edge.ID2Type {
			// already been added ignore for now
			// the hack in resolver_manual.go in ent-rsvp calls it before this...
			return nil
		}
	}

	edgeOp := b.getPartialEdgeOp(edgeType, ent.InsertOperation, options...)
	edgeOp.ID2 = id2
	edgeOp.ID2Type = nodeType
	if b.ExistingEnt == nil {
		edgeOp.ID1 = idPlaceHolder
	} else {
		edgeOp.ID1 = b.ExistingEnt.GetID()
		edgeOp.ID1Type = b.ExistingEnt.GetType()
	}
	b.addEdgeType(edgeType)
	b.addEdge(edgeOp)
	return nil
}

func (b *EntMutationBuilder) RemoveInboundEdge(edgeType ent.EdgeType, id1 string, nodeType ent.NodeType) error {
	if b.ExistingEnt == nil {
		return errors.New("invalid cannot remove edge when there's no existing ent")
	}
	edgeOp := b.getPartialEdgeOp(edgeType, ent.DeleteOperation)
	edgeOp.ID1 = id1
	edgeOp.ID1Type = nodeType
	edgeOp.ID2 = b.ExistingEnt.GetID()
	edgeOp.ID2Type = b.ExistingEnt.GetType()

	b.addEdgeType(edgeType)
	b.addEdge(edgeOp)
	return nil
}

func (b *EntMutationBuilder) RemoveOutboundEdge(edgeType ent.EdgeType, id2 string, nodeType ent.NodeType) error {
	if b.ExistingEnt == nil {
		return errors.New("invalid cannot remove edge when there's no existing ent")
	}

	edgeOp := b.getPartialEdgeOp(edgeType, ent.DeleteOperation)
	edgeOp.ID2 = id2
	edgeOp.ID2Type = nodeType
	edgeOp.ID1 = b.ExistingEnt.GetID()
	edgeOp.ID1Type = b.ExistingEnt.GetType()

	b.addEdgeType(edgeType)
	b.addEdge(edgeOp)
	return nil
}

func (b *EntMutationBuilder) GetChangeset() (ent.Changeset, error) {
	edgeData, err := b.loadEdges()
	if err != nil {
		return nil, err
	}

	var newEdges []*ent.EdgeOperation
	for _, edge := range b.edges {
		edgeInfo := edgeData[edge.EdgeType]
		if edgeInfo.SymmetricEdge ||
			(edgeInfo.InverseEdgeType != nil && edgeInfo.InverseEdgeType.Valid) {
			edgeOp := &ent.EdgeOperation{
				Operation: edge.Operation,
				Time:      edge.Time,
				Data:      edge.Data,
				ID1:       edge.ID2,
				ID1Type:   edge.ID2Type,
				ID2:       edge.ID1,
				ID2Type:   edge.ID1Type,
			}
			// symmetric edge. same edge type
			if edgeInfo.SymmetricEdge {
				edgeOp.EdgeType = edge.EdgeType
			} else {
				// inverse edge
				edgeOp.EdgeType = ent.EdgeType(edgeInfo.InverseEdgeType.String)
			}

			newEdges = append(newEdges, edgeOp)
		}
	}
	return &EntMutationChangeset{
		edges:         append(b.edges, newEdges...),
		fields:        b.fields,
		placeholderId: idPlaceHolder,
		operation:     b.Operation,
		existingEnt:   b.ExistingEnt,
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
	edges         []*ent.EdgeOperation
	fields        map[string]interface{}
	placeholderId string
	operation     ent.WriteOperation
	existingEnt   ent.Entity
	entConfig     ent.Config
}

func (c *EntMutationChangeset) GetEdges() []*ent.EdgeOperation {
	return c.edges
}

func (c *EntMutationChangeset) GetFields() map[string]interface{} {
	return c.fields
}

func (c *EntMutationChangeset) GetPlaceholderID() string {
	return c.placeholderId
}

func (c *EntMutationChangeset) GetOperation() ent.WriteOperation {
	return c.operation
}

func (c *EntMutationChangeset) ExistingEnt() ent.Entity {
	return c.existingEnt
}

func (c *EntMutationChangeset) EntConfig() ent.Config {
	return c.entConfig
}
