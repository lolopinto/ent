package ent_test

import (
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/lolopinto/ent/internal/testingutils/test_db"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

type noTableSuite struct {
	testingutils.Suite
	tdb *test_db.TestDB
}

func (suite *noTableSuite) SetupSuite() {
	suite.tdb = &test_db.TestDB{}

	err := suite.tdb.BeforeAll()
	require.Nil(suite.T(), err)

	suite.Suite.ForceClean = true
	suite.Suite.SetupSuite()
}

func (suite *noTableSuite) TearDownSuite() {
	err := suite.tdb.AfterAll()
	require.Nil(suite.T(), err)
}

func (suite *noTableSuite) TestLoadAssocEdges() {
	res := <-ent.GenLoadAssocEdges()
	assert.Len(suite.T(), res.Edges, 0)
	assert.Nil(suite.T(), res.Err)
}

func TestNoTableSuite(t *testing.T) {
	t.Parallel()
	suite.Run(t, new(noTableSuite))
}

type tableExistsSuite struct {
	testingutils.Suite
	tdb *test_db.TestDB
}

func (suite *tableExistsSuite) SetupSuite() {
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

func (suite *tableExistsSuite) TearDownSuite() {
	err := suite.tdb.AfterAll()
	require.Nil(suite.T(), err)
}

func (suite *tableExistsSuite) TestLoadAssocEdges() {
	res := <-ent.GenLoadAssocEdges()
	assert.Len(suite.T(), res.Edges, 0)
	assert.Nil(suite.T(), res.Err)
}

func TestTableExistsSuite(t *testing.T) {
	t.Parallel()
	suite.Run(t, new(tableExistsSuite))
}
