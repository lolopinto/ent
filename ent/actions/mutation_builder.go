package actions

import (
	"errors"
	"fmt"
	"sync"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/syncerr"
	"github.com/lolopinto/ent/internal/util"
)

// fields in generated builder not in actions
// bug in in having it in actions now because if we set something in actions that's not there, there'll be an issue
type EntMutationBuilder struct {
	Viewer          viewer.ViewerContext
	ExistingEntity  ent.Entity
	entity          ent.Entity
	Operation       ent.WriteOperation
	EntConfig       ent.Config
	buildFieldsFn   func() ent.ActionFieldMap
	rawDBFields     map[string]interface{}
	validatedFields map[string]interface{}
	edges           []*ent.EdgeOperation
	edgeTypes       map[ent.EdgeType]bool
	placeholderID   string
	validated       bool
	triggers        []Trigger
	observers       []Observer
	mu              sync.RWMutex
	// what happens if there are circular dependencies?
	// let's assume not possible for now but it's possible we want to store the ID in different places/
	fieldsWithResolvers []string
	dependencies        ent.MutationBuilderMap
	changesets          []ent.Changeset
}

func ExistingEnt(existingEnt ent.Entity) func(*EntMutationBuilder) {
	return func(mb *EntMutationBuilder) {
		// TODO lowercase
		mb.ExistingEntity = existingEnt
	}
}

func BuildFields(buildFieldsFn func() ent.ActionFieldMap) func(*EntMutationBuilder) {
	return func(mb *EntMutationBuilder) {
		mb.buildFieldsFn = buildFieldsFn
	}
}

func NewMutationBuilder(
	v viewer.ViewerContext,
	operation ent.WriteOperation,
	entity ent.Entity,
	entConfig ent.Config,
	opts ...func(*EntMutationBuilder),
) *EntMutationBuilder {
	b := &EntMutationBuilder{
		Viewer:    v,
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
	// changing things up and seeing if putting this lock in here breaks things....
	builder, ok := val.(ent.MutationBuilder)
	if !ok {
		return val
	}
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.dependencies == nil {
		b.dependencies = make(ent.MutationBuilderMap)
	}
	b.dependencies[builder.GetPlaceholderID()] = builder
	b.fieldsWithResolvers = append(b.fieldsWithResolvers, fieldName)
	return builder.GetPlaceholderID()
}

func (b *EntMutationBuilder) processRawFields() map[string]interface{} {
	fields := make(map[string]interface{})
	for dbKey, value := range b.rawDBFields {
		fields[dbKey] = b.resolveFieldValue(dbKey, value)
	}
	return fields
}

func (b *EntMutationBuilder) SetRawFields(m map[string]interface{}) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.rawDBFields = m
}

func (b *EntMutationBuilder) OverrideRawField(key string, val interface{}) {
	if b.rawDBFields == nil {
		panic("cannot call OverideRawField without having already previouslyset it")
	}
	b.mu.Lock()
	defer b.mu.Unlock()

	b.rawDBFields[key] = val
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

func (b *EntMutationBuilder) SetObservers(observers []Observer) {
	// TODO this is where we'd handle critical observers...
	// we'd also need to batch all the critical observers to be run at the end of all the other operations that are built on top of each other....
	b.mu.Lock()
	defer b.mu.Unlock()
	b.observers = observers
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

		// get all the observers from all the dependent changesets and keep track of them to be run at the end...
		for _, c := range changesets {
			cWithObservers, ok := c.(ChangesetWithObservers)
			if ok {
				b.observers = append(b.observers, cWithObservers.Observers()...)
			}
		}
		b.changesets = changesets
	}
	return nil
}

func (b *EntMutationBuilder) GetChangeset() (ent.Changeset, error) {
	// should not be able to get a changeset for an invalid builder
	if !b.validated {
		if err := b.validate(); err != nil {
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
		// TODO how do we format placeholders??

		// only worth doing it if there are fields
		// TODO shouldn't do a write if len(fields) == 0
		// need to change the code to always load the user after the write tho...
		ops = append(ops,
			&ent.EditNodeOperation{
				ExistingEnt:         b.ExistingEntity,
				Entity:              b.entity,
				EntConfig:           b.EntConfig,
				Fields:              b.validatedFields,
				FieldsWithResolvers: b.fieldsWithResolvers,
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
		observers:     b.observers,
	}, nil
}

func (b *EntMutationBuilder) validateFieldInfos() (ent.ActionFieldMap, error) {
	if b.buildFieldsFn == nil {
		return nil, nil
	}

	// gather fieldInfos, validate as needed and then return
	fieldInfos := b.buildFieldsFn()
	for fieldName, fieldInfo := range fieldInfos {
		if err := fieldInfo.Field.Valid(fieldName, fieldInfo.Value); err != nil {
			return nil, err
		}
	}
	return fieldInfos, nil
}

// this is just done before writing
func (b *EntMutationBuilder) formatFieldInfos(fieldInfos ent.ActionFieldMap) (map[string]interface{}, error) {
	fields := make(map[string]interface{})

	// this is also where default values will be set eventually
	for fieldName, fieldInfo := range fieldInfos {
		dbKey := fieldInfo.Field.DBKey(fieldName)

		val, err := fieldInfo.Field.Format(fieldInfo.Value)
		if err != nil {
			return nil, err
		}
		fields[dbKey] = b.resolveFieldValue(dbKey, val)
	}
	return fields, nil
}

func (b *EntMutationBuilder) validate() error {
	// move from here to just before format into Validate()?
	if err := b.runTriggers(); err != nil {
		return err
	}

	// this is the gather fields method function
	// we validate (if needed)
	// run any extra validators
	// tranform and save as needed

	fieldInfos, err := b.validateFieldInfos()
	if err != nil {
		return err
	}

	// TODO more validators run here

	var fields map[string]interface{}
	if fieldInfos != nil {
		fields, err = b.formatFieldInfos(fieldInfos)
		if err != nil {
			return err
		}
	} else if b.rawDBFields != nil {
		fields = b.processRawFields()
	}
	b.validatedFields = fields

	return nil
}

func (b *EntMutationBuilder) Validate() error {
	// already validated
	if b.validated {
		return nil
	}

	err := b.validate()
	if err == nil {
		b.validated = true
	}
	return err
}

func (b *EntMutationBuilder) GetRawFields() map[string]interface{} {
	return b.rawDBFields
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
	var sErr syncerr.Error
	for edgeType := range b.edgeTypes {
		edgeType := edgeType
		f := func(edgeType ent.EdgeType) {
			defer wg.Done()
			edge, err := ent.GetEdgeInfo(edgeType, nil)
			sErr.Append(err)
			m.Lock()
			defer m.Unlock()
			edges[edgeType] = edge
		}
		go f(edgeType)
	}
	wg.Wait()

	if err := sErr.Err(); err != nil {
		return nil, err
	}

	return edges, nil
}
