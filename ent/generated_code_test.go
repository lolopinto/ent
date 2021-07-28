package ent_test

import (
	"testing"

	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/test_schema/models/user/action"
	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

type generatedCodeSuite struct {
	testingutils.Suite
}

func (suite *generatedCodeSuite) SetupSuite() {
	suite.Tables = []string{
		"addresses",
		"users",
		"events",
		"contacts",
		"user_events_edges",
	}
	suite.Suite.SetupSuite()
}

func (suite *generatedCodeSuite) getPhoneNumber(user *models.User) string {
	if user.PhoneNumber == nil {
		return ""
	}
	return *user.PhoneNumber
}

func (suite *generatedCodeSuite) TestLoadIDFrom() {
	user := testingutils.CreateTestUser(suite.T())
	user = testingutils.EditUser(suite.T(), user, map[string]interface{}{
		"phone_number": util.GenerateRandPhoneNumber(),
	})

	testCases := map[string]struct {
		queryParam string
		fn         func(string) (string, error)
		found      bool
	}{
		"email_address": {
			user.EmailAddress,
			models.LoadUserIDFromEmailAddress,
			true,
		},
		"phone_number": {
			suite.getPhoneNumber(user),
			models.LoadUserIDFromPhoneNumber,
			true,
		},
		"invalid_email": {
			suite.getPhoneNumber(user),
			models.LoadUserIDFromEmailAddress,
			false,
		},
		"invalid_phone": {
			user.EmailAddress,
			models.LoadUserIDFromPhoneNumber,
			false,
		},
	}

	for key, tt := range testCases {
		suite.T().Run(key, func(t *testing.T) {
			fn := tt.fn
			id, err := fn(tt.queryParam)

			if tt.found {
				require.NoError(t, err)
				require.Equal(t, id, user.ID)
			} else {
				require.Error(t, err)
			}
		})
	}
}

func (suite *generatedCodeSuite) TestLoadUserFrom() {
	user := testingutils.CreateTestUser(suite.T())
	user = testingutils.EditUser(suite.T(), user, map[string]interface{}{
		"phone_number": util.GenerateRandPhoneNumber(),
	})

	user2 := testingutils.CreateTestUser(suite.T())

	v := viewertesting.LoggedinViewerContext{ViewerID: user.ID}
	v2 := viewertesting.LoggedinViewerContext{ViewerID: user2.ID}

	testCases := map[string]struct {
		viewer     viewer.ViewerContext
		queryParam string
		fn         func(viewer.ViewerContext, string) (*models.User, error)
		found      bool
	}{
		"email_address": {
			v,
			user.EmailAddress,
			models.LoadUserFromEmailAddress,
			true,
		},
		"email_address_wrong_viewer": {
			v2,
			user.EmailAddress,
			models.LoadUserFromEmailAddress,
			false,
		},
		"phone_number": {
			v,
			suite.getPhoneNumber(user),
			models.LoadUserFromPhoneNumber,
			true,
		},
		"phone_number_wrong_viewer": {
			v2,
			suite.getPhoneNumber(user),
			models.LoadUserFromPhoneNumber,
			false,
		},
		"invalid_email": {
			v,
			suite.getPhoneNumber(user),
			models.LoadUserFromEmailAddress,
			false,
		},
		"invalid_email_wrong_viewer": {
			v2,
			suite.getPhoneNumber(user),
			models.LoadUserFromEmailAddress,
			false,
		},
		"invalid_phone": {
			v,
			user.EmailAddress,
			models.LoadUserFromPhoneNumber,
			false,
		},
		"invalid_phone_wrong_viewer": {
			v2,
			user.EmailAddress,
			models.LoadUserFromPhoneNumber,
			false,
		},
	}

	for key, tt := range testCases {
		suite.T().Run(key, func(t *testing.T) {
			fn := tt.fn
			loadedUser, err := fn(tt.viewer, tt.queryParam)

			if tt.found {
				require.NoError(t, err)
				require.NotNil(t, loadedUser)
				require.Equal(t, loadedUser.ID, user.ID)
			} else {
				require.Error(t, err)
			}
		})
	}
}

func (suite *generatedCodeSuite) TestValidateEmailPassword() {
	password, err := util.GenerateRandPassword()
	require.Nil(suite.T(), err)
	user, err := action.CreateUser(viewer.LoggedOutViewer()).
		SetEmailAddress(util.GenerateRandEmail()).
		SetFirstName("Jon").
		SetLastName("Snow").
		SetPassword(password).Save()

	require.NoError(suite.T(), err)
	require.NotNil(suite.T(), user)

	pw1, err := util.GenerateRandPassword()
	require.Nil(suite.T(), err)
	pw2, err := util.GenerateRandPassword()
	require.Nil(suite.T(), err)

	testCases := map[string]struct {
		email    string
		password string
		found    bool
	}{
		"right combo": {
			user.EmailAddress,
			password,
			true,
		},
		"wrong email": {
			"foo@bar.com",
			password,
			false,
		},
		"wrong password": {
			user.EmailAddress,
			pw1,
			false,
		},
		"wrong combo": {
			"foo@bar.com",
			pw2,
			false,
		},
	}

	for key, tt := range testCases {
		suite.T().Run(key, func(t *testing.T) {
			id, err := models.ValidateEmailPassword(tt.email, tt.password)

			if tt.found {
				require.NoError(t, err)
				require.Equal(t, id, user.ID)
			} else {
				require.Error(t, err)
			}
		})
	}
}

func TestGeneratedCode(t *testing.T) {
	suite.Run(t, new(generatedCodeSuite))
}
