package main

import (
	"strconv"
	"testing"

	"github.com/google/uuid"
)

func TestGenerateNewEdges(t *testing.T) {
	// TODO figure out the best place to put these files
	schemaFiles := getParsedTestSchemaFiles(t)
	newEdges := generateConstsAndNewEdges(schemaFiles)

	if len(newEdges) != 1 {
		t.Errorf("Expected 1 new edge generated in model, got %d instead", len(newEdges))
	}
	newEdge := newEdges[0]

	_, err := uuid.Parse(newEdge.EdgeType)
	if err != nil {
		t.Errorf("Expected a new edge type of uuid generated. didn't get it, got %s instead", newEdge.EdgeType)
	}

	if newEdge.EdgeName != "AccountToFriendsEdge" {
		t.Errorf("edgename of newly generated edge was not as expected")
	}

	if newEdge.SymmetricEdge {
		t.Errorf("expected a non-symmetric edge. got a symmetric edge instead")
	}

	if newEdge.InverseEdgeType.Valid {
		t.Errorf("expected invalid inverse edge type. got a valid one instead")
	}

	if newEdge.EdgeTable != "accounts_friends_edge" {
		t.Errorf("invalid edge table in newly generated edge")
	}
}

func TestGeneratedConstants(t *testing.T) {
	schemaFiles := getParsedTestSchemaFiles(t)
	generateConstsAndNewEdges(schemaFiles)

	accountInfo := schemaFiles["AccountConfig"]

	numConsts := len(accountInfo.NodeData.ConstantGroups)
	if numConsts != 2 {
		t.Errorf("expected 2 constants for account node. got %d instead", numConsts)
	}
	firstGroup := accountInfo.NodeData.ConstantGroups[0]
	if firstGroup.ConstType != "ent.NodeType" {
		t.Errorf("expected nodeType to be the first constant group, got %s instead", firstGroup.ConstType)
	}
	if len(firstGroup.Constants) != 1 {
		t.Errorf("expected 1 constant in the first constant group, got %d instead", len(firstGroup.Constants))
	}
	constant := firstGroup.Constants[0]
	if constant.ConstName != "AccountType" {
		t.Errorf("unexpected constant name generated for account node, got %s instead of expected", constant.ConstName)
	}
	if constant.ConstValue != strconv.Quote("account") {
		t.Errorf("unexpected constant value for account type constant, got %s", constant.ConstValue)
	}

	secondGroup := accountInfo.NodeData.ConstantGroups[1]
	if secondGroup.ConstType != "ent.EdgeType" {
		t.Errorf("expected edgeType to be the second constant group, got %s instead", secondGroup.ConstType)
	}
	if len(secondGroup.Constants) != 1 {
		t.Errorf("expected 1 constant in the second constant group, got %d instead", len(secondGroup.Constants))
	}
	constant = secondGroup.Constants[0]
	if constant.ConstName != "AccountToFriendsEdge" {
		t.Errorf("unexpected constant name generated for account to friends edge, got %s instead of expected", constant.ConstName)
	}
	_, err := uuid.Parse(constant.ConstValue)
	if err != nil {
		t.Errorf("expected uuid as constant value for edge, got %s with err %s parsing uuid instead", constant.ConstValue, err)
	}

	todoInfo := schemaFiles["TodoConfig"]

	numConsts = len(todoInfo.NodeData.ConstantGroups)
	if numConsts != 1 {
		t.Errorf("expected 1 constant for todo node. got %d instead", numConsts)
	}
	firstGroup = todoInfo.NodeData.ConstantGroups[0]
	if firstGroup.ConstType != "ent.NodeType" {
		t.Errorf("expected nodeType to be the first constant group, got %s instead", firstGroup.ConstType)
	}
	if len(firstGroup.Constants) != 1 {
		t.Errorf("expected 1 constant in the first constant group, got %d instead", len(firstGroup.Constants))
	}
}

// // TODO need to setup tests at some point
// // for the manual files here's the cases we need to test

// // most complicated case
// var _ := `
// func (policy UserPrivacyPolicy2) Rules() []privacy.PolicyRule {
// 	return []privacy.PolicyRule{
// 		privacy.AllowIfOmniscientRule{},
// 		// BEGIN of manual privacy rules
// 		// alll
// 		privacy.AllowIfViewerRule{policy.User.ID},
// 		// hellosdsd
// 		AllowIfUserHasNotesRule{},
// 		// sdsdsd
// 		// END of manual privacy rules
// 		privacy.AlwaysDenyRule{},
// 	}
// }
// `

// // nothing
// var _ := `
// func (policy UserPrivacyPolicy2) Rules() []privacy.PolicyRule {
// 	return []privacy.PolicyRule{
// 		privacy.AllowIfOmniscientRule{},
// 		// BEGIN of manual privacy rules
// 		// END of manual privacy rules
// 		privacy.AlwaysDenyRule{},
// 	}
// }
// `

// // one rule
// var _ := `
// func (policy UserPrivacyPolicy2) Rules() []privacy.PolicyRule {
// 	return []privacy.PolicyRule{
// 		privacy.AllowIfOmniscientRule{},
// 		// BEGIN of manual privacy rules
// 		AllowIfUserHasNotesRule{},
// 		// END of manual privacy rules
// 		privacy.AlwaysDenyRule{},
// 	}
// }
// `

// // two rules
// var _ := `
// func (policy UserPrivacyPolicy2) Rules() []privacy.PolicyRule {
// 	return []privacy.PolicyRule{
// 		privacy.AllowIfOmniscientRule{},
// 		// BEGIN of manual privacy rules
// 		AllowIfUserHasNotesRule{},
// 		privacy.AllowIfViewerRule{policy.User.ID},
// 		// END of manual privacy rules
// 		privacy.AlwaysDenyRule{},
// 	}
// }
// `
// // two rules with a comment in the middle
// var _ := `
// func (policy UserPrivacyPolicy2) Rules() []privacy.PolicyRule {
// 	return []privacy.PolicyRule{
// 		privacy.AllowIfOmniscientRule{},
// 		// BEGIN of manual privacy rules
// 		AllowIfUserHasNotesRule{},
// 		// ss
// 		privacy.AllowIfViewerRule{policy.User.ID},
// 		// END of manual privacy rules
// 		privacy.AlwaysDenyRule{},
// 	}
// }
// `

// // comments on the side
// var _ := `
// func (policy UserPrivacyPolicy2) Rules() []privacy.PolicyRule {
// 	return []privacy.PolicyRule{
// 		privacy.AllowIfOmniscientRule{},
// 		// BEGIN of manual privacy rules
// 		AllowIfUserHasNotesRule{},
// 		// ss
// 		privacy.AllowIfViewerRule{policy.User.ID}, // hi
// 		// END of manual privacy rules
// 		privacy.AlwaysDenyRule{},
// 	}
// }
// `

// // AND more...
// // add cases with multiple BEGIN & END statements
// // and handle the case where people put BEGIN MANUAL and END MANUAL where
// // it shouldn't be
