package actions

import (
	"errors"
	"fmt"
	"sync"

	"github.com/davecgh/go-spew/spew"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/syncerr"
	"github.com/lolopinto/ent/internal/util"
)

// fields in generated builder not in actions
// bug in in having it in actions now because if we set something in actions that's not there, there'll be an issue
type EntMutationBuilder struct {
	Viewer         viewer.ViewerContext
	ExistingEntity ent.Entity
	entity         ent.Entity
	Operation      ent.WriteOperation
	EntConfig      ent.Config
	buildFieldsFn  func() ent.ActionFieldMap2
	// for now, actions map to all the fields so it's fine. this will need to be changed when each EntMutationBuilder is generated
	// At that point, probably makes sense to have each generated Builder handle this.
	FieldMap ent.ActionFieldMap
	fields   map[string]interface{}
	// TODO one of rawFields vs buildFieldsFn needed
	rawDBFields   map[string]interface{}
	edges         []*ent.EdgeOperation
	edgeTypes     map[ent.EdgeType]bool
	placeholderID string
	validated     bool
	triggers      []Trigger
	observers     []Observer
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

func BuildFields(buildFieldsFn func() ent.ActionFieldMap2) func(*EntMutationBuilder) {
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

// does this still need to be concurrent?
// TODO this may need to be private...
// There needs to be a raw fields API where there's no fanciness
// SetRawFields vs API with fields/builders/and the works
func (b *EntMutationBuilder) setField(fieldName string, val interface{}) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.fields == nil {
		b.fields = make(map[string]interface{})
	}
	b.fields[fieldName] = b.resolveFieldValue(fieldName, val)
	b.flagWrite()
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
	// move from here to just before format into Validate()?
	if err := b.runTriggers(); err != nil {
		return nil, err
	}

	// this is the gather fields method function
	// we validate (if needed)
	// run any extra validators
	// tranform and save as needed

	// everything being done here, ignoring Validate() for now!

	fieldInfos, err := b.validate()
	if err != nil {
		return nil, err
	}

	// TODO more validators run here

	if err := b.formatFields(fieldInfos); err != nil {
		return nil, err
	}
	spew.Dump("sss")

	// should not be able to get a changeset for an invalid builder
	if !b.validated {
		// TODO
		// soulds like validate() needs to call runTriggers also...
		// if err := b.Validate(); err != nil {
		// 	return nil, err
		// }
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

		// take the fields and convert to db format!
		fields := b.rawDBFields
		var fieldsWithResolvers []string
		if fields == nil {
			// TODO consolidate with format fields so we're only running this logic once...
			fields = make(map[string]interface{})
			for dbKey, value := range b.fields {

				builder, ok := value.(ent.MutationBuilder)

				fields[dbKey] = value
				if ok {
					fields[dbKey] = builder.GetPlaceholderID()
					fieldsWithResolvers = append(fieldsWithResolvers, dbKey)
				}
			}
		}
		spew.Dump(fields)
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
		observers:     b.observers,
	}, nil
}

func (b *EntMutationBuilder) validate() (ent.ActionFieldMap2, error) {
	spew.Dump(b.buildFieldsFn)
	if b.buildFieldsFn == nil {
		return nil, nil
	}
	// hmm, can't run validators until we get everything because we need

	// gather fieldInfos, validate as needed and then return
	fieldInfos := b.buildFieldsFn()
	for fieldName, fieldInfo := range fieldInfos {
		spew.Dump(fieldName, fieldInfo.Value)
		if err := fieldInfo.Field.Valid(fieldName, fieldInfo.Value); err != nil {
			spew.Dump("error", err)
			return nil, err
		}
	}
	spew.Dump("end")
	return fieldInfos, nil
}

// this is just done before writing
func (b *EntMutationBuilder) formatFields(fieldInfos ent.ActionFieldMap2) error {
	//	var fieldsWithResolvers []string

	// this is also where default values will be set eventually
	spew.Dump(fieldInfos)
	for fieldName, fieldInfo := range fieldInfos {
		dbKey := fieldInfo.Field.DBKey(fieldName)
		spew.Dump(dbKey)
		// need builder resolving and nillable resolving at the same time because of user!!
		//		builder, ok := fieldInfo.Value.(ent.MutationBuilder)

		// if ok {
		// 	fieldsWithResolvers = append(fieldsWithResolvers, dbKey)
		// } else {
		// TODO builders
		val, err := fieldInfo.Field.Format(fieldInfo.Value)
		spew.Dump(val, err)
		if err != nil {
			return err
		}
		b.setField(dbKey, val)

		//		}

	}
	return nil
}

func (b *EntMutationBuilder) Validate() error {
	// TODO...
	return nil
	// this isn't being called at alll
	// TODO...
	// This will be handled above and eliminated from here...
	// It doesn't handle calling things on its own
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
