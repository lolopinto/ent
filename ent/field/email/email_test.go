package email_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/lolopinto/ent/ent/field/email"
	"github.com/stretchr/testify/require"
)

func TestDataType(t *testing.T) {
	testCases := map[string]struct {
		input  string
		output string
		err    error
	}{
		"simple":                     {"test@email.com", "test@email.com", nil},
		"trailing_space":             {"test@email.com ", "test@email.com", nil},
		"leading_space":              {" test@email.com", "test@email.com", nil},
		"leading_and_trailing_space": {" test@email.com ", "test@email.com", nil},
		"tabs":                       {"\ttest@email.com ", "test@email.com", nil},
		"with caps":                  {"Test@EMAIL.com ", "test@email.com", nil},
		"ALL CAPS":                   {"Test@EMAIL.com ", "test@email.com", nil},
		"with dash":                  {"first-last@EMAIL.com ", "first-last@email.com", nil},
		"with dots":                  {"first.last@EMAIL.com ", "first.last@email.com", nil},
		// bonus in the future, provide a way to distinugish these 2 for services which care about
		// preventing this usecase
		"with dots 2":     {"firstl.ast@EMAIL.com ", "firstl.ast@email.com", nil},
		"with gmail +":    {"test+spam-service@EMAIL.com ", "test+spam-service@email.com", nil},
		"with underscore": {"first_last@EMAIL.com", "first_last@email.com", nil},
		"no @":            {"foo.bar", "", errors.New("missing '@' or angle-addr")},
		// apparently, a valid email address
		"no.com": {"foo@bar", "foo@bar", nil},
		"name":   {"name <test@email.com>", "", errors.New("Invalid address")},
	}

	for key, tt := range testCases {
		t.Run(key, func(t *testing.T) {
			dt := email.Type()

			err := dt.Valid(tt.input)
			if tt.err == nil {
				require.Nil(t, err)
				res, err := dt.Format(tt.input)
				require.Nil(t, err)
				require.Equal(t, tt.output, res)
			} else {
				require.NotNil(t, err)
				require.Condition(t, func() bool {
					return strings.Contains(err.Error(), tt.err.Error())
				})
			}
		})
	}
}
