package testingutils

import (
	"github.com/khaiql/dbcleaner"
	"github.com/khaiql/dbcleaner/engine"
	"github.com/lolopinto/ent/config"
	"github.com/stretchr/testify/suite"
)

type Suite struct {
	suite.Suite
	Tables  []string
	cleaner dbcleaner.DbCleaner
}

func (suite *Suite) SetupSuite() {
	suite.cleaner = dbcleaner.New()
	postgres := engine.NewPostgresEngine(config.GetConnectionStr())
	suite.cleaner.SetEngine(postgres)
}

func (suite *Suite) SetupTest() {
	for _, t := range suite.Tables {
		suite.cleaner.Acquire(t)
	}
}

func (suite *Suite) TearDownTest() {
	for _, t := range suite.Tables {
		suite.cleaner.Clean(t)
	}
}
