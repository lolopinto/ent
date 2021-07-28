package phonenumber_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/go-redis/redis"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/lolopinto/ent/ent/auth"
	entjwt "github.com/lolopinto/ent/ent/auth/jwt"
	"github.com/lolopinto/ent/ent/auth/phonenumber"
	"github.com/lolopinto/ent/ent/cache"
	"github.com/lolopinto/ent/ent/request"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/httptest"
	"github.com/lolopinto/ent/internal/test_schema/models"
	"github.com/lolopinto/ent/internal/test_schema/models/user/action"
	"github.com/lolopinto/ent/internal/util"
	"github.com/nyaruka/phonenumbers"

	"github.com/lolopinto/ent/internal/testingutils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

var signingKey = []byte("phone_auth_signing_key")

type phoneAuthTestSuite struct {
	testingutils.Suite
}

func (suite *phoneAuthTestSuite) SetupSuite() {
	suite.Tables = []string{
		"users",
		"contacts",
	}
	suite.Suite.SetupSuite()
}

func (suite *phoneAuthTestSuite) SetupTest() {
	auth.Clear()
	// clear redis in between each test
	redis, _ := cache.NewRedis(&redis.Options{
		Addr: "localhost:6379",
	})
	if redis != nil {
		redis.Clear()
	}
	jwt.TimeFunc = time.Now
}

func (suite *phoneAuthTestSuite) createUser() *models.User {
	pw, err := util.GenerateRandPassword()
	require.Nil(suite.T(), err)
	user, err := action.CreateUser(viewer.LoggedOutViewer()).
		SetFirstName("Jon").
		SetLastName("Snow").
		SetEmailAddress(util.GenerateRandEmail()).
		SetPassword(pw).
		SetPhoneNumber(util.GenerateRandPhoneNumber()).Save()

	require.NoError(suite.T(), err)
	require.Equal(suite.T(), user.FirstName, "Jon")

	return user
}

func (suite *phoneAuthTestSuite) getValidators() map[string]phonenumber.Validator {
	memory := cache.NewMemory(10*time.Minute, 10*time.Minute)
	ret := map[string]phonenumber.Validator{
		"memory": &phonenumber.MemoryValidator{
			Memory: memory,
		},
	}
	redis, _ := cache.NewRedis(&redis.Options{
		Addr: "localhost:6379",
	})
	// if no redis (none has been set up in github actions for example), don't use said validator
	if redis != nil {
		ret["redis"] = &phonenumber.RedisValidator{
			Redis: redis,
		}
	}
	return ret
}

func (suite *phoneAuthTestSuite) runFuncWithValidator(fn func(t *testing.T, validator phonenumber.Validator)) {
	validators := suite.getValidators()

	for key, validator := range validators {
		suite.T().Run(key, func(t *testing.T) {
			fn(t, validator)
		})
	}
}

func (suite *phoneAuthTestSuite) runFuncWithDefaultAuth(fn func(t *testing.T, auth *phonenumber.PhonePinAuth)) {
	validators := suite.getValidators()

	for key, validator := range validators {
		suite.T().Run(key, func(t *testing.T) {
			auth := getDefaultAuth(validator)
			fn(t, auth)
		})
		jwt.TimeFunc = time.Now
		auth.Clear()
	}
}

func (suite *phoneAuthTestSuite) TestNoSigningKey() {
	auth := phonenumber.NewPhonePinAuth(
		nil,
		models.LoadUserIDFromPhoneNumber,
		viewertesting.GetLoggedInViewer,
		&phonenumber.MemoryValidator{},
	)

	identity, err := auth.Authenticate(context.TODO(), "1", "1")
	require.Nil(suite.T(), identity)
	require.NotNil(suite.T(), err)
	require.Contains(suite.T(), err.Error(), "signing key")
}

func (suite *phoneAuthTestSuite) TestNoIDFromPhoneNumber() {
	auth := phonenumber.NewPhonePinAuth(
		signingKey,
		nil,
		viewertesting.GetLoggedInViewer,
		&phonenumber.MemoryValidator{},
	)

	identity, err := auth.Authenticate(context.TODO(), "1", "1")
	require.Nil(suite.T(), identity)
	require.NotNil(suite.T(), err)
	require.Contains(suite.T(), err.Error(), "IDFromPhoneNumber")
}

func (suite *phoneAuthTestSuite) TestNoVCFromID() {
	auth := phonenumber.NewPhonePinAuth(
		signingKey,
		models.LoadUserIDFromPhoneNumber,
		nil,
		&phonenumber.MemoryValidator{},
	)

	identity, err := auth.Authenticate(context.TODO(), "1", "1")
	require.Nil(suite.T(), identity)
	require.NotNil(suite.T(), err)
	require.Contains(suite.T(), err.Error(), "VCFromID")
}

func (suite *phoneAuthTestSuite) TestNoValidator() {
	auth := phonenumber.NewPhonePinAuth(
		signingKey,
		models.LoadUserIDFromPhoneNumber,
		viewertesting.GetLoggedInViewer,
		nil,
	)

	identity, err := auth.Authenticate(context.TODO(), "1", "1")
	require.Nil(suite.T(), identity)
	require.NotNil(suite.T(), err)
	require.Contains(suite.T(), err.Error(), "Validator")
}

func (suite *phoneAuthTestSuite) TestNotPhoneNumber() {

	suite.runFuncWithValidator(func(t *testing.T, validator phonenumber.Validator) {
		identity, err := authPhoneNumberPin("1", "1", validator)

		require.Nil(t, identity)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), "is not a number")
	})
}

func (suite *phoneAuthTestSuite) TestMissingPhoneNumber() {
	suite.runFuncWithValidator(func(t *testing.T, validator phonenumber.Validator) {
		identity, err := authPhoneNumberPin(util.GenerateRandPhoneNumber(), "1", validator)

		require.Nil(t, identity)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), "no rows in result set")
	})
}

func (suite *phoneAuthTestSuite) TestInvalidPIN() {
	user := suite.createUser()
	require.NotNil(suite.T(), user)

	suite.runFuncWithValidator(func(t *testing.T, validator phonenumber.Validator) {
		identity, err := authPhoneNumberPin(*user.PhoneNumber, "1", validator)
		require.Nil(t, identity)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), "No PIN exists")
	})
}

func (suite *phoneAuthTestSuite) TestIncorrectPIN() {
	user := suite.createUser()
	require.NotNil(suite.T(), user)

	suite.runFuncWithDefaultAuth(func(t *testing.T, auth *phonenumber.PhonePinAuth) {
		setPinInCache(*user.PhoneNumber, auth)

		identity, err := auth.Authenticate(context.TODO(), *user.PhoneNumber, "234832")
		require.Nil(t, identity)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), "PIN not as expected")
	})
}

func (suite *phoneAuthTestSuite) TestValidAuth() {
	user := suite.createUser()
	require.NotNil(suite.T(), user)
	testCases := map[string]string{}

	num, err := phonenumbers.Parse(*user.PhoneNumber, "US")
	require.Nil(suite.T(), err)

	formats := map[string]phonenumbers.PhoneNumberFormat{
		"e-164":         phonenumbers.E164,
		"national":      phonenumbers.NATIONAL,
		"international": phonenumbers.INTERNATIONAL,
	}

	for text, format := range formats {
		number := phonenumbers.Format(num, format)
		testCases[text] = number
	}
	testCases["raw-numbers"] = fmt.Sprintf("%v", *num.NationalNumber)

	for key, number := range testCases {
		suite.T().Run(key, func(t *testing.T) {

			suite.runFuncWithDefaultAuth(func(t *testing.T, auth *phonenumber.PhonePinAuth) {
				testValidAuthWithDuration(t, auth, entjwt.DefaultDuration, user, number)
			})
		})
	}
}

func (suite *phoneAuthTestSuite) TestConsecutiveAuthsFirstCorrect() {
	user := suite.createUser()
	require.NotNil(suite.T(), user)

	suite.runFuncWithDefaultAuth(func(t *testing.T, auth *phonenumber.PhonePinAuth) {
		testValidAuthWithDuration(t, auth, entjwt.DefaultDuration, user, *user.PhoneNumber)

		// trying immediately after shouldn't work since we should
		// have cleared this
		identity, err := auth.Authenticate(context.TODO(), *user.PhoneNumber, "123456")
		require.Nil(t, identity)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), "No PIN exists")
	})
}

func (suite *phoneAuthTestSuite) TestConsecutiveAuthsFirstInCorrect() {
	user := suite.createUser()
	require.NotNil(suite.T(), user)

	suite.runFuncWithDefaultAuth(func(t *testing.T, auth *phonenumber.PhonePinAuth) {
		setPinInCache(*user.PhoneNumber, auth)
		// incorrect PIN
		identity, err := auth.Authenticate(context.TODO(), *user.PhoneNumber, "232343")
		require.Nil(t, identity)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), "PIN not as expected")

		// try again with correct PIN
		verifyValidAuth(t, auth, user, *user.PhoneNumber)
	})
}

func (suite *phoneAuthTestSuite) TestOneTimeValidatorConsecutiveAuthsFirstCorrect() {
	user := suite.createUser()

	suite.runFuncWithDefaultAuth(func(t *testing.T, auth *phonenumber.PhonePinAuth) {
		auth.Validator = &phonenumber.OneTimePINValidator{
			Validator: auth.Validator,
		}

		testValidAuthWithDuration(t, auth, entjwt.DefaultDuration, user, *user.PhoneNumber)

		// trying immediately after shouldn't work since we should
		// have cleared this
		// This is same behavior as "regular" validator
		identity, err := auth.Authenticate(context.TODO(), *user.PhoneNumber, "123456")
		require.Nil(t, identity)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), "No PIN exists")
	})
}

func (suite *phoneAuthTestSuite) TestOneTimeValidatorConsecutiveAuthsFirstInCorrect() {
	user := suite.createUser()

	suite.runFuncWithDefaultAuth(func(t *testing.T, auth *phonenumber.PhonePinAuth) {
		auth.Validator = &phonenumber.OneTimePINValidator{
			Validator: auth.Validator,
		}
		setPinInCache(*user.PhoneNumber, auth)
		// incorrect PIN
		identity, err := auth.Authenticate(context.TODO(), *user.PhoneNumber, "232343")
		require.Nil(t, identity)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), "PIN not as expected")

		// try again with correct PIN will fail because it's only allowed to be used once
		// regardless of success or failure
		identity, err = auth.Authenticate(context.TODO(), *user.PhoneNumber, "123456")
		require.Nil(t, identity)
		require.NotNil(t, err)
		require.Contains(t, err.Error(), "No PIN exists")
	})
}

func (suite *phoneAuthTestSuite) TestCustomDuration() {
	user := suite.createUser()

	suite.runFuncWithDefaultAuth(func(t *testing.T, auth *phonenumber.PhonePinAuth) {
		auth.Duration = 5 * time.Minute

		testValidAuthWithDuration(suite.T(), auth, 5*time.Minute, user, *user.PhoneNumber)
	})
}

func (suite *phoneAuthTestSuite) TestCustomSigningMethod() {
	user := suite.createUser()

	suite.runFuncWithDefaultAuth(func(t *testing.T, auth *phonenumber.PhonePinAuth) {
		auth.SigningMethod = jwt.SigningMethodHS256

		identity := setPINAndVerifyValidAuth(t, auth, user, *user.PhoneNumber)

		token, err := jwt.Parse(identity.Token, func(token *jwt.Token) (interface{}, error) {
			return auth.SigningKey, nil
		})

		require.Nil(t, err)
		require.Equal(t, jwt.SigningMethodHS256, token.Method)
	})
}

type claims struct {
	Admin bool `json:"admin"`
	jwt.StandardClaims
}

func (c *claims) ID() string {
	return c.Id
}

func (suite *phoneAuthTestSuite) TestCustomClaims() {
	user := suite.createUser()

	suite.runFuncWithDefaultAuth(func(t *testing.T, auth *phonenumber.PhonePinAuth) {

		auth.ClaimFunc = func(id string) entjwt.Claims {
			return &claims{
				Admin: true,
				StandardClaims: jwt.StandardClaims{
					Id:        id,
					ExpiresAt: jwt.TimeFunc().Add(1 * time.Minute).Unix(),
				},
			}
		}
		auth.BaseClaimFunc = func() entjwt.Claims {
			return &claims{}
		}
		setPINAndVerifyValidAuth(t, auth, user, *user.PhoneNumber)
	})
}

func (suite *phoneAuthTestSuite) TestAuthFromRequestNoHeader() {
	// no header so logged out viewer
	suite.runFuncWithDefaultAuth(func(t *testing.T, phoneAuth *phonenumber.PhonePinAuth) {
		auth.Register("phone_pin_auth", phoneAuth)

		h := testServer(t)

		assert.IsType(t, viewer.LoggedOutViewerContext{}, h.V)
		assert.Equal(t, h.V.GetViewerID(), "")
	})
}

func (suite *phoneAuthTestSuite) TestAuthFromRequestWithHeader() {
	user := suite.createUser()

	suite.runFuncWithDefaultAuth(func(t *testing.T, phoneAuth *phonenumber.PhonePinAuth) {
		auth.Register("phone_pin_auth", phoneAuth)

		h := testServer(t, func(req *http.Request) {
			setPinInCache(*user.PhoneNumber, phoneAuth)
			identity, err := phoneAuth.Authenticate(context.TODO(), *user.PhoneNumber, "123456")
			require.Nil(t, err)
			require.NotNil(t, identity)

			req.Header.Set("Authorization", fmt.Sprintf("Bearer %v", identity.Token))
		})

		assert.IsType(t, viewertesting.LoggedinViewerContext{}, h.V)
		assert.Equal(t, h.V.GetViewerID(), user.ID)
	})
}

func (suite *phoneAuthTestSuite) TestInvalidAuthorizationHeader() {
	suite.runFuncWithDefaultAuth(func(t *testing.T, phoneAuth *phonenumber.PhonePinAuth) {
		auth.Register("phone_pin_auth", phoneAuth)

		h := testServer(t, func(req *http.Request) {
			req.Header.Set("Authorization", fmt.Sprintf("Bearer %v", uuid.New().String()))
		})

		assert.IsType(t, viewer.LoggedOutViewerContext{}, h.V)
		assert.Equal(t, h.V.GetViewerID(), "")
	})
}

func (suite *phoneAuthTestSuite) TestAvailableAndValid() {
	suite.runFuncWithDefaultAuth(func(t *testing.T, phoneAuth *phonenumber.PhonePinAuth) {
		auth.Register("phone_pin_auth", phoneAuth)

		randPhone := util.GenerateRandPhoneNumber()
		setPinInCache(randPhone, phoneAuth)

		valid, err := phoneAuth.AvailableAndValid(context.TODO(), randPhone, "123456")
		require.NoError(t, err)
		require.True(t, valid)

		// calling again immediately still fine because we don't clear from cache
		valid, err = phoneAuth.AvailableAndValid(context.TODO(), randPhone, "123456")
		require.NoError(t, err)
		require.True(t, valid)
	})
}

func (suite *phoneAuthTestSuite) TestAvailableAndValidUserExists() {
	user := suite.createUser()

	suite.runFuncWithDefaultAuth(func(t *testing.T, phoneAuth *phonenumber.PhonePinAuth) {
		auth.Register("phone_pin_auth", phoneAuth)

		setPinInCache(*user.PhoneNumber, phoneAuth)

		valid, err := phoneAuth.AvailableAndValid(context.TODO(), "4159876543", "123456")
		require.Error(t, err)
		require.False(t, valid)
	})
}

func (suite *phoneAuthTestSuite) TestAvailableAndValidWrongPIN() {
	suite.runFuncWithDefaultAuth(func(t *testing.T, phoneAuth *phonenumber.PhonePinAuth) {
		phoneNumber := util.GenerateRandPhoneNumber()
		auth.Register("phone_pin_auth", phoneAuth)

		setPinInCache(phoneNumber, phoneAuth)

		valid, err := phoneAuth.AvailableAndValid(context.TODO(), phoneNumber, "654321")
		require.Error(t, err)
		require.False(t, valid)
	})
}

func (suite *phoneAuthTestSuite) TestExtendTokenExpiration() {
	user := suite.createUser()
	suite.runFuncWithDefaultAuth(func(t *testing.T, phoneAuth *phonenumber.PhonePinAuth) {

		identity := setPINAndVerifyValidAuth(t, phoneAuth, user, *user.PhoneNumber)

		jwt.TimeFunc = func() time.Time {
			return time.Now().Add(30 * time.Minute)
		}
		newToken, err := phoneAuth.ExtendTokenExpiration(identity.Token)
		require.NoError(t, err)
		require.NotEqual(t, newToken, "")
		require.NotEqual(t, newToken, identity.Token)
	})
}

func testServer(t *testing.T, fns ...func(*http.Request)) *httptest.QueryHandler {
	h := &httptest.QueryHandler{
		T:        t,
		Response: []byte("auth response!"),
	}

	httptest.TestServer(
		t,
		h.HandlerFunc,
		"auth response!",
		func(r *mux.Router, req *http.Request) {
			// take every registered handler and make sure it's used by the router
			for _, v := range request.GetAllMiddlewares() {
				r.Use(v)
			}
			// take every passed in function and modify request as needed
			for _, fn := range fns {
				fn(req)
			}
		},
	)

	return h
}

func setPINAndVerifyValidAuth(
	t *testing.T,
	auth *phonenumber.PhonePinAuth,
	user *models.User,
	number string,
) *entjwt.AuthedIdentity {
	setPinInCache(*user.PhoneNumber, auth)
	return verifyValidAuth(t, auth, user, number)
}

func verifyValidAuth(
	t *testing.T,
	auth *phonenumber.PhonePinAuth,
	user *models.User,
	number string,
) *entjwt.AuthedIdentity {

	identity, err := auth.Authenticate(context.TODO(), number, "123456")
	require.Nil(t, err)
	require.NotNil(t, identity)

	require.Equal(t, user.ID, identity.Viewer.GetViewerID())

	// validate the token
	viewer, err := auth.ViewerFromToken(identity.Token)
	require.Nil(t, err)
	require.NotNil(t, viewer)
	require.Equal(t, user.ID, viewer.GetViewerID())

	require.Equal(t, viewer, identity.Viewer)

	return identity
}

func testValidAuthWithDuration(
	t *testing.T,
	auth *phonenumber.PhonePinAuth,
	duration time.Duration,
	user *models.User,
	number string,
) {

	identity := setPINAndVerifyValidAuth(t, auth, user, number)

	// check if valid after the fact
	jwt.TimeFunc = func() time.Time {
		return time.Now().Add(duration + 1*time.Second)
	}
	viewer, err := auth.ViewerFromToken(identity.Token)
	require.NotNil(t, err)
	require.Nil(t, viewer)

	// reset the time
	jwt.TimeFunc = time.Now
}

func TestPhoneAuth(t *testing.T) {
	suite.Run(t, new(phoneAuthTestSuite))
}

func setPinInCache(phoneNumber string, auth *phonenumber.PhonePinAuth) {
	setPinInCacheVal(phoneNumber, auth.Validator)
}

func setPinInCacheVal(phoneNumber string, validator phonenumber.Validator) {
	memoryValidator, ok := validator.(*phonenumber.MemoryValidator)

	num, err := phonenumbers.Parse(phoneNumber, "US")
	if err != nil {
		util.GoSchemaKill(err)
	}

	key := fmt.Sprintf("phone_number:%s", phonenumbers.Format(num, phonenumbers.E164))
	if ok {
		memoryValidator.Memory.Set(key, "123456", time.Minute*10)
	}

	redisValidator, ok := validator.(*phonenumber.RedisValidator)

	if ok {
		redisValidator.Redis.Set(key, "123456", time.Minute*10)
	}

	oneTimeValidator, ok := validator.(*phonenumber.OneTimePINValidator)
	if ok {
		setPinInCacheVal(phoneNumber, oneTimeValidator.Validator)
	}
}

func getDefaultAuth(validator phonenumber.Validator) *phonenumber.PhonePinAuth {
	return phonenumber.NewPhonePinAuth(
		signingKey,
		models.LoadUserIDFromPhoneNumber,
		viewertesting.GetLoggedInViewer,
		validator,
	)
}

func authPhoneNumberPin(phoneNumber, pin string, validator phonenumber.Validator) (*entjwt.AuthedIdentity, error) {
	auth := getDefaultAuth(validator)
	return auth.Authenticate(context.TODO(), phoneNumber, pin)
}
