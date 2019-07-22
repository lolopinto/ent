package actions

import (
	"fmt"
	"reflect"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
	entreflect "github.com/lolopinto/ent/internal/reflect"
)

// type ActionMutator interface {

// }
// type ActionMutator struct {
// 	Viewer viewer.ViewerContext
// }

// // TODO
// type ActionWithValidators interface {
// 	GetValidators() bool
// }

// // TODO
// type ActionWithObservers interface {
// 	GetObservers() bool
// }

// order is, run all validators to make sure things are good
// then perform the main mutation
// then run all observers
// validators and observers not implemented yet

type ActionMutator interface {
	//Validate() error
	GetFieldMap() ent.ActionFieldMap
}

type editNodeActionMutator struct {
	ActionMutator
	Viewer        viewer.ViewerContext
	editedFields  map[string]interface{}
	inboundEdges  []*ent.EditedEdgeInfo
	outboundEdges []*ent.EditedEdgeInfo
	validated     bool
}

// func validateAction(actionMutator ActionMutator, entity ent.Entity, entConfig ent.Config) error {

// }

func (action *editNodeActionMutator) SetField(fieldName string, val interface{}) {
	if action.editedFields == nil {
		action.editedFields = make(map[string]interface{})
	}
	//	spew.Dump(fieldName, val, action.fieldMap)
	action.editedFields[fieldName] = val
}

func (action *editNodeActionMutator) AddInboundEdge(edgeType ent.EdgeType, id1 string, nodeType ent.NodeType) {
	action.inboundEdges = append(action.inboundEdges, &ent.EditedEdgeInfo{
		EdgeType: edgeType,
		Id:       id1,
		NodeType: nodeType,
	})
}

func (action *editNodeActionMutator) AddOutboundEdge(edgeType ent.EdgeType, id2 string, nodeType ent.NodeType) {
	action.inboundEdges = append(action.inboundEdges, &ent.EditedEdgeInfo{
		EdgeType: edgeType,
		Id:       id2,
		NodeType: nodeType,
	})
}

// Validate that the action is valid
func (action *editNodeActionMutator) Validate(fieldMap ent.ActionFieldMap) error {
	var errors []*ent.ActionErrorInfo

	//	spew.Dump(action.GetFieldMap())
	//	spew.Dump(action.GetFieldMap())
	for fieldName, item := range fieldMap {
		_, ok := action.editedFields[fieldName]

		// won't work because we have the wrong names in the setters right now
		if item.Required && !ok {
			errors = append(errors, &ent.ActionErrorInfo{
				ErrorMsg: fmt.Sprintf("%s is required and was not set", fieldName),
			})
		}
	}

	if len(errors) == 0 {
		return nil
	}
	return &ent.ActionValidationError{
		Errors:     errors,
		ActionName: "TODO",
	}
}

// TODO play with APIs. doesn't matter for now since it's going directly to graphql...
// Right now, the API is
/*
	useraction.CreateUser(viewer).
		SetFirstName("firstName").
		SetLastName("lastName").
		SetEmailAddress("emailAddress").
		SetEncryptedPassword("encryptedPassword").
		Save()
*/

/*
  maybe try
	useraction.CreateUser(
		viewer,
		//
		useraction.FirstName("firstName"),
		useraction.LastName("lastname"),
		useraction.EmailAddress("emailaddress"),
	).Save()
*/

type CreateEntActionMutator struct {
	ActionMutator
	editNodeActionMutator
	Viewer    viewer.ViewerContext
	EntConfig ent.Config
	//	Ent      ent.Entity // TODO
}

// func SaveAction(action CreateEntActionMutator, entity ent.Entity) error {
// 	validateAction(action, entity, action.EntConfig)
// }

func (action *CreateEntActionMutator) SaveAction(entity ent.Entity, fieldMap ent.ActionFieldMap) error {
	//	spew.Dump(action.GetFieldMap())

	// TODO figure out why I need to pass this in. I don't get it :()
	action.Validate(fieldMap)
	err := ent.CreateNodeFromActionMap(&ent.EditedNodeInfo{
		Entity:         entity,
		EntConfig:      action.EntConfig,
		EditableFields: fieldMap,
		Fields:         action.editedFields,
		InboundEdges:   action.inboundEdges,
		OutboundEdges:  action.outboundEdges,
	})
	if err != nil {
		return err
	}
	// set the viewer of the ent
	entreflect.SetValueInEnt(reflect.ValueOf(entity), "Viewer", action.Viewer)
	return nil
}

type EditEntActionMutator struct {
	editNodeActionMutator
	Viewer    viewer.ViewerContext
	EntConfig ent.Config
	Ent       ent.Entity // TODO
}

func (action *EditEntActionMutator) SaveAction(entity ent.Entity, fieldMap ent.ActionFieldMap) error {
	action.Validate(fieldMap)
	err := ent.EditNodeFromActionMap(&ent.EditedNodeInfo{
		Entity:         entity,
		EntConfig:      action.EntConfig,
		EditableFields: fieldMap,
		Fields:         action.editedFields,
		ExistingEnt:    action.Ent,
		InboundEdges:   action.inboundEdges,
		OutboundEdges:  action.outboundEdges,
	})
	if err != nil {
		return err
	}
	entreflect.SetValueInEnt(reflect.ValueOf(entity), "Viewer", action.Viewer)
	return nil
}

type DeleteEntActionMutator struct {
	Ent       ent.Entity // TODO
	Viewer    viewer.ViewerContext
	EntConfig ent.Config
}

// TODO this should be private... other people shouldn't be able to call this :(
func (action *DeleteEntActionMutator) SaveAction() error {
	return ent.DeleteNode(action.Ent, action.EntConfig)
}
