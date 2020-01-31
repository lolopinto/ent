package phonenumber_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/lolopinto/ent/ent/field/phonenumber"
	"github.com/nyaruka/phonenumbers"
	"github.com/stretchr/testify/require"
)

type testCase struct {
	input  string
	output string
	err    error
}

func TestDataType(t *testing.T) {
	testCases := map[string]func(dt *phonenumber.DataType) testCase{
		"us": func(dt *phonenumber.DataType) testCase {
			return testCase{"6501234567", "+16501234567", nil}
		},
		"us-with-country-code": func(dt *phonenumber.DataType) testCase {
			return testCase{"+16501234567", "+16501234567", nil}
		},
		"us-national": func(dt *phonenumber.DataType) testCase {
			dt.WithFormat(phonenumbers.NATIONAL)
			return testCase{"6501234567", "(650) 123-4567", nil}
		},
		"us-international": func(dt *phonenumber.DataType) testCase {
			dt.WithFormat(phonenumbers.INTERNATIONAL)
			return testCase{"6501234567", "+1 650-123-4567", nil}
		},
		"us-dashes": func(dt *phonenumber.DataType) testCase {
			return testCase{"650-123-4567", "+16501234567", nil}
		},
		"us-dashes-format-national": func(dt *phonenumber.DataType) testCase {
			dt.WithFormat(phonenumbers.NATIONAL)
			return testCase{"650-123-4567", "(650) 123-4567", nil}
		},
		"us-national-input": func(dt *phonenumber.DataType) testCase {
			return testCase{"(650)-123-4567", "+16501234567", nil}
		},
		"us-national-input-correct": func(dt *phonenumber.DataType) testCase {
			return testCase{"(650) 123-4567", "+16501234567", nil}
		},
		"us-national-input-output": func(dt *phonenumber.DataType) testCase {
			dt.WithFormat(phonenumbers.NATIONAL)
			return testCase{"(650) 123-4567", "(650) 123-4567", nil}
		},
		"us-national-input-output-international": func(dt *phonenumber.DataType) testCase {
			dt.WithFormat(phonenumbers.INTERNATIONAL)
			return testCase{"(650) 123-4567", "+1 650-123-4567", nil}
		},
		"us-RFC3966": func(dt *phonenumber.DataType) testCase {
			dt.WithFormat(phonenumbers.RFC3966)
			return testCase{"6501234567", "tel:+1-650-123-4567", nil}
		},
		"gb-region": func(dt *phonenumber.DataType) testCase {
			dt.WithDefaultRegion("GB")
			return testCase{"07911 123456", "+447911123456", nil}
		},
		"gb-region-international": func(dt *phonenumber.DataType) testCase {
			dt.WithDefaultRegion("GB").WithFormat(phonenumbers.INTERNATIONAL)
			return testCase{"07911 123456", "+44 7911 123456", nil}
		},
		"gb-region-national": func(dt *phonenumber.DataType) testCase {
			dt.WithDefaultRegion("GB").WithFormat(phonenumbers.NATIONAL)
			return testCase{"07911 123456", "07911 123456", nil}
		},
		"gb-region-RFC3966": func(dt *phonenumber.DataType) testCase {
			dt.WithDefaultRegion("GB").WithFormat(phonenumbers.RFC3966)
			return testCase{"07911 123456", "tel:+44-7911-123456", nil}
		},
		"gbnumber-us-region": func(dt *phonenumber.DataType) testCase {
			return testCase{"+44 07911 123456", "+447911123456", nil}
		},
		"gbnumber-us-region-international": func(dt *phonenumber.DataType) testCase {
			dt.WithFormat(phonenumbers.INTERNATIONAL)
			return testCase{"+44 07911 123456", "+44 7911 123456", nil}
		},
		"gbnumber-us-region-national": func(dt *phonenumber.DataType) testCase {
			dt.WithFormat(phonenumbers.NATIONAL)
			return testCase{"+44 07911 123456", "07911 123456", nil}
		},
		"gbnumber-us-region-RFC3966": func(dt *phonenumber.DataType) testCase {
			dt.WithDefaultRegion("GB").WithFormat(phonenumbers.RFC3966)
			return testCase{"+44 07911 123456", "tel:+44-7911-123456", nil}
		},
		"uk-region": func(dt *phonenumber.DataType) testCase {
			dt.WithDefaultRegion("UK")
			return testCase{"+44 07911 123456", "+447911123456", nil}
		},
		"invalid-region": func(dt *phonenumber.DataType) testCase {
			dt.WithDefaultRegion("MADEUP")
			return testCase{"07911 123456", "", errors.New("invalid country code")}
		},
		// apparently, invalid region with correct number + code combo is fine
		"invalid-region-with-valid-format": func(dt *phonenumber.DataType) testCase {
			dt.WithDefaultRegion("MADEUP")
			return testCase{"+44 07911 123456", "+447911123456", nil}
		},
		"us-obvi-invalid-number": func(dt *phonenumber.DataType) testCase {
			return testCase{"1", "", errors.New("phone number supplied is not a number")}
		},
		"us-invalid-number-for-region": func(dt *phonenumber.DataType) testCase {
			return testCase{"07911 123456", "+107911123456", nil}
		},
		"us-invalid-number-for-region-validate": func(dt *phonenumber.DataType) testCase {
			dt.ValidateForRegion()
			return testCase{"07911 123456", "", errors.New("invalid number for region")}
		},
		"gb-invalid-number-for-region": func(dt *phonenumber.DataType) testCase {
			dt.WithDefaultRegion("GB")
			return testCase{"6501234567", "+446501234567", nil}
		},
		"gb-invalid-number-for-region-validate": func(dt *phonenumber.DataType) testCase {
			dt.WithDefaultRegion("GB").ValidateForRegion()
			return testCase{"6501234567", "", errors.New("invalid number for region")}
		},
	}

	// *just* similar enough with datatype_test and email_test
	for key, fn := range testCases {
		t.Run(key, func(t *testing.T) {
			dt := phonenumber.Type()

			expRes := fn(dt)

			err := dt.Valid(expRes.input)
			if expRes.err == nil {
				require.Nil(t, err)
				res, err := dt.Format(expRes.input)
				require.Nil(t, err)
				require.Equal(t, expRes.output, res)
			} else {
				require.NotNil(t, err)
				require.Condition(t, func() bool {
					return strings.Contains(err.Error(), expRes.err.Error())
				})
			}
		})
	}
}
