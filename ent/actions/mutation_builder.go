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
	triggers      []Trigger
	mu            sync.RWMutex
	// what happens if there are circular dependencies?
	// let's assume not possible for now but it's possible we want to store the ID in different places/
	dependencies ent.MutationBuilderMap
	changesets   []ent.Changeset
	//	fieldsWithResolvers map[string]bool
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
	entConfig ent.Config,
	opts ...func(*EntMutationBuilder),
) *EntMutationBuilder {
	b := &EntMutationBuilder{
		Viewer:    viewer,
		Operation: operation,
		EntConfig: entConfig,
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
	// RIght now that's done by SetField()
	builder, ok := val.(ent.MutationBuilder)
	if !ok {
		return val
	}
	//	spew.Dump("resolveBuilder")
	// b.mu.Lock()
	// defer b.mu.Unlock()
	if b.dependencies == nil {
		b.dependencies = make(ent.MutationBuilderMap)
	}
	b.dependencies[builder.GetPlaceholderID()] = builder
	// if b.fieldsWithResolvers == nil {
	// 	b.fieldsWithResolvers = make(map[string]bool)
	// }
	// b.fieldsWithResolvers[fieldName] = true
	//	return builder.GetPlaceholderID()
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
	//	spew.Dump("set triggers")
	b.triggers = triggers
}

func (b *EntMutationBuilder) runTriggers() error {
	// nothing to do here
	//	spew.Dump("runTriggers")
	if len(b.triggers) == 0 {
		return nil
	}

	var errs []error
	var changesets []ent.Changeset

	var wg sync.WaitGroup
	wg.Add(len(b.triggers))
	for idx := range b.triggers {
		i := idx
		trigger := b.triggers[i]
		//		spew.Dump(trigger)
		f := func(i int) {
			defer wg.Done()
			//			spew.Dump("trigger", i)
			c, err := trigger.GetChangeset()
			if err != nil {
				errs = append(errs, err)
			}
			if c != nil {
				changesets = append(changesets, c)
			}
			//			spew.Dump("post get changeset")
		}
		go f(i)
	}
	wg.Wait()
	//	spew.Dump("after wait")
	if len(errs) != 0 {
		//		spew.Dump("error", errs)
		// TODO we need the list of errors abstraction
		return errs[0]
	}
	if len(changesets) != 0 {
		b.mu.Lock()
		defer b.mu.Unlock()
		//		spew.Dump("changeset")
		b.changesets = changesets
	}
	return nil
}

func (b *EntMutationBuilder) GetChangeset(entity ent.Entity) (ent.Changeset, error) {
	//	spew.Dump("GetChangeset...")
	//	debug.PrintStack()
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
		ops = append(ops,
			&ent.EditNodeOperation{
				ExistingEnt:         b.ExistingEntity,
				Entity:              entity,
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

	//	spew.Dump(b.dependencies, b.changesets)
	var executor ent.Executor
	// this is simple.
	// user has no dependencies but has changesets
	// so run ours, then run the others after

	// when you have dependencies but no changesets
	// simple also because something else will handle that
	// so if len(b.changesets) == 0 just be done?
	// the issue is that we need to resolve the underlying dependency
	// which is why we have a list based executor underneath anyways...
	if len(b.changesets) == 0 {
		//		spew.Dump("simple", b.fields)
		executor = &entListBasedExecutor{
			placeholderID: b.GetPlaceholderID(),
			ops:           ops,
		}
	} else {
		//		spew.Dump("complex", b.fields, b.changesets)
		// TODO
		// dependencies implies other changesets?
		// if not
		// there should either be dependencies or changesets
		executor = &entWithDependenciesExecutor{
			placeholderID: b.GetPlaceholderID(),
			ops:           ops,
			dependencies:  b.dependencies,
			changesets:    b.changesets,
		}
		// executor = &entListBasedExecutor{
		// 	placeholderID: b.GetPlaceholderID(),
		// 	ops:           ops,
		// }
	}
	// let's figure out craziness here
	//	spew.Dump(executor)
	// TODO need dependencies here also
	return &EntMutationChangeset{
		entity:        entity,
		viewer:        b.Viewer,
		executor:      executor,
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
