package schema_test

import (
	"database/sql"
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schema/testhelper"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/lolopinto/ent/internal/testingutils/test_db"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

func TestGenerateNewEdges(t *testing.T) {
	s := getSchemaForNewConstsAndEdges(t)
	testEdgesFromConstsAndEdges(t, s)
}

func TestGeneratedConstants(t *testing.T) {
	s := getSchemaForNewConstsAndEdges(t)

	accountInfo := s.Nodes["AccountConfig"]

	testConstants(
		t,
		accountInfo,
		map[string]map[string]string{
			"ent.NodeType": {
				"AccountType": "account",
			},
			"ent.EdgeType": {
				"AccountToFriends2Edge": "",
			},
		},
	)

	todoInfo := s.Nodes["TodoConfig"]

	testConstants(
		t,
		todoInfo,
		map[string]map[string]string{
			"ent.NodeType": {
				"TodoType": "todo",
			},
		},
	)
}

type edgeTestSuite struct {
	testingutils.Suite
	tdb *test_db.TestDB
}

func (suite *edgeTestSuite) SetupSuite() {
	suite.tdb = &test_db.TestDB{
		Tables: []test_db.Table{
			{
				Name: "assoc_edge_config",
				Columns: []test_db.Column{
					test_db.UUID("edge_type", test_db.PrimaryKey()),
					test_db.Text("edge_name"),
					test_db.Bool("symmetric_edge"),
					test_db.UUID("inverse_edge_type", test_db.Nullable()),
					test_db.Text("edge_table"),
					test_db.Timestamp("created_at"),
					test_db.Timestamp("updated_at"),
				},
			},
		},
	}

	err := suite.tdb.BeforeAll()
	require.Nil(suite.T(), err)

	suite.Tables = []string{"assoc_edge_config"}
	suite.Suite.ForceClean = true
	suite.Suite.SetupSuite()
}

func (suite *edgeTestSuite) TearDownSuite() {
	err := suite.tdb.AfterAll()
	require.Nil(suite.T(), err)
}

func (suite *edgeTestSuite) TestNewVsExistingEdges() {
	t := suite.T()
	s := getSchemaForNewConstsAndEdges(t)
	testEdgesFromConstsAndEdges(t, s)

	// 1 new edge added. 1 edge total
	suite.validateSchema(s, 1, 1, 1, 0)

	s2 := getSchemaForNewConstsAndEdges2(t)

	// 1 new edge added. 2 edges total
	suite.validateSchema(s2, 2, 2, 1, 0)

	s3 := getSchemaForNewConstsAndEdges(t)

	// check again if edge is deleted
	// 1 edge total. 2 in db (would theoretically be deleted by auto_schema)
	suite.validateSchema(s3, 1, 2, 0, 0)
}

func (suite *edgeTestSuite) TestInverseAssocEdgeAddedAfter() {
	code := make(map[string]string)
	code["account_schema.ts"] = getSourceForEdgeWithoutInverse(suite.T())

	s := testhelper.ParseSchemaForTest(suite.T(), code)
	friendRequests := getEdgeFromSchema(suite.T(), s, "AccountConfig", "FriendRequests")

	require.NotNil(
		suite.T(),
		friendRequests,
		"expected the friend requests edge to not be nil",
	)

	require.Nil(
		suite.T(),
		friendRequests.InverseEdge,
		"expected the friend requests edge not to have an inverse edge",
	)

	edges := s.GetEdges()

	require.Len(
		suite.T(),
		edges,
		1,
		"Expected 1 edge generated in schema, got %d instead",
		len(edges),
	)

	friendRequestsEdge := edges["AccountToFriendRequestsEdge"]

	expectedEdge := &ent.AssocEdgeData{
		EdgeName:        "AccountToFriendRequestsEdge",
		SymmetricEdge:   false,
		InverseEdgeType: sql.NullString{},
		EdgeTable:       "account_friend_requests_edges",
	}

	testEdge(suite.T(), friendRequestsEdge, expectedEdge)

	accountInfo := s.Nodes["AccountConfig"]

	testConstants(
		suite.T(),
		accountInfo,
		map[string]map[string]string{
			"ent.NodeType": {
				"AccountType": "account",
			},
			"ent.EdgeType": {
				"AccountToFriendRequestsEdge": "",
			},
		},
	)
	// 1 new edge added. 1 edge total
	// validate with db
	suite.validateSchema(s, 1, 1, 1, 0)

	code2 := make(map[string]string)
	code2["account_schema.ts"] = getSourceForInverseAssocEdgeSameEnt(suite.T())
	s2 := testhelper.ParseSchemaForTest(suite.T(), code2)
	verifyInverseAssocEdgeSameEnt(suite.T(), s2)

	// 1 new edge added. 2 edge total
	suite.validateSchema(s2, 2, 2, 1, 1)
}

func (suite *edgeTestSuite) TestInverseAssocEdgeSameEnt() {
	code := make(map[string]string)
	code["account_schema.ts"] = getSourceForInverseAssocEdgeSameEnt(suite.T())

	s := testhelper.ParseSchemaForTest(suite.T(), code)
	verifyInverseAssocEdgeSameEnt(suite.T(), s)
}

func (suite *edgeTestSuite) validateSchema(
	s *schema.Schema,
	expectedEdges, expectedDBEdges, expectedNewEdges, expectedEdgesToUpdate int) {
	require.Equal(suite.T(), expectedNewEdges, len(s.GetNewEdges()))
	for _, edge := range s.GetNewEdges() {
		testingutils.CreateEdge(suite.T(), edge)
	}
	require.Equal(suite.T(), expectedEdgesToUpdate, len(s.GetEdgesToUpdate()))
	// need to update existing edges also
	for _, edge := range s.GetEdgesToUpdate() {
		testingutils.EditEdge(suite.T(), edge)
	}

	require.Equal(suite.T(), expectedEdges, len(s.GetEdges()))
	dbEdges := <-ent.GenLoadAssocEdges()
	assert.Nil(suite.T(), dbEdges.Err)
	assert.Equal(suite.T(), expectedDBEdges, len(dbEdges.Edges))
}

func TestEdgeSuite(t *testing.T) {
	t.Parallel()
	suite.Run(t, new(edgeTestSuite))
}

func getSourceForInverseAssocEdgeSameEnt(t *testing.T) string {
	return testhelper.GetCodeWithSchema(`
	import {StringType, EntSchema} from "{schema}";

	const Account = new EntSchema({
		fields: {
			firstName: StringType(),
		},

		edges: [{
			name: 'FriendRequests',
			schemaName: 'Account',
			inverseEdge: {
				name: 'FriendRequestsReceived',
			}
		}],
	});
	export default Account;
	`)
}

func getSourceForEdgeWithoutInverse(t *testing.T) string {
	return testhelper.GetCodeWithSchema(`
	import {StringType, EntSchema} from "{schema}";

	const Account = new EntSchema({
		fields: {
			firstName: StringType(),
		},

		edges: [{
			name: 'FriendRequests',
			schemaName: 'Account',
		}],
	});
	export default Account;
	`)
}

func getCodeForNewConstsAndEdges2(t *testing.T) map[string]string {
	code := getCodeForNewConstsAndEdges()

	// just rewrite entire edge
	code["todo_schema.ts"] = testhelper.GetCodeWithSchema(
		`import {StringType, EntSchema} from "{schema}";

			const Todo = new EntSchema({
				fields: {
					text: StringType(),
				},
				edges: [
					{
						name: 'accounts',
						schemaName: 'Account',
					}
				],
			});
			export default Todo;
		`)

	return code
}

func getSchemaForNewConstsAndEdges2(t *testing.T) *schema.Schema {
	code := getCodeForNewConstsAndEdges2(t)
	return testhelper.ParseSchemaForTest(t, code)
}

func verifyInverseAssocEdgeSameEnt(t *testing.T, s *schema.Schema) {
	friendRequests := getEdgeFromSchema(t, s, "AccountConfig", "FriendRequests")

	require.NotNil(t, friendRequests, "expected the friend requests edge to not be nil")

	assert.NotNil(t, friendRequests.InverseEdge, "expected the friend requests edge to have an inverse edge")

	friendRequestsReceived := getEdgeFromSchema(t, s, "AccountConfig", "FriendRequestsReceived")
	require.NotNil(t, friendRequestsReceived, "expected the friend requests received edge to not be nil")

	assert.Nil(t, friendRequestsReceived.InverseEdge, "expected the friend requests inverse edge field to be nil")

	assert.True(t, friendRequestsReceived.IsInverseEdge, "expected the friend request is inverse edge field to be true")

	edges := s.GetEdges()

	assert.Len(t, edges, 2, "Expected 2 edges generated in schema, got %d instead", len(edges))

	friendRequestsEdge := edges["AccountToFriendRequestsEdge"]
	friendRequestsReceivedEdge := edges["AccountToFriendRequestsReceivedEdge"]

	expectedEdge := &ent.AssocEdgeData{
		EdgeName:      "AccountToFriendRequestsEdge",
		SymmetricEdge: false,
		InverseEdgeType: sql.NullString{
			String: string(friendRequestsReceivedEdge.EdgeType),
			Valid:  true,
		},
		EdgeTable: "account_friend_requests_edges",
	}

	testEdge(t, friendRequestsEdge, expectedEdge)

	expectedInverseEdge := &ent.AssocEdgeData{
		EdgeName:      "AccountToFriendRequestsReceivedEdge",
		SymmetricEdge: false,
		InverseEdgeType: sql.NullString{
			String: string(friendRequestsEdge.EdgeType),
			Valid:  true,
		},
		EdgeTable: "account_friend_requests_edges",
	}
	testEdge(t, friendRequestsReceivedEdge, expectedInverseEdge)

	accountInfo := s.Nodes["AccountConfig"]

	testConstants(
		t,
		accountInfo,
		map[string]map[string]string{
			"ent.NodeType": {
				"AccountType": "account",
			},
			"ent.EdgeType": {
				"AccountToFriendRequestsEdge":         "",
				"AccountToFriendRequestsReceivedEdge": "",
			},
		},
	)
}

func getCodeForNewConstsAndEdges() map[string]string {
	return map[string]string{
		"account_schema.ts": testhelper.GetCodeWithSchema(
			`import {StringType, EntSchema} from "{schema}";

			const Account = new EntSchema({
				fields: {
					firstName: StringType(),
				},

				edges: [{
					name: 'friends2',
					schemaName: 'Account',
				}],
			});
			export default Account;
		`),
		"todo_schema.ts": testhelper.GetCodeWithSchema(
			`import {StringType, EntSchema} from "{schema}";

			const Todo = new EntSchema({
				fields: {
					text: StringType(),
				},
			});
			export default Todo;
		`),
	}
}

func getSchemaForNewConstsAndEdges(t *testing.T) *schema.Schema {
	code := getCodeForNewConstsAndEdges()
	s, err := testhelper.ParseSchemaForTestFull(t, code)
	require.Nil(t, err)
	return s
}

func testEdgesFromConstsAndEdges(t *testing.T, s *schema.Schema) {
	newEdges := s.GetNewEdges()

	require.Len(t, newEdges, 1)
	newEdge := newEdges[0]

	expectedEdge := &ent.AssocEdgeData{
		EdgeName:        "AccountToFriends2Edge",
		SymmetricEdge:   false,
		InverseEdgeType: sql.NullString{},
		EdgeTable:       "account_friends_2_edges",
	}

	testEdge(t, newEdge, expectedEdge)
}
