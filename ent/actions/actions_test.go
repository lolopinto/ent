package actions

import (
	"fmt"
	"testing"

	"github.com/iancoleman/strcase"
	"github.com/khaiql/dbcleaner"
	"github.com/khaiql/dbcleaner/engine"
	"github.com/lolopinto/ent/config"
	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/privacy"
	"github.com/lolopinto/ent/ent/test_schema/models"
	"github.com/lolopinto/ent/ent/test_schema/models/configs"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

type userAction struct {
	viewer viewer.ViewerContext
	//fields       map[string]interface{}
	emailAddress string
	firstName    string
	lastName     string
}

func (a *userAction) GetViewer() viewer.ViewerContext {
	return a.viewer
}

func (a *userAction) GetFieldMap() ent.ActionFieldMap {
	// copied from getFieldMapFromFields in ent_test
	ret := make(ent.ActionFieldMap)
	fields := a.getFields()
	for k := range fields {
		ret[k] = &ent.MutatingFieldInfo{
			DB:       strcase.ToSnake(k),
			Required: true,
		}
	}
	return ret
}

func (a *userAction) getFields() map[string]interface{} {
	m := make(map[string]interface{})
	m["EmailAddress"] = a.emailAddress
	m["FirstName"] = a.firstName
	m["LastName"] = a.lastName
	return m
}

type createUserAction struct {
	userAction
	user models.User
}

func (a *createUserAction) PerformAction() error {
	return ent.CreateNodeFromActionMap(
		&ent.EditedNodeInfo{
			Entity:         &a.user,
			EntConfig:      &configs.UserConfig{},
			Fields:         a.getFields(),
			EditableFields: a.GetFieldMap(),
		},
	)
}

func (a *createUserAction) GetPrivacyPolicy() ent.PrivacyPolicy {
	return privacy.InlinePrivacyPolicy{
		privacy.Rules(
			privacy.AlwaysAllowRule{},
		),
		&a.user,
	}
}

func (a *createUserAction) GetUnderlyingEnt() ent.Entity {
	return nil
}

var _ ActionWithPermissions = &createUserAction{}

type editUserAction struct {
	userAction
	existingEnt models.User
	user        models.User
}

func (a *editUserAction) PerformAction() error {
	return ent.EditNodeFromActionMap(
		&ent.EditedNodeInfo{
			Entity:         &a.user,
			EntConfig:      &configs.UserConfig{},
			Fields:         a.getFields(),
			EditableFields: a.GetFieldMap(),
			ExistingEnt:    &a.existingEnt,
		},
	)
}

func (a *editUserAction) GetPrivacyPolicy() ent.PrivacyPolicy {
	return privacy.InlinePrivacyPolicy{
		privacy.Rules(
			privacy.AllowIfViewerIsOwnerRule{a.existingEnt.ID},
			privacy.AlwaysDenyRule{},
		),
		&a.user,
	}
}

func (a *editUserAction) GetUnderlyingEnt() ent.Entity {
	return &a.user
}

var _ ActionWithPermissions = &editUserAction{}

type actionsPermissionsSuite struct {
	suite.Suite
	cleaner dbcleaner.DbCleaner
}

func (suite *actionsPermissionsSuite) SetupSuite() {
	suite.cleaner = dbcleaner.New()
	postgres := engine.NewPostgresEngine(config.GetConnectionStr())
	suite.cleaner.SetEngine(postgres)
}

func (suite *actionsPermissionsSuite) SetupTest() {
	suite.cleaner.Acquire("users")
}

func (suite *actionsPermissionsSuite) TearDownTest() {
	suite.cleaner.Clean("users")
}

func createUser(v viewer.ViewerContext) (createUserAction, error) {
	action := createUserAction{}
	action.viewer = v
	action.firstName = "Ola"
	action.lastName = "Okelola"
	action.emailAddress = fmt.Sprintf("test-%s@email.com", util.GenerateRandCode(9))

	err := Save(&action)
	return action, err
}

func (suite *actionsPermissionsSuite) TestCreatePrivacy() {
	var testCases = []struct {
		viewer   viewer.ViewerContext
		allowed  bool
		testCase string
	}{
		{
			viewertesting.OmniViewerContext{},
			true,
			"omni viewer context",
		},
		{
			viewertesting.LoggedinViewerContext{},
			true,
			"logged in viewer context",
		},
		{
			viewer.LoggedOutViewer(),
			true,
			"logged out viewer context",
		},
	}

	for _, tt := range testCases {
		action, err := createUser(tt.viewer)
		if tt.allowed {
			assert.Nil(suite.T(), err)
			assert.NotZero(suite.T(), action.user)
		} else {
			assert.NotNil(suite.T(), err)
			assert.Zero(suite.T(), action.user)
		}
	}
}

func (suite *actionsPermissionsSuite) TestEditPrivacy() {
	action, err := createUser(viewer.LoggedOutViewer())
	assert.Nil(suite.T(), err)
	user := action.user
	assert.NotZero(suite.T(), user)

	var testCases = []struct {
		viewer   viewer.ViewerContext
		allowed  bool
		testCase string
	}{
		{
			viewertesting.OmniViewerContext{},
			false,
			"omni viewer context",
		},
		{
			viewertesting.LoggedinViewerContext{ViewerID: user.ID},
			true,
			"logged in viewer context with user",
		},
		{
			viewertesting.LoggedinViewerContext{ViewerID: "1"},
			false,
			"logged in viewer context with different user",
		},
		{
			viewer.LoggedOutViewer(),
			false,
			"logged out viewer context",
		},
	}

	for _, tt := range testCases {
		action := editUserAction{}
		action.existingEnt = user
		action.viewer = tt.viewer
		action.firstName = "Ola2"
		err := Save(&action)
		if tt.allowed {
			assert.Nil(suite.T(), err, tt.testCase)
			assert.NotZero(suite.T(), action.user, tt.testCase)
			assert.Equal(suite.T(), action.user.FirstName, "Ola2", tt.testCase)
		} else {
			assert.NotNil(suite.T(), err, tt.testCase)
			assert.IsType(suite.T(), &ActionPermissionsError{}, err, tt.testCase)
			assert.Zero(suite.T(), action.user, tt.testCase)
		}
	}
}

func TestPrivacySuite(t *testing.T) {
	suite.Run(t, new(actionsPermissionsSuite))
}
