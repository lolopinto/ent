package testingutils

import (
	"time"

	"github.com/khaiql/dbcleaner"
	"github.com/khaiql/dbcleaner/engine"
	"github.com/lolopinto/ent/ent/config"
	"github.com/stretchr/testify/suite"
)

type Suite struct {
	suite.Suite
	Tables     []string
	cleaner    dbcleaner.DbCleaner
	ForceClean bool
}

func (suite *Suite) SetupSuite() {
	if !suite.ForceClean {
		return
	}
	suite.cleaner = dbcleaner.New(dbcleaner.SetNumberOfRetry(5), dbcleaner.SetLockTimeout(1*time.Second), dbcleaner.SetRetryInterval(1*time.Second))
	postgres := engine.NewPostgresEngine(config.GetConnectionStr())
	suite.cleaner.SetEngine(postgres)
}

func (suite *Suite) SetupTest() {
	if !suite.ForceClean {
		return
	}
	for _, t := range suite.Tables {
		suite.cleaner.Acquire(t)
	}
}

func (suite *Suite) TearDownTest() {
	if !suite.ForceClean {
		return
	}
	for _, t := range suite.Tables {
		suite.cleaner.Clean(t)
	}
}
