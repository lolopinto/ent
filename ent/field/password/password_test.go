package password_test

import (
	"errors"
	"regexp"
	"strings"
	"testing"

	"github.com/lolopinto/ent/ent/field"
	"github.com/lolopinto/ent/ent/field/password"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

type testCase struct {
	input string
	cost  int
	err   error
}

func TestDataType(t *testing.T) {
	testCases := map[string]func() (field.FullDataType, testCase){
		"base": func() (field.FullDataType, testCase) {
			dt := password.Type()
			return dt, testCase{"password", bcrypt.DefaultCost, nil}
		},
		"password-with-min-cost": func() (field.FullDataType, testCase) {
			dt := password.Type().Cost(bcrypt.MinCost)
			return dt, testCase{"password", bcrypt.MinCost, nil}
		},
		"password-with-low-cost": func() (field.FullDataType, testCase) {
			dt := password.Type().Cost(1)
			return dt, testCase{"password", bcrypt.DefaultCost, nil}
		},
		"password-with-cost": func() (field.FullDataType, testCase) {
			dt := password.Type().Cost(12)
			return dt, testCase{"password", 12, nil}
		},
		// we don't test MaxCost cause it takes too long (which is a good thing)
		"password-with-too-high-cost": func() (field.FullDataType, testCase) {
			dt := password.Type().Cost(40)
			return dt, testCase{"password", 0, errors.New("cost 40 is outside allowed range (4,31)")}
		},
		"password-not-empty": func() (field.FullDataType, testCase) {
			dt := password.Type().NotEmpty()
			return dt, testCase{"", bcrypt.DefaultCost, errors.New("length")}
		},
		"password-not-empty-valid": func() (field.FullDataType, testCase) {
			dt := password.Type().NotEmpty()
			return dt, testCase{"password", bcrypt.DefaultCost, nil}
		},
		"password-min-len": func() (field.FullDataType, testCase) {
			dt := password.Type().MinLen(8)
			return dt, testCase{"pass", bcrypt.DefaultCost, errors.New("length")}
		},
		"password-min-len-valid": func() (field.FullDataType, testCase) {
			dt := password.Type().MinLen(8)
			return dt, testCase{"password", bcrypt.DefaultCost, nil}
		},
		"password-max-len": func() (field.FullDataType, testCase) {
			dt := password.Type().MaxLen(20)
			return dt, testCase{"passwordpasswordpassword", bcrypt.DefaultCost, errors.New("length")}
		},
		"password-max-len-valid": func() (field.FullDataType, testCase) {
			dt := password.Type().MaxLen(20)
			return dt, testCase{"password", bcrypt.DefaultCost, nil}
		},
		"password-does-not-match": func() (field.FullDataType, testCase) {
			dt := password.Type().DoesNotMatch(regexp.MustCompile(`^[a-zA-Z0-9_-]{5,20}$`))
			return dt, testCase{"password", bcrypt.DefaultCost, errors.New("match")}
		},
		"password-does-not-match-valid": func() (field.FullDataType, testCase) {
			dt := password.Type().DoesNotMatch(regexp.MustCompile(`^[a-zA-Z0-9_-]{5,20}$`))
			return dt, testCase{"Pa$$w0rd", bcrypt.DefaultCost, nil}
		},
		"password-match": func() (field.FullDataType, testCase) {
			dt := password.Type().Match(regexp.MustCompile(`^[a-zA-Z0-9_-]{5,20}$`))
			return dt, testCase{"password", bcrypt.DefaultCost, nil}
		},
		"password-match-valid": func() (field.FullDataType, testCase) {
			dt := password.Type().Match(regexp.MustCompile(`^[a-zA-Z0-9_-]{5,20}$`))
			return dt, testCase{"Pa$$w0rd", bcrypt.DefaultCost, errors.New("match")}
		},
		"password-matcher-number": func() (field.FullDataType, testCase) {
			dt := password.Type().Validate(password.StereoTypicalMatcher().Match)
			return dt, testCase{"password$A", bcrypt.DefaultCost, errors.New("minimum number length")}
		},
		"password-matcher-upper": func() (field.FullDataType, testCase) {
			dt := password.Type().Validate(password.StereoTypicalMatcher().Match)
			return dt, testCase{"password$4", bcrypt.DefaultCost, errors.New("minimum upper length")}
		},
		"password-matcher-special": func() (field.FullDataType, testCase) {
			dt := password.Type().Validate(password.StereoTypicalMatcher().Match)
			return dt, testCase{"password4U", bcrypt.DefaultCost, errors.New("minimum special characters")}
		},
		"password-matcher-lower": func() (field.FullDataType, testCase) {
			dt := password.Type().Validate(password.StereoTypicalMatcher().Match)
			return dt, testCase{"1234567890$A", bcrypt.DefaultCost, errors.New("minimum lower length")}
		},
		"password-matcher-valid": func() (field.FullDataType, testCase) {
			dt := password.Type().Validate(password.StereoTypicalMatcher().Match)
			// 1password generated :)
			return dt, testCase{"wpyi6KQqiwRfENUJob&q", bcrypt.DefaultCost, nil}
		},
		"password-matcher-min-len": func() (field.FullDataType, testCase) {
			dt := password.Type().Validate(password.StereoTypicalMatcher().Match)
			return dt, testCase{"a1A&q", bcrypt.DefaultCost, errors.New("min length")}
		},
		"password-matcher-max-len": func() (field.FullDataType, testCase) {
			dt := password.Type().Validate(password.StereoTypicalMatcher().Match)
			return dt, testCase{"wpyi6KQqiwRfENUJob&qwpyi6KQqiwRfENUJob&q", bcrypt.DefaultCost, errors.New("max length")}
		},
		"password-matcher-base": func() (field.FullDataType, testCase) {
			dt := password.Type().Validate((&password.PasswordMatcher{}).Match)
			return dt, testCase{"a", bcrypt.DefaultCost, nil}
		},
	}

	for key, fn := range testCases {
		t.Run(key, func(t *testing.T) {
			dt, expRes := fn()

			err := dt.Valid(expRes.input)
			if expRes.err == nil {
				require.Nil(t, err)
				res, err := dt.Format(expRes.input)
				require.Nil(t, err)

				hashedPassword := []byte(res.(string))
				cost, err := bcrypt.Cost(hashedPassword)
				require.Nil(t, err)
				assert.Equal(t, expRes.cost, cost)

				// compare the hash and password to make sure no issues
				require.Nil(t, bcrypt.CompareHashAndPassword(hashedPassword, []byte(expRes.input)))
			} else {
				require.NotNil(t, err)
				require.Condition(t, func() bool {
					return strings.Contains(err.Error(), expRes.err.Error())
				})
			}
		})
	}
}
