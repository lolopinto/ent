package privacy_test

import (
	"testing"

	"github.com/lolopinto/ent/ent"

	"github.com/lolopinto/ent/ent/privacy"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

type edgeRulesTestSuite struct {
	testingutils.Suite
}

func (suite *edgeRulesTestSuite) SetupSuite() {
	suite.Tables = []string{
		"users",
		"events",
		"user_events_edges",
	}
	suite.Suite.SetupSuite()
}

type testCase struct {
	viewer   viewer.ViewerContext
	visible  bool
	testCase string
}

func (suite *edgeRulesTestSuite) TestAllowIfViewerInboundEdgeExistsRule() {
	user := testingutils.CreateTestUser(suite.T())
	user2 := testingutils.CreateTestUser(suite.T())
	event := testingutils.CreateTestEvent(suite.T(), user)

	testEdge(suite,
		[]testCase{
			{
				viewer.LoggedOutViewer(),
				false,
				"logged out viewer",
			},
			{
				viewertesting.LoggedinViewerContext{ViewerID: user.ID},
				true,
				"logged in viewer has edge",
			},
			{
				viewertesting.LoggedinViewerContext{ViewerID: user2.ID},
				false,
				"logged in viewer has no edge",
			},
		},
		// viewer (user) to ent (events)
		testingutils.AllowOneInlinePrivacyPolicy(
			privacy.AllowIfViewerInboundEdgeExistsRule{
				EdgeType: models.UserToEventsEdge,
			},
		),
		event,
	)
}

func (suite *edgeRulesTestSuite) TestAllowIfViewerOutboundEdgeExistsRule() {
	user := testingutils.CreateTestUser(suite.T())
	user2 := testingutils.CreateTestUser(suite.T())
	testingutils.AddFamilyMember(suite.T(), user, user2)

	testEdge(suite,
		[]testCase{
			{
				viewer.LoggedOutViewer(),
				false,
				"logged out viewer",
			},
			{
				viewertesting.LoggedinViewerContext{ViewerID: user.ID},
				true,
				"logged in viewer has edge",
			},
			{
				viewertesting.LoggedinViewerContext{ViewerID: user2.ID},
				false,
				"logged in viewer has no edge",
			},
		},
		// ent (user2) to viewer (user)
		testingutils.AllowOneInlinePrivacyPolicy(
			privacy.AllowIfViewerInboundEdgeExistsRule{
				EdgeType: models.UserToFamilyMembersEdge,
			},
		),
		user2,
	)
}

//√
func (suite *edgeRulesTestSuite) TestAllowIfEdgeExistsRule() {
	user := testingutils.CreateTestUser(suite.T())
	user2 := testingutils.CreateTestUser(suite.T())
	event := testingutils.CreateTestEvent(suite.T(), user)

	testEdge(suite,
		[]testCase{
			{
				viewer.LoggedOutViewer(),
				true,
				"logged out viewer", // not viewer dependent so...
			},
			{
				viewertesting.LoggedinViewerContext{ViewerID: user.ID},
				true,
				"logged in viewer has edge but not viewer dependent",
			},
			{
				viewertesting.LoggedinViewerContext{ViewerID: user2.ID},
				true,
				"logged in viewer has no edge but not viewer dependent",
			},
		},
		// edge exists from user to event
		testingutils.AllowOneInlinePrivacyPolicy(
			privacy.AllowIfEdgeExistsRule{
				ID1:      user.ID,
				ID2:      event.ID,
				EdgeType: models.UserToEventsEdge,
			},
		),
		event,
	)

	testEdge(suite,
		[]testCase{
			{
				viewer.LoggedOutViewer(),
				false,
				"logged out viewer", // not viewer dependent so...
			},
			{
				viewertesting.LoggedinViewerContext{ViewerID: user2.ID},
				false,
				"logged in viewer has no edge but not viewer dependent",
			},
			{
				viewertesting.LoggedinViewerContext{ViewerID: user2.ID},
				false,
				"logged in viewer has no edge but not viewer dependent",
			},
		},
		// edge doesn't exist from user to event
		testingutils.AllowOneInlinePrivacyPolicy(
			privacy.AllowIfEdgeExistsRule{
				ID1:      user2.ID,
				ID2:      event.ID,
				EdgeType: models.UserToEventsEdge,
			},
		),
		event,
	)
}

func (suite *edgeRulesTestSuite) TestDenyIfViewerInboundEdgeExistsRule() {
	user := testingutils.CreateTestUser(suite.T())
	user2 := testingutils.CreateTestUser(suite.T())
	event := testingutils.CreateTestEvent(suite.T(), user)

	testEdge(suite,
		[]testCase{
			{
				viewer.LoggedOutViewer(),
				true,
				"logged out viewer",
			},
			{
				viewertesting.LoggedinViewerContext{ViewerID: user.ID},
				false,
				"logged in viewer has edge",
			},
			{
				viewertesting.LoggedinViewerContext{ViewerID: user2.ID},
				true,
				"logged in viewer has no edge",
			},
		},
		// viewer (user) to ent (events)
		testingutils.DenyOneInlinePrivacyPolicy(
			privacy.DenyIfViewerInboundEdgeExistsRule{
				EdgeType: models.UserToEventsEdge,
			},
		),
		event,
	)
}

func (suite *edgeRulesTestSuite) TestDenyIfViewerOutboundEdgeExistsRule() {
	user := testingutils.CreateTestUser(suite.T())
	user2 := testingutils.CreateTestUser(suite.T())
	testingutils.AddFamilyMember(suite.T(), user, user2)

	testEdge(suite,
		[]testCase{
			{
				viewer.LoggedOutViewer(),
				true,
				"logged out viewer",
			},
			{
				viewertesting.LoggedinViewerContext{ViewerID: user.ID},
				false,
				"logged in viewer has edge",
			},
			{
				viewertesting.LoggedinViewerContext{ViewerID: user2.ID},
				true,
				"logged in viewer has no edge",
			},
		},
		// ent (user2) to viewer (user)
		testingutils.DenyOneInlinePrivacyPolicy(
			privacy.DenyIfViewerInboundEdgeExistsRule{
				EdgeType: models.UserToFamilyMembersEdge,
			},
		),
		user2,
	)
}

func (suite *edgeRulesTestSuite) TestDenyIfEdgeExistsRule() {
	user := testingutils.CreateTestUser(suite.T())
	user2 := testingutils.CreateTestUser(suite.T())
	event := testingutils.CreateTestEvent(suite.T(), user)

	testEdge(suite,
		[]testCase{
			{
				viewer.LoggedOutViewer(),
				false,
				"logged out viewer", // not viewer dependent so...
			},
			{
				viewertesting.LoggedinViewerContext{ViewerID: user.ID},
				false,
				"logged in viewer has edge but not viewer dependent",
			},
			{
				viewertesting.LoggedinViewerContext{ViewerID: user2.ID},
				false,
				"logged in viewer has no edge but not viewer dependent",
			},
		},
		// edge exists from user to event
		testingutils.DenyOneInlinePrivacyPolicy(
			privacy.DenyIfEdgeExistsRule{
				ID1:      user.ID,
				ID2:      event.ID,
				EdgeType: models.UserToEventsEdge,
			},
		),
		event,
	)

	testEdge(suite,
		[]testCase{
			{
				viewer.LoggedOutViewer(),
				true,
				"logged out viewer", // not viewer dependent so...
			},
			{
				viewertesting.LoggedinViewerContext{ViewerID: user2.ID},
				true,
				"logged in viewer has no edge but not viewer dependent",
			},
			{
				viewertesting.LoggedinViewerContext{ViewerID: user2.ID},
				true,
				"logged in viewer has no edge but not viewer dependent",
			},
		},
		// edge doesn't exist from user to event
		testingutils.DenyOneInlinePrivacyPolicy(
			privacy.DenyIfEdgeExistsRule{
				ID1:      user2.ID,
				ID2:      event.ID,
				EdgeType: models.UserToEventsEdge,
			},
		),
		event,
	)
}

func testEdge(suite *edgeRulesTestSuite, extraTestCases []testCase, policy ent.PrivacyPolicy, entity ent.Entity) {
	// omniscient always true
	// logged out true/false depending on the case (passed in)
	// edge exists and edge doesn't exist expected to be passed along
	testCases := []testCase{
		{
			viewertesting.OmniViewerContext{},
			true,
			"omni viewer",
		},
	}

	for _, tt := range extraTestCases {
		testCases = append(testCases, tt)
	}

	for _, tt := range testCases {

		suite.T().Run(tt.testCase, func(t *testing.T) {
			err := ent.ApplyPrivacyPolicy(
				tt.viewer,
				policy,
				entity,
			)

			if tt.visible {
				assert.Nil(t, err, tt.testCase)
			} else {
				assert.Error(t, err, tt.testCase)
			}

		})
	}
}

func TestEdgeRulesSuite(t *testing.T) {
	suite.Run(t, new(edgeRulesTestSuite))
}
