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
	entity         ent.Entity
	Operation      ent.WriteOperation
	EntConfig      ent.Config
	// for now, actions map to all the fields so it's fine. this will need to be changed when each EntMutationBuilder is generated
	// At that point, probably makes sense to have each generated Builder handle this.
	FieldMap ent.ActionFieldMap
	fields   map[string]interface{}
	//	rawDBFields   map[string]interface{}
	edges         []*ent.EdgeOperation
	edgeTypes     map[ent.EdgeType]bool
	placeholderID string
	validated     bool
	triggers      []Trigger
	mu            sync.RWMutex
	// what happens if there are circular dependencies?
	// let's assume not possible for now but it's possible we want to store the ID in different places/
	dependencies ent.MutationBuilderMap
	changesets   []ent.Changeset
}

func ExistingEnt(existingEnt ent.Entity) func(*EntMutationBuilder) {
	return func(mb *EntMutationBuilder) {
		// TODO lowercase
		mb.ExistingEntity = existingEnt
	}
}

func NewMutationBuilder(
	viewer viewer.ViewerContext,
	operation ent.WriteOperation,
	entity ent.Entity,
	entConfig ent.Config,
	opts ...func(*EntMutationBuilder),
) *EntMutationBuilder {
	b := &EntMutationBuilder{
		Viewer:    viewer,
		Operation: operation,
		EntConfig: entConfig,
		entity:    entity,
	}
	for _, opt := range opts {
		opt(b)
	}
	// TODO init other things
	b.placeholderID = fmt.Sprintf("$ent.idPlaceholder$ %s", util.GenerateRandCode(9))
	return b
}

func (b *EntMutationBuilder) flagWrite() {
	b.validated = false
}

func (b *EntMutationBuilder) resolveFieldValue(fieldName string, val interface{}) interface{} {
	// this is a tricky method. should only be called by places that have a Lock()/Unlock protection in it.
	// Right now that's done by SetField()
	builder, ok := val.(ent.MutationBuilder)
	if !ok {
		return val
	}
	if b.dependencies == nil {
		b.dependencies = make(ent.MutationBuilderMap)
	}
	b.dependencies[builder.GetPlaceholderID()] = builder
	return val
}

func (b *EntMutationBuilder) SetField(fieldName string, val interface{}) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.fields == nil {
		b.fields = make(map[string]interface{})
	}
	b.fields[fieldName] = b.resolveFieldValue(fieldName, val)
	b.flagWrite()
}

func (b *EntMutationBuilder) GetPlaceholderID() string {
	return b.placeholderID
}

func (b *EntMutationBuilder) GetViewer() viewer.ViewerContext {
	return b.Viewer
}

func (b *EntMutationBuilder) ExistingEnt() ent.Entity {
	return b.ExistingEntity
}

func (b *EntMutationBuilder) Entity() ent.Entity {
	return b.entity
}

func (b *EntMutationBuilder) GetOperation() ent.WriteOperation {
	return b.Operation
}

func (b *EntMutationBuilder) addEdge(edge *ent.EdgeOperation) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.flagWrite()
	b.edges = append(b.edges, edge)
	if b.edgeTypes == nil {
		b.edgeTypes = make(map[ent.EdgeType]bool)
	}
	b.edgeTypes[edge.EdgeType()] = true
}

func (b *EntMutationBuilder) AddInboundEdge(
	edgeType ent.EdgeType, id1 interface{}, nodeType ent.NodeType, options ...func(*ent.EdgeOperation)) error {
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
	return nil
}

func (b *EntMutationBuilder) AddOutboundEdge(edgeType ent.EdgeType, id2 interface{}, nodeType ent.NodeType, options ...func(*ent.EdgeOperation)) error {
	// TODO figure out what I was trying to do here...
	// for _, edge := range b.edges {
	// 	if edge.EdgeType == edgeType && edge.ID2 == id2 && nodeType == edge.ID2Type {
	// 		// already been added ignore for now
	// 		// the hack in resolver_manual.go in ent-rsvp calls it before this...
	// 		return nil
	// 	}
	// }
	// we need to keep track of mutation_builder
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

	return nil
}

func (b *EntMutationBuilder) SetTriggers(triggers []Trigger) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.triggers = triggers
}

func (b *EntMutationBuilder) runTriggers() error {
	// nothing to do here
	if len(b.triggers) == 0 {
		return nil
	}

	var fns []func() (ent.Changeset, error)
	for _, trigger := range b.triggers {
		fns = append(fns, trigger.GetChangeset)
	}

	changesets, err := runChangesets(fns...)
	if err != nil {
		return err
	}

	if len(changesets) != 0 {
		b.mu.Lock()
		defer b.mu.Unlock()
		b.changesets = changesets
	}
	return nil
}

func (b *EntMutationBuilder) GetChangeset() (ent.Changeset, error) {
	if err := b.runTriggers(); err != nil {
		return nil, err
	}

	// should not be able to get a changeset for an invalid builder
	if !b.validated {
		// soulds like validate() needs to call runTriggers also...
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
		var fieldsWithResolvers []string
		for fieldName, value := range b.fields {
			fieldInfo, ok := b.FieldMap[fieldName]
			if !ok {
				return nil, fmt.Errorf("invalid field %s passed ", fieldName)
			}
			builder, ok := value.(ent.MutationBuilder)

			fields[fieldInfo.DB] = value
			if ok {
				fields[fieldInfo.DB] = builder.GetPlaceholderID()
				fieldsWithResolvers = append(fieldsWithResolvers, fieldInfo.DB)
			}
		}
		// only worth doing it if there are fields
		// TODO shouldn't do a write if len(fields) == 0
		// need to change the code to always load the user after the write tho...
		ops = append(ops,
			&ent.EditNodeOperation{
				ExistingEnt:         b.ExistingEntity,
				Entity:              b.entity,
				EntConfig:           b.EntConfig,
				Fields:              fields,
				FieldsWithResolvers: fieldsWithResolvers,
				Operation:           b.Operation,
			},
		)
	}

	edges := b.edges
	for _, edge := range edges {
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

	if len(ops) == 0 {
		return nil, nil
	}

	// let's figure out craziness here
	return &EntMutationChangeset{
		entity:        b.entity,
		viewer:        b.Viewer,
		ops:           ops,
		placeholderID: b.GetPlaceholderID(),
		existingEnt:   b.ExistingEntity,
		entConfig:     b.EntConfig,
		dependencies:  b.dependencies,
		changesets:    b.changesets,
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
	var m sync.Mutex
	edges := make(map[ent.EdgeType]*ent.AssocEdgeData)
	var errs []error
	for edgeType := range b.edgeTypes {
		edgeType := edgeType
		f := func(edgeType ent.EdgeType) {
			defer wg.Done()
			edge, err := ent.GetEdgeInfo(edgeType, nil)
			m.Lock()
			defer m.Unlock()
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
