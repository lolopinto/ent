package actions

import (
	"errors"
	"fmt"
	"log"
	"sync"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/syncerr"
	"github.com/lolopinto/ent/internal/util"
)

// fields in generated builder not in actions
// bug in in having it in actions now because if we set something in actions that's not there, there'll be an issue
// TODO rename to [Base|Abstract]MutationBuilder or something like that
type EntMutationBuilder struct {
	Viewer          viewer.ViewerContext
	ExistingEntity  ent.Entity
	entity          ent.Entity
	Operation       ent.WriteOperation
	EntConfig       ent.Config
	buildFieldsFn   func() FieldMap
	rawDBFields     map[string]interface{}
	validatedFields map[string]interface{}
	edges           []*ent.EdgeOperation
	edgeTypes       map[ent.EdgeType]bool
	placeholderID   string
	validated       bool
	triggers        []Trigger
	observers       []Observer
	validators      []Validator
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

func BuildFields(buildFieldsFn func() FieldMap) func(*EntMutationBuilder) {
	return func(mb *EntMutationBuilder) {
		mb.buildFieldsFn = buildFieldsFn
	}
}

// TODO have this just take a loader...
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

func (b *EntMutationBuilder) processRawFields() chan fieldsResult {
	result := make(chan fieldsResult)
	go func() {
		fields := make(map[string]interface{})
		for dbKey, value := range b.rawDBFields {
			fields[dbKey] = b.resolveFieldValue(dbKey, value)
		}
		result <- fieldsResult{
			fields: fields,
		}
	}()
	return result
}

func (b *EntMutationBuilder) SetRawFields(m map[string]interface{}) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.rawDBFields = m
}

func (b *EntMutationBuilder) OverrideRawField(key string, val interface{}) {
	if b.rawDBFields == nil {
		util.GoSchemaKill("cannot call OverideRawField without having already previouslyset it")
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

func (b *EntMutationBuilder) SetValidators(validators []Validator) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.validators = validators
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

			cWithValidators, ok := c.(ChangesetWithValidators)
			if ok {
				b.validators = append(b.validators, cWithValidators.Validators()...)
			}
		}
		b.changesets = changesets
	}
	return nil
}

// Note that this shouldn't be called directly
// Need to pass things to it to work correctly
// all of these should be passed in constructor?
// TODO refactor this and construction so that calling action.Validate() works
// shouldn't need the workarounds we did for GetChangeset e.g ent.Save()
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

	if len(b.edges) != len(edgeData) {
		log.Println("couldn't load all the data for edges")
	}

	edges := b.edges
	for _, edge := range edges {
		ops = append(ops, edge)
		edgeInfo := edgeData[edge.EdgeType()]

		if edgeInfo == nil {
			return nil, fmt.Errorf("couldn't load edgeData for edge %s", edge.EdgeType())
		}
		// symmetric edge. same edge type
		if edgeInfo.SymmetricEdge {
			ops = append(ops, edge.SymmetricEdge())
		}

		// inverse edge
		if edgeInfo.InverseEdgeType.Valid {
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
		// this shouldn't be needed...
		// we have run the validators to get to this step.
		// TODO kill...
		validators: b.validators,
	}, nil
}

type fieldsResult struct {
	fields map[string]interface{}
	err    error
}

func (b *EntMutationBuilder) validateFieldInfos() chan fieldsResult {
	result := make(chan fieldsResult)
	go func() {
		if b.buildFieldsFn == nil {
			result <- fieldsResult{}
			return
		}
		// gather fieldInfos, validate as needed and then return
		fieldInfos := b.buildFieldsFn()

		fields := make(map[string]interface{})
		var serr syncerr.Error
		var wg sync.WaitGroup
		var m sync.Mutex
		wg.Add(len(fieldInfos))

		for fieldName := range fieldInfos {
			go func(fieldName string) {
				defer wg.Done()
				fieldInfo := fieldInfos[fieldName]

				val := fieldInfo.Value
				dbKey := fieldInfo.Field.DBKey(fieldName)

				// don't validate builders, they'll be resolved later (hopefully)
				_, ok := fieldInfo.Value.(ent.MutationBuilder)
				if !ok {
					var err error
					// validate field
					if err = fieldInfo.Field.Valid(fieldName, fieldInfo.Value); err != nil {
						serr.Append(err)
						return
					}

					// this is also where default values will be set eventually
					// format as needed
					val, err = fieldInfo.Field.Format(fieldInfo.Value)
					if err != nil {
						serr.Append(err)
						return
					}
				}
				m.Lock()
				defer m.Unlock()
				fields[dbKey] = b.resolveFieldValue(dbKey, val)
			}(fieldName)
		}
		wg.Wait()

		result <- fieldsResult{
			err:    serr.Err(),
			fields: fields,
		}
	}()
	return result
}

func (b *EntMutationBuilder) runExtraValidators() chan error {
	errChan := make(chan error)

	go func() {
		var serr syncerr.Error
		var wg sync.WaitGroup
		wg.Add(len(b.validators))
		for idx := range b.validators {
			go func(idx int) {
				defer wg.Done()
				val := b.validators[idx]
				if err := val.Validate(); err != nil {
					serr.Append(err)
				}
			}(idx)
		}
		wg.Wait()
		errChan <- serr.Err()
	}()
	return errChan
}

func (b *EntMutationBuilder) validate() error {
	if err := b.runTriggers(); err != nil {
		return err
	}

	// validators that come from fields
	var resultChan chan fieldsResult
	if b.rawDBFields != nil {
		resultChan = b.processRawFields()
	} else {
		resultChan = b.validateFieldInfos()
	}
	// extra user-defined validators
	validatorChan := b.runExtraValidators()

	validatorErr, result := <-validatorChan, <-resultChan
	if err := util.CoalesceErr(validatorErr, result.err); err != nil {
		return err
	}
	b.validatedFields = result.fields

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

	edgeTypes := make([]string, len(b.edgeTypes))

	idx := 0
	for edgeType := range b.edgeTypes {
		edgeTypes[idx] = string(edgeType)
		idx++
	}

	return ent.GetEdgeInfos(edgeTypes)
}
