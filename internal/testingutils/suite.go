package testingutils

import (
	"github.com/khaiql/dbcleaner"
	"github.com/stretchr/testify/suite"
)

type Suite struct {
	suite.Suite
	Tables  []string
	cleaner dbcleaner.DbCleaner
}

func (suite *Suite) SetupSuite() {
	// suite.cleaner = dbcleaner.New(dbcleaner.SetNumberOfRetry(5), dbcleaner.SetLockTimeout(1*time.Second), dbcleaner.SetRetryInterval(1*time.Second))
	// postgres := engine.NewPostgresEngine(config.GetConnectionStr())
	// suite.cleaner.SetEngine(postgres)
}

func (suite *Suite) SetupTest() {
	// for _, t := range suite.Tables {
	// 	suite.cleaner.Acquire(t)
	// }
}

func (suite *Suite) TearDownTest() {
	// for _, t := range suite.Tables {
	// 	suite.cleaner.Clean(t)
	// }
}
