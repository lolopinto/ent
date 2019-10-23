package actions

import (
	"errors"
	"fmt"
	"sync"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/util"
)

type EntMutationBuilder struct {
	Viewer         viewer.ViewerContext
	ExistingEntity ent.Entity
	Operation      ent.WriteOperation
	EntConfig      ent.Config
	// for now, actions map to all the fields so it's fine. this will need to be changed when each EntMutationBuilder is generated
	// At that point, probably makes sense to have each generated Builder handle this.
	FieldMap      ent.MutationFieldMap
	fields        map[string]interface{}
	rawDBFields   map[string]interface{}
	edges         []*ent.EdgeOperation
	edgeTypes     map[ent.EdgeType]bool
	placeholderID string
	validated     bool
}

func (b *EntMutationBuilder) flagWrite() {
	b.validated = false
}

func (b *EntMutationBuilder) SetField(fieldName string, val interface{}) {
	if b.fields == nil {
		b.fields = make(map[string]interface{})
	}
	b.fields[fieldName] = val
	b.flagWrite()
}

func (b *EntMutationBuilder) GetPlaceholderID() string {
	if b.placeholderID == "" {
		b.placeholderID = fmt.Sprintf("$ent.idPlaceholder$ %s", util.GenerateRandCode(9))
	}
	return b.placeholderID
}

func (b *EntMutationBuilder) GetViewer() viewer.ViewerContext {
	return b.Viewer
}

func (b *EntMutationBuilder) ExistingEnt() ent.Entity {
	return b.ExistingEntity
}

func (b *EntMutationBuilder) GetOperation() ent.WriteOperation {
	return b.Operation
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
	b.flagWrite()

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
	// TODO figure out what I was trying to do here...
	// for _, edge := range b.edges {
	// 	if edge.EdgeType == edgeType && edge.ID2 == id2 && nodeType == edge.ID2Type {
	// 		// already been added ignore for now
	// 		// the hack in resolver_manual.go in ent-rsvp calls it before this...
	// 		return nil
	// 	}
	// }
	b.flagWrite()
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
	b.flagWrite()
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
	b.flagWrite()
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
	// should not be able to get a changeset for an invlid builder
	if !b.validated {
		if err := b.Validate(); err != nil {
			return nil, err
		}
	}
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
		// take the fields and convert to db format!
		fields := make(map[string]interface{})
		for fieldName, value := range b.fields {
			fieldInfo, ok := b.FieldMap[fieldName]
			if !ok {
				return nil, fmt.Errorf("invalid field %s passed ", fieldName)
			}
			fields[fieldInfo.DB] = value
		}
		ops = append(ops,
			&ent.EditNodeOperation{
				ExistingEnt: b.ExistingEntity,
				Entity:      entity,
				EntConfig:   b.EntConfig,
				Fields:      fields,
				Operation:   b.Operation,
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
	return &EntMutationChangeset{
		entity: entity,
		viewer: b.Viewer,
		executor: &EntMutationExecutor{
			placeholderId: b.GetPlaceholderID(),
			ops:           ops,
		},
		placeholderID: b.GetPlaceholderID(),
		existingEnt:   b.ExistingEntity,
		entConfig:     b.EntConfig,
	}, nil
}

func (b *EntMutationBuilder) Validate() error {
	if b.validated {
		return nil
	}
	if b.FieldMap == nil && b.fields != nil {
		return errors.New("MutationBuilder has no fieldMap")
	}
	var errors []*ent.ActionErrorInfo

	for fieldName, item := range b.FieldMap {
		_, ok := b.fields[fieldName]

		// won't work because we have the wrong names in the setters right now
		if item.Required && !ok {
			errors = append(errors, &ent.ActionErrorInfo{
				ErrorMsg: fmt.Sprintf("%s is required and was not set", fieldName),
			})
		}
	}

	if len(errors) == 0 {
		b.validated = true
		return nil
	}
	return &ent.ActionValidationError{
		Errors:     errors,
		ActionName: "TODO",
	}
}

// TODO kill this eventually
func (b *EntMutationBuilder) GetFields() map[string]interface{} {
	return b.fields
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
