package actions

import (
	"fmt"
	"strings"

	"github.com/davecgh/go-spew/spew"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/viewer"
	entreflect "github.com/lolopinto/ent/internal/reflect"
)

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
	Action
	//Validate() error
	//	GetFieldMap() ent.ActionFieldMap
}

type editNodeActionMutator struct {
	ActionMutator
	Viewer               viewer.ViewerContext
	editedFields         map[string]interface{}
	inboundEdges         []*ent.EditedEdgeInfo
	outboundEdges        []*ent.EditedEdgeInfo
	removedInboundEdges  []*ent.EditedEdgeInfo
	removedOutboundEdges []*ent.EditedEdgeInfo
	validated            bool
}

type editExistingNodeActionMutator struct {
	editNodeActionMutator
	Viewer    viewer.ViewerContext
	EntConfig ent.Config
	Ent       ent.Entity // TODO
}

func (action *editExistingNodeActionMutator) SaveAction(entity ent.Entity, fieldMap ent.ActionFieldMap) error {
	if action.editedFields == nil {
		action.editedFields = make(map[string]interface{})
	}
	err := action.Validate(fieldMap)
	if err != nil {
		return err
	}
	err = ent.EditNodeFromActionMap(&ent.EditedNodeInfo{
		Entity:               entity,
		EntConfig:            action.EntConfig,
		EditableFields:       fieldMap,
		Fields:               action.editedFields,
		ExistingEnt:          action.Ent,
		InboundEdges:         action.inboundEdges,
		OutboundEdges:        action.outboundEdges,
		RemovedInboundEdges:  action.removedInboundEdges,
		RemovedOutboundEdges: action.removedOutboundEdges,
	})
	if err != nil {
		return err
	}
	entreflect.SetViewerInEnt(action.Viewer, entity)
	return nil
}

// func validateAction(actionMutator ActionMutator, entity ent.Entity, entConfig ent.Config) error {

// }

func (action *editNodeActionMutator) SetField(fieldName string, val interface{}) {
	if action.editedFields == nil {
		action.editedFields = make(map[string]interface{})
	}
	action.editedFields[fieldName] = val
}

func (action *editNodeActionMutator) AddInboundEdge(edgeType ent.EdgeType, id1 string, nodeType ent.NodeType, options ...func(*ent.EditedEdgeInfo)) {
	action.inboundEdges = append(action.inboundEdges, action.getEditedEdgeInfo(edgeType, id1, nodeType, options...))
}

func (action *editNodeActionMutator) getEditedEdgeInfo(edgeType ent.EdgeType, id string, nodeType ent.NodeType, options ...func(*ent.EditedEdgeInfo)) *ent.EditedEdgeInfo {
	info := &ent.EditedEdgeInfo{
		EdgeType: edgeType,
		Id:       id,
		NodeType: nodeType,
	}
	for _, opt := range options {
		opt(info)
	}
	return info
}

func (action *editNodeActionMutator) AddOutboundEdge(edgeType ent.EdgeType, id2 string, nodeType ent.NodeType, options ...func(*ent.EditedEdgeInfo)) {
	for _, edge := range action.outboundEdges {
		if edge.EdgeType == edgeType && edge.Id == id2 && nodeType == edge.NodeType {
			// already been added ingore for now
			// the hack in resolver_manual.go in ent-rsvp calls it before this...
			return
		}
	}
	action.outboundEdges = append(action.outboundEdges, action.getEditedEdgeInfo(edgeType, id2, nodeType, options...))
	spew.Dump(action.outboundEdges)
}

func (action *editNodeActionMutator) RemoveInboundEdge(edgeType ent.EdgeType, id1 string, nodeType ent.NodeType) {
	action.removedInboundEdges = append(action.removedInboundEdges, action.getEditedEdgeInfo(edgeType, id1, nodeType))
}

func (action *editNodeActionMutator) RemoveOutboundEdge(edgeType ent.EdgeType, id2 string, nodeType ent.NodeType) {
	action.removedOutboundEdges = append(action.removedOutboundEdges, action.getEditedEdgeInfo(edgeType, id2, nodeType))
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
	err := action.Validate(fieldMap)
	if err != nil {
		return err
	}
	err = ent.CreateNodeFromActionMap(&ent.EditedNodeInfo{
		Entity:               entity,
		EntConfig:            action.EntConfig,
		EditableFields:       fieldMap,
		Fields:               action.editedFields,
		InboundEdges:         action.inboundEdges,
		OutboundEdges:        action.outboundEdges,
		RemovedInboundEdges:  action.removedInboundEdges,
		RemovedOutboundEdges: action.removedOutboundEdges,
	})
	if err != nil {
		return err
	}
	// set the viewer of the ent
	entreflect.SetViewerInEnt(action.Viewer, entity)
	return nil
}

type EditEntActionMutator struct {
	editExistingNodeActionMutator
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

type AddEdgeActionMutator struct {
	editExistingNodeActionMutator
}

type RemoveEdgeActionMutator struct {
	editExistingNodeActionMutator
}

type EdgeGroupActionMutator struct {
	editExistingNodeActionMutator
	enumValue string
	idValue   string
	nodeType  ent.NodeType
	statusMap ent.AssocStatusMap
}

func (action *EdgeGroupActionMutator) SetEnumValue(enumValue string) {
	action.enumValue = enumValue
}

func (action *EdgeGroupActionMutator) SetIDValue(idValue string, nodeType ent.NodeType) {
	action.idValue = idValue
	action.nodeType = nodeType
}

func (action *EdgeGroupActionMutator) SetStatusMap(statusMap ent.AssocStatusMap) {
	action.statusMap = statusMap
}

func (action *EdgeGroupActionMutator) SaveAction(entity ent.Entity, fieldMap ent.ActionFieldMap) error {
	// TODO these should be in a pre-process step. the same code below is similar
	action.Validate()
	for key, value := range action.statusMap {
		// todo don't hardcode this
		if !value.UseInStatusMutation || key == "event_invitees" {
			continue
		}
		if key == strings.ToLower(action.enumValue) {
			action.AddOutboundEdge(value.Edge, action.idValue, action.nodeType)
		} else {
			action.RemoveOutboundEdge(value.Edge, action.idValue, action.nodeType)
		}
	}
	err := ent.EditNodeFromActionMap(&ent.EditedNodeInfo{
		Entity:               entity,
		EntConfig:            action.EntConfig,
		EditableFields:       fieldMap,
		Fields:               action.editedFields,
		ExistingEnt:          action.Ent,
		InboundEdges:         action.inboundEdges,
		OutboundEdges:        action.outboundEdges,
		RemovedInboundEdges:  action.removedInboundEdges,
		RemovedOutboundEdges: action.removedOutboundEdges,
	})
	if err != nil {
		return err
	}
	entreflect.SetViewerInEnt(action.Viewer, entity)
	return nil
}

func (action *EdgeGroupActionMutator) Validate() error {
	if action.enumValue == "" || action.idValue == "" {
		return &ent.ActionValidationError{
			Errors: []*ent.ActionErrorInfo{
				&ent.ActionErrorInfo{
					ErrorMsg: "required field not set",
				},
			},
			ActionName: "TODO",
		}
	}
	return nil
}
