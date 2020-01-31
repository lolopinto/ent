package field_test

import (
	"encoding/json"
	"errors"
	"net/url"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/lolopinto/ent/ent/field"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type testCase struct {
	value        interface{}
	result       interface{}
	err          error
	validationFn func(*testCase)
	pkgPath      string
}

func TestString(t *testing.T) {
	testCases := map[string]func(dt *field.StringDataType) testCase{
		"base_case": func(dt *field.StringDataType) testCase {
			return testCase{
				value:  "test",
				result: "test",
			}
		},
		"ToLower": func(dt *field.StringDataType) testCase {
			dt.ToLower()
			return testCase{
				value:  "UPPER CASE",
				result: "upper case",
			}
		},
		"ToLowerNoChange": func(dt *field.StringDataType) testCase {
			dt.ToLower()
			return testCase{
				value:  "lower case",
				result: "lower case",
			}
		},
		"ToUpper": func(dt *field.StringDataType) testCase {
			dt.ToUpper()
			return testCase{
				value:  "upper case",
				result: "UPPER CASE",
			}
		},
		"ToUpperNoChange": func(dt *field.StringDataType) testCase {
			dt.ToUpper()
			return testCase{
				value:  "UPPER CASE",
				result: "UPPER CASE",
			}
		},
		"Title": func(dt *field.StringDataType) testCase {
			dt.Title()
			return testCase{
				value:  "hello, world",
				result: "Hello, World",
			}
		},
		"TitleNoChange": func(dt *field.StringDataType) testCase {
			dt.Title()
			return testCase{
				value:  "Hello, WORLD",
				result: "Hello, WORLD",
			}
		},
		"TrimSpace": func(dt *field.StringDataType) testCase {
			dt.TrimSpace()
			return testCase{
				value:  " test@email.com ",
				result: "test@email.com",
			}
		},
		"TrimSpaceNoChange": func(dt *field.StringDataType) testCase {
			dt.ToLower()
			return testCase{
				value:  "no space",
				result: "no space",
			}
		},
		"TrimAndLower": func(dt *field.StringDataType) testCase {
			// shows combination of formats
			dt.ToLower().TrimSpace()
			return testCase{
				value:  " TEST@email.com ",
				result: "test@email.com",
			}
		},
		"NotEmpty": func(dt *field.StringDataType) testCase {
			dt.NotEmpty()
			return testCase{
				value:  "",
				result: "",
				err:    errors.New("minimum"),
			}
		},
		"NotEmptyValid": func(dt *field.StringDataType) testCase {
			dt.NotEmpty()
			return testCase{
				value:  "test",
				result: "test",
			}
		},
		"MinLen": func(dt *field.StringDataType) testCase {
			dt.MinLen(6)
			return testCase{
				value:  "seven",
				result: "seven",
				err:    errors.New("minimum"),
			}
		},
		"MinLenValid": func(dt *field.StringDataType) testCase {
			dt.MinLen(6)
			return testCase{
				value:  "more than six",
				result: "more than six",
			}
		},
		"MaxLen": func(dt *field.StringDataType) testCase {
			dt.MaxLen(20)
			return testCase{
				value:  "this sentence is too long and will result in error",
				result: "this sentence is too long and will result in error",
				err:    errors.New("maximum"),
			}
		},
		"MaxLenValid": func(dt *field.StringDataType) testCase {
			dt.MaxLen(20)
			return testCase{
				value:  "valid",
				result: "valid",
			}
		},
		"Length": func(dt *field.StringDataType) testCase {
			dt.Length(5)
			return testCase{
				value:  "94114-2324",
				result: "94114-2324",
				err:    errors.New("length"),
			}
		},
		"LegnthValid": func(dt *field.StringDataType) testCase {
			dt.Length(5)
			return testCase{
				value:  "94114",
				result: "94114",
			}
		},
		"MinLenMaxLen": func(dt *field.StringDataType) testCase {
			dt.MinLen(8).MaxLen(20)
			return testCase{
				value:  "bad password",
				result: "bad password",
			}
		},
		"MinLenMaxLenShort": func(dt *field.StringDataType) testCase {
			dt.MinLen(8).MaxLen(20)
			return testCase{
				value:  "94114",
				result: "94114",
				err:    errors.New("minimum"),
			}
		},
		"MinLenMaxLenLong": func(dt *field.StringDataType) testCase {
			dt.MinLen(8).MaxLen(20)
			return testCase{
				value:  "this sentence is too long",
				result: "this sentence is too long",
				err:    errors.New("maximum"),
			}
		},
		"Match": func(dt *field.StringDataType) testCase {
			r := regexp.MustCompile(`^[a-zA-Z0-9_-]{5,20}$`)
			dt.Match(r)
			return testCase{
				value:  "$username",
				result: "$username",
				err:    errors.New("match"),
			}
		},
		"MatchValid": func(dt *field.StringDataType) testCase {
			r := regexp.MustCompile(`^[a-zA-Z0-9_-]{5,20}$`)
			dt.Match(r)
			return testCase{
				value:  "username",
				result: "username",
			}
		},
		"DoesNotMatch": func(dt *field.StringDataType) testCase {
			r := regexp.MustCompile(`^[a-zA-Z0-9_-]{5,20}$`)
			dt.DoesNotMatch(r)
			return testCase{
				value:  "username",
				result: "username",
				err:    errors.New("matches"),
			}
		},
		"DoesNotMatchValid": func(dt *field.StringDataType) testCase {
			r := regexp.MustCompile(`^[a-zA-Z0-9_-]{5,20}$`)
			dt.DoesNotMatch(r)
			return testCase{
				value:  "$username",
				result: "$username",
			}
		},
	}

	for key, tt := range testCases {
		dt := field.StringType()
		expRes := tt(dt)
		testDataType(t, key, dt, expRes, "")
	}
}

func TestInt(t *testing.T) {
	testCases := map[string]func(dt *field.IntDataType) testCase{
		"base_case": func(dt *field.IntDataType) testCase {
			return testCase{
				value:  4,
				result: 4,
			}
		},
		"Positive": func(dt *field.IntDataType) testCase {
			dt.Positive()
			return testCase{
				value:  -1,
				result: -1,
				err:    errors.New("minimum"),
			}
		},
		"PositiveValid": func(dt *field.IntDataType) testCase {
			dt.Positive()
			return testCase{
				value:  1,
				result: 1,
			}
		},
		"Negative": func(dt *field.IntDataType) testCase {
			dt.Negative()
			return testCase{
				value:  10,
				result: 10,
				err:    errors.New("maximum"),
			}
		},
		"NegativeValid": func(dt *field.IntDataType) testCase {
			dt.Negative()
			return testCase{
				value:  -15,
				result: -15,
			}
		},
		"Min": func(dt *field.IntDataType) testCase {
			dt.Min(50)
			return testCase{
				value:  10,
				result: 10,
				err:    errors.New("minimum"),
			}
		},
		"MinValid": func(dt *field.IntDataType) testCase {
			dt.Min(50)
			return testCase{
				value:  50,
				result: 50,
			}
		},
		"Max": func(dt *field.IntDataType) testCase {
			dt.Max(15)
			return testCase{
				value:  30,
				result: 30,
				err:    errors.New("maximum"),
			}
		},
		"MaxValid": func(dt *field.IntDataType) testCase {
			dt.Max(10)
			return testCase{
				value:  -15,
				result: -15,
			}
		},
		"RangeMinIncorrect": func(dt *field.IntDataType) testCase {
			dt.Min(10).Max(20)
			return testCase{
				value:  9,
				result: 9,
				err:    errors.New("minimum"),
			}
		},
		"RangeMaxIncorrect": func(dt *field.IntDataType) testCase {
			dt.Min(10).Max(20)
			return testCase{
				value:  30,
				result: 30,
				err:    errors.New("maximum"),
			}
		},
		"RangeValid": func(dt *field.IntDataType) testCase {
			dt.Min(10).Max(20)
			return testCase{
				value:  15,
				result: 15,
			}
		},
	}

	for key, tt := range testCases {
		dt := field.IntType()
		expRes := tt(dt)
		testDataType(t, key, dt, expRes, 0)
	}
}

func TestFloat(t *testing.T) {
	testCases := map[string]func(dt *field.FloatDataType) testCase{
		"base_case": func(dt *field.FloatDataType) testCase {
			return testCase{
				value:  4.0,
				result: 4.0,
			}
		},
		"Positive": func(dt *field.FloatDataType) testCase {
			dt.Positive()
			return testCase{
				value:  -1,
				result: -1,
				err:    errors.New("minimum"),
			}
		},
		"PositiveValid": func(dt *field.FloatDataType) testCase {
			dt.Positive()
			return testCase{
				value:  1.0,
				result: 1.0,
			}
		},
		"Negative": func(dt *field.FloatDataType) testCase {
			dt.Negative()
			return testCase{
				value:  10.0,
				result: 10.0,
				err:    errors.New("maximum"),
			}
		},
		"NegativeValid": func(dt *field.FloatDataType) testCase {
			dt.Negative()
			return testCase{
				value:  -15.0,
				result: -15.0,
			}
		},
		"Min": func(dt *field.FloatDataType) testCase {
			dt.Min(50.0)
			return testCase{
				value:  10.3,
				result: 10.3,
				err:    errors.New("minimum"),
			}
		},
		"MinValid": func(dt *field.FloatDataType) testCase {
			dt.Min(50.23)
			return testCase{
				value:  50.23,
				result: 50.23,
			}
		},
		"Max": func(dt *field.FloatDataType) testCase {
			dt.Max(15.42)
			return testCase{
				value:  30.2,
				result: 30.2,
				err:    errors.New("maximum"),
			}
		},
		"MaxValid": func(dt *field.FloatDataType) testCase {
			dt.Max(10.23)
			return testCase{
				value:  -15.2323,
				result: -15.2323,
			}
		},
		"RangeMinIncorrect": func(dt *field.FloatDataType) testCase {
			dt.Min(10.12).Max(20.21)
			return testCase{
				value:  9.24,
				result: 9.24,
				err:    errors.New("minimum"),
			}
		},
		"RangeMaxIncorrect": func(dt *field.FloatDataType) testCase {
			dt.Min(10.23).Max(20.23)
			return testCase{
				value:  30.12,
				result: 30.12,
				err:    errors.New("maximum"),
			}
		},
		"RangeValid": func(dt *field.FloatDataType) testCase {
			dt.Min(10.23).Max(20.23)
			return testCase{
				value:  15,
				result: 15,
			}
		},
	}

	for key, tt := range testCases {
		dt := field.FloatType()
		expRes := tt(dt)
		testDataType(t, key, dt, expRes, 0.0)
	}
}

func TestTime(t *testing.T) {
	timesEqualFn := func(expRes *testCase) {
		val := expRes.value.(time.Time)
		res := expRes.result.(time.Time)

		assert.NotNil(t, val.Location())
		assert.NotNil(t, res.Location())

		assert.Equal(t, time.UTC, res.Location())

		// validate times are equal even though timezones may not be because of UTC vs local
		assert.True(t, val.Equal(res))
	}

	testCases := map[string]func() (field.DataType, testCase){
		"base_case": func() (field.DataType, testCase) {
			dt := field.TimeType()

			tv := time.Now()
			return dt, testCase{
				value:        tv,
				result:       tv.UTC(),
				validationFn: timesEqualFn,
				pkgPath:      "time",
			}
		},
		"base_caseDifferentTimezone": func() (field.DataType, testCase) {
			dt := field.TimeType()

			loc, err := time.LoadLocation("America/New_York")
			assert.Nil(t, err)
			tv := time.Date(2020, time.January, 1, 0, 0, 0, 0, loc)

			return dt, testCase{
				value:        tv,
				result:       tv.UTC(),
				validationFn: timesEqualFn,
				pkgPath:      "time",
			}
		},
		"Add": func() (field.DataType, testCase) {
			dt := field.TimeType().Add(3 * time.Hour)

			now := time.Now()

			return dt, testCase{
				value:   now,
				result:  now.Add(3 * time.Hour).UTC(),
				pkgPath: "time",
				validationFn: func(expRes *testCase) {
					res := expRes.result.(time.Time)
					assert.True(t, now.Before(res))
				},
			}
		},
		"AddNegative": func() (field.DataType, testCase) {
			dt := field.TimeType().Add(-3 * time.Hour)

			now := time.Now()

			return dt, testCase{
				value:   now,
				result:  now.Add(-3 * time.Hour).UTC(),
				pkgPath: "time",
				validationFn: func(expRes *testCase) {
					res := expRes.result.(time.Time)
					assert.True(t, now.After(res))
				},
			}
		},
		"Round": func() (field.DataType, testCase) {
			dt := field.TimeType().Round(1 * time.Hour)

			loc, err := time.LoadLocation("America/New_York")
			assert.Nil(t, err)
			// 9:30AM
			tv := time.Date(2020, time.January, 1, 9, 30, 0, 0, loc)

			return dt, testCase{
				value:   tv,
				result:  tv.Round(time.Hour).UTC(),
				pkgPath: "time",
				validationFn: func(expRes *testCase) {
					res := expRes.result.(time.Time)
					// rounds up to 10AM local
					assert.True(t, res.Equal(time.Date(2020, time.January, 1, 10, 0, 0, 0, loc)))

					assert.Equal(t, time.UTC, res.Location())
				},
			}
		},
		"Truncate": func() (field.DataType, testCase) {
			dt := field.TimeType().Truncate(1 * time.Hour)

			loc, err := time.LoadLocation("America/New_York")
			assert.Nil(t, err)
			// 9:30AM
			tv := time.Date(2020, time.January, 1, 9, 29, 0, 0, loc)

			return dt, testCase{
				value:   tv,
				result:  tv.Round(time.Hour).UTC(),
				pkgPath: "time",
				validationFn: func(expRes *testCase) {
					res := expRes.result.(time.Time)
					// truncates down to 9AM local
					assert.True(t, res.Equal(time.Date(2020, time.January, 1, 9, 0, 0, 0, loc)))

					assert.Equal(t, time.UTC, res.Location())
				},
			}
		},
		"FutureDate": func() (field.DataType, testCase) {
			dt := field.TimeType().FutureDate()

			// 1/1/2020
			tv := time.Date(2020, time.January, 1, 1, 0, 0, 0, time.UTC)

			return dt, testCase{
				value:   tv,
				result:  tv.UTC(),
				pkgPath: "time",
				err:     errors.New("after"),
			}
		},
		"FutureDateValid": func() (field.DataType, testCase) {
			dt := field.TimeType().FutureDate()

			tv := time.Now().Add(5 * time.Hour)

			return dt, testCase{
				value:   tv,
				pkgPath: "time",
				result:  tv.UTC(),
			}
		},
		"PastDate": func() (field.DataType, testCase) {
			dt := field.TimeType().PastDate()

			tv := time.Now().Add(5 * time.Hour)

			return dt, testCase{
				value:   tv,
				result:  tv.UTC(),
				pkgPath: "time",
				err:     errors.New("before"),
			}
		},
		"PastDateValid": func() (field.DataType, testCase) {
			dt := field.TimeType().PastDate()

			tv := time.Now().Add(-5 * time.Hour)

			return dt, testCase{
				value:   tv,
				result:  tv.UTC(),
				pkgPath: "time",
			}
		},
		"WithinFuture": func() (field.DataType, testCase) {
			// time needs to be within the next 30 days
			dt := field.TimeType().Within(30 * 24 * time.Hour)

			tv := time.Now().Add(41 * 24 * time.Hour)

			return dt, testCase{
				value:   tv,
				result:  tv.UTC(),
				pkgPath: "time",
				err:     errors.New("within"),
			}
		},
		"WithinFutureValid": func() (field.DataType, testCase) {
			// time needs to be within the next 30 days
			dt := field.TimeType().Within(30 * 24 * time.Hour)

			tv := time.Now().Add(5 * time.Hour)

			return dt, testCase{
				value:   tv,
				result:  tv.UTC(),
				pkgPath: "time",
			}
		},
		"WithinPast": func() (field.DataType, testCase) {
			// time needs to be within the past 7 days
			dt := field.TimeType().Within(-7 * 24 * time.Hour)

			tv := time.Now().Add(-10 * 24 * time.Hour)

			return dt, testCase{
				value:   tv,
				result:  tv.UTC(),
				pkgPath: "time",
				err:     errors.New("within"),
			}
		},
		"WithinPastValid": func() (field.DataType, testCase) {
			// time needs to be within the past 7 days
			dt := field.TimeType().Within(-7 * 24 * time.Hour)

			tv := time.Now().Add(-5 * 24 * time.Hour)

			return dt, testCase{
				value:   tv,
				pkgPath: "time",
				result:  tv.UTC(),
			}
		},
		"WithinRangePastIncorrect": func() (field.DataType, testCase) {
			// time needs to be within +/- 2 weeks
			dt := field.TimeType().Within(-14 * 24 * time.Hour).Within(14 * 24 * time.Hour)

			tv := time.Now().Add(-15 * 24 * time.Hour)

			return dt, testCase{
				value:   tv,
				result:  tv.UTC(),
				pkgPath: "time",
				err:     errors.New("within"),
			}
		},
		"WithinRangeFutureIncorrect": func() (field.DataType, testCase) {
			// time needs to be within +/- 2 weeks
			dt := field.TimeType().Within(-14 * 24 * time.Hour).Within(14 * 24 * time.Hour)

			tv := time.Now().Add(15 * 24 * time.Hour)

			return dt, testCase{
				value:   tv,
				result:  tv.UTC(),
				pkgPath: "time",
				err:     errors.New("within"),
			}
		},
		"WithinRangeValid": func() (field.DataType, testCase) {
			// time needs to be within +/- 2 weeks
			dt := field.TimeType().Within(-14 * 24 * time.Hour).Within(14 * 24 * time.Hour)

			tv := time.Now().Add(1 * 24 * time.Hour)

			return dt, testCase{
				value:   tv,
				result:  tv.UTC(),
				pkgPath: "time",
			}
		},
		"LocalTimezone": func() (field.DataType, testCase) {
			// we want local time for some reason
			dt := field.TimeType().Formatter(func(t time.Time) time.Time {
				return t.Local()
			})

			now := time.Now()

			return dt, testCase{
				value:   now,
				result:  now.Local(),
				pkgPath: "time",
				validationFn: func(expRes *testCase) {
					res := expRes.result.(time.Time)
					assert.Equal(t, res.Location(), time.Local)
				},
			}
		},
	}

	for key, tt := range testCases {
		dt, expRes := tt()
		testDataType(t, key, dt, expRes, time.Time{})
	}
}

func TestJSON(t *testing.T) {
	testCases := map[string]func() (field.DataType, testCase){
		"ints": func() (field.DataType, testCase) {
			dt := field.IntsType()

			val := []int{1, 2, 3, 4, 5}
			res, err := json.Marshal(val)
			assert.Nil(t, err)
			return dt, testCase{
				value:  val,
				result: res,
			}
		},
		"intsTypeNotEnforced": func() (field.DataType, testCase) {
			dt := field.IntsType()

			val := []string{"1", "2", "3", "4", "5"}
			res, err := json.Marshal(val)
			assert.Nil(t, err)
			return dt, testCase{
				value:  val,
				result: res,
			}
		},
		"intsTypeEnforced": func() (field.DataType, testCase) {
			dt := field.IntsType().EnforceType()

			val := []string{"1", "2", "3", "4", "5"}
			res, err := json.Marshal(val)
			assert.Nil(t, err)
			return dt, testCase{
				value:  val,
				result: res,
				err:    errors.New("type"),
			}
		},
		"intsTypeEnforcedValid": func() (field.DataType, testCase) {
			dt := field.IntsType().EnforceType()

			val := []int{1, 2, 3, 4, 5}
			res, err := json.Marshal(val)
			assert.Nil(t, err)
			return dt, testCase{
				value:  val,
				result: res,
			}
		},
		"strings": func() (field.DataType, testCase) {
			dt := field.StringsType()

			val := []string{"1", "2", "3", "4", "5"}
			res, err := json.Marshal(val)
			assert.Nil(t, err)
			return dt, testCase{
				value:  val,
				result: res,
			}
		},
		"floats": func() (field.DataType, testCase) {
			dt := field.FloatsType()

			val := []float64{1, 2, 3, 4, 5}
			res, err := json.Marshal(val)
			assert.Nil(t, err)
			return dt, testCase{
				value:  val,
				result: res,
			}
		},
		"scalar": func() (field.DataType, testCase) {
			// works for scalars even when there's no reason to do so
			dt := field.JSONType("")

			val := "mango"
			res, err := json.Marshal(val)
			assert.Nil(t, err)
			return dt, testCase{
				value:  val,
				result: res,
			}
		},
		"obj": func() (field.DataType, testCase) {
			dt := field.JSONType(json.RawMessage{}).EnforceType()

			val := json.RawMessage(`{"precomputed": true}`)

			res, err := json.Marshal(val)
			assert.Nil(t, err)
			return dt, testCase{
				value:   val,
				result:  res,
				pkgPath: "encoding/json",
			}
		},
		"objPointer": func() (field.DataType, testCase) {
			dt := field.JSONType(&json.RawMessage{}).EnforceType()

			val := json.RawMessage(`{"precomputed": true}`)

			res, err := json.Marshal(val)
			assert.Nil(t, err)
			return dt, testCase{
				value:   &val,
				result:  res,
				pkgPath: "encoding/json",
			}
		},
		"listofObject": func() (field.DataType, testCase) {
			dt := field.JSONType([]json.RawMessage{}).EnforceType()

			val := []json.RawMessage{
				json.RawMessage(`{"precomputed": true}`),
			}

			res, err := json.Marshal(val)
			assert.Nil(t, err)
			return dt, testCase{
				value:   val,
				result:  res,
				pkgPath: "encoding/json",
			}
		},
		"map": func() (field.DataType, testCase) {
			dt := field.JSONType(map[string]string{}).EnforceType()

			val := map[string]string{
				"dog": "puppy",
				"cat": "kitten",
			}

			res, err := json.Marshal(val)
			assert.Nil(t, err)

			return dt, testCase{
				value:  val,
				result: res,
			}
		},
		"mapToObj": func() (field.DataType, testCase) {
			dt := field.JSONType(map[string]*url.URL{}).EnforceType()

			wiki, err := url.Parse("https://www.wikipedia.org/")
			assert.Nil(t, err)
			github, err := url.Parse("https://github.com/")
			assert.Nil(t, err)
			val := map[string]*url.URL{
				"wikipedia": wiki,
				"github":    github,
			}

			res, err := json.Marshal(val)
			assert.Nil(t, err)

			return dt, testCase{
				value:   val,
				result:  res,
				pkgPath: "net/url",
			}
		},
		"listOfObjPointers": func() (field.DataType, testCase) {
			// honestly better to store []strings and decode at runtime for this because it's more compact
			// this is why Url will not use JSON but do things in goland as needed
			dt := field.JSONType([]*url.URL{}).EnforceType()

			wiki, err := url.Parse("https://www.wikipedia.org/")
			assert.Nil(t, err)
			github, err := url.Parse("https://github.com/")
			assert.Nil(t, err)
			val := []*url.URL{wiki, github}

			res, err := json.Marshal(val)
			assert.Nil(t, err)

			return dt, testCase{
				value:   val,
				result:  res,
				pkgPath: "net/url",
			}
		},
	}

	for key, tt := range testCases {
		dt, expRes := tt()
		testDataType(t, key, dt, expRes, "")
	}
}

func testDataType(
	t *testing.T,
	key string,
	dt field.DataType,
	expRes testCase,
	typ interface{},
) {
	t.Run(key, func(t *testing.T) {

		validator, ok := dt.(field.Validator)
		if ok {
			err := validator.Valid(expRes.value)
			if expRes.err == nil {
				require.Nil(t, err)
			} else {
				require.NotNil(t, err)

				require.Condition(t, func() bool {
					return strings.Contains(err.Error(), expRes.err.Error())
				})
			}
		}

		formatter, ok := dt.(field.Formatter)
		if ok {
			result, err := formatter.Format(expRes.value)
			assert.Nil(t, err)
			assert.Equal(t, expRes.result, result)
		}

		assert.Equal(t, typ, dt.Type())

		if expRes.validationFn != nil {
			expRes.validationFn(&expRes)
		}

		importable, ok := dt.(field.ImportableDataType)
		if ok {
			pkgPath := importable.PkgPath()
			assert.Equal(t, expRes.pkgPath, pkgPath)
		}
	})
}
