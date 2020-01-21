package field_test

import (
	"errors"
	"regexp"
	"strings"
	"testing"

	"github.com/lolopinto/ent/ent/field"
	"github.com/stretchr/testify/assert"
)

type testCase struct {
	value  interface{}
	result interface{}
	err    error
	typ    interface{}
}

func TestString(t *testing.T) {
	testCases := map[string]func(dt *field.StringType) testCase{
		"base_case": func(dt *field.StringType) testCase {
			return testCase{
				value:  "test",
				result: "test",
			}
		},
		"ToLower": func(dt *field.StringType) testCase {
			dt.ToLower()
			return testCase{
				value:  "UPPER CASE",
				result: "upper case",
			}
		},
		"ToLowerNoChange": func(dt *field.StringType) testCase {
			dt.ToLower()
			return testCase{
				value:  "lower case",
				result: "lower case",
			}
		},
		"ToUpper": func(dt *field.StringType) testCase {
			dt.ToUpper()
			return testCase{
				value:  "upper case",
				result: "UPPER CASE",
			}
		},
		"ToUpperNoChange": func(dt *field.StringType) testCase {
			dt.ToUpper()
			return testCase{
				value:  "UPPER CASE",
				result: "UPPER CASE",
			}
		},
		"Title": func(dt *field.StringType) testCase {
			dt.Title()
			return testCase{
				value:  "hello, world",
				result: "Hello, World",
			}
		},
		"TitleNoChange": func(dt *field.StringType) testCase {
			dt.Title()
			return testCase{
				value:  "Hello, WORLD",
				result: "Hello, WORLD",
			}
		},
		"TrimSpace": func(dt *field.StringType) testCase {
			dt.TrimSpace()
			return testCase{
				value:  " test@email.com ",
				result: "test@email.com",
			}
		},
		"TrimSpaceNoChange": func(dt *field.StringType) testCase {
			dt.ToLower()
			return testCase{
				value:  "no space",
				result: "no space",
			}
		},
		"TrimAndLower": func(dt *field.StringType) testCase {
			// shows combination of formats
			dt.ToLower().TrimSpace()
			return testCase{
				value:  " TEST@email.com ",
				result: "test@email.com",
			}
		},
		"NotEmpty": func(dt *field.StringType) testCase {
			dt.NotEmpty()
			return testCase{
				value:  "",
				result: "",
				err:    errors.New("minimum"),
			}
		},
		"NotEmptyValid": func(dt *field.StringType) testCase {
			dt.NotEmpty()
			return testCase{
				value:  "test",
				result: "test",
			}
		},
		"MinLen": func(dt *field.StringType) testCase {
			dt.MinLen(6)
			return testCase{
				value:  "seven",
				result: "seven",
				err:    errors.New("minimum"),
			}
		},
		"MinLenValid": func(dt *field.StringType) testCase {
			dt.MinLen(6)
			return testCase{
				value:  "more than six",
				result: "more than six",
			}
		},
		"MaxLen": func(dt *field.StringType) testCase {
			dt.MaxLen(20)
			return testCase{
				value:  "this sentence is too long and will result in error",
				result: "this sentence is too long and will result in error",
				err:    errors.New("maximum"),
			}
		},
		"MaxLenValid": func(dt *field.StringType) testCase {
			dt.MaxLen(20)
			return testCase{
				value:  "valid",
				result: "valid",
			}
		},
		"Length": func(dt *field.StringType) testCase {
			dt.MaxLen(5)
			return testCase{
				value:  "94114-2324",
				result: "94114-2324",
				err:    errors.New("length"),
			}
		},
		"LegnthValid": func(dt *field.StringType) testCase {
			dt.Length(5)
			return testCase{
				value:  "94114",
				result: "94114",
			}
		},
		"MinLenMaxLen": func(dt *field.StringType) testCase {
			dt.MinLen(8).MaxLen(20)
			return testCase{
				value:  "bad password",
				result: "bad password",
			}
		},
		"MinLenMaxLenShort": func(dt *field.StringType) testCase {
			dt.MinLen(8).MaxLen(20)
			return testCase{
				value:  "94114",
				result: "94114",
				err:    errors.New("minimum"),
			}
		},
		"MinLenMaxLenLong": func(dt *field.StringType) testCase {
			dt.MinLen(8).MaxLen(20)
			return testCase{
				value:  "this sentence is too long",
				result: "this sentence is too long",
				err:    errors.New("maximum"),
			}
		},
		"Match": func(dt *field.StringType) testCase {
			r := regexp.MustCompile(`^[a-zA-Z0-9_-]{5,20}$`)
			dt.Match(r)
			return testCase{
				value:  "$username",
				result: "$username",
				err:    errors.New("match"),
			}
		},
		"MatchValid": func(dt *field.StringType) testCase {
			r := regexp.MustCompile(`^[a-zA-Z0-9_-]{5,20}$`)
			dt.Match(r)
			return testCase{
				value:  "username",
				result: "username",
			}
		},
		"DoesNotMatch": func(dt *field.StringType) testCase {
			r := regexp.MustCompile(`^[a-zA-Z0-9_-]{5,20}$`)
			dt.DoesNotMatch(r)
			return testCase{
				value:  "username",
				result: "username",
				err:    errors.New("matches"),
			}
		},
		"DoesNotMatchValid": func(dt *field.StringType) testCase {
			r := regexp.MustCompile(`^[a-zA-Z0-9_-]{5,20}$`)
			dt.DoesNotMatch(r)
			return testCase{
				value:  "$username",
				result: "$username",
			}
		},
	}

	for key, tt := range testCases {
		dt := field.String()
		t.Run(key, func(t *testing.T) {
			expRes := tt(dt)

			err := dt.Valid(expRes.value)
			if expRes.err == nil {
				assert.Nil(t, err)
			} else {
				assert.NotNil(t, err)

				assert.Condition(t, func() bool {
					return strings.Contains(err.Error(), expRes.err.Error())
				})
			}
			assert.Equal(t, dt.Format(expRes.value), expRes.result)

			assert.Equal(t, "", dt.Type())
		})
	}
}
