package field_test

import (
	"errors"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/lolopinto/ent/ent/field"
	"github.com/stretchr/testify/assert"
)

type testCase struct {
	value        interface{}
	result       interface{}
	err          error
	validationFn func(*testCase)
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
			dt.Length(5)
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
		expRes := tt(dt)
		testDataType(t, key, dt, expRes, "")
	}
}

func TestInt(t *testing.T) {
	testCases := map[string]func(dt *field.IntegerType) testCase{
		"base_case": func(dt *field.IntegerType) testCase {
			return testCase{
				value:  4,
				result: 4,
			}
		},
		"Positive": func(dt *field.IntegerType) testCase {
			dt.Positive()
			return testCase{
				value:  -1,
				result: -1,
				err:    errors.New("minimum"),
			}
		},
		"PositiveValid": func(dt *field.IntegerType) testCase {
			dt.Positive()
			return testCase{
				value:  1,
				result: 1,
			}
		},
		"Negative": func(dt *field.IntegerType) testCase {
			dt.Negative()
			return testCase{
				value:  10,
				result: 10,
				err:    errors.New("maximum"),
			}
		},
		"NegativeValid": func(dt *field.IntegerType) testCase {
			dt.Negative()
			return testCase{
				value:  -15,
				result: -15,
			}
		},
		"Min": func(dt *field.IntegerType) testCase {
			dt.Min(50)
			return testCase{
				value:  10,
				result: 10,
				err:    errors.New("minimum"),
			}
		},
		"MinValid": func(dt *field.IntegerType) testCase {
			dt.Min(50)
			return testCase{
				value:  50,
				result: 50,
			}
		},
		"Max": func(dt *field.IntegerType) testCase {
			dt.Max(15)
			return testCase{
				value:  30,
				result: 30,
				err:    errors.New("maximum"),
			}
		},
		"MaxValid": func(dt *field.IntegerType) testCase {
			dt.Max(10)
			return testCase{
				value:  -15,
				result: -15,
			}
		},
		"RangeMinIncorrect": func(dt *field.IntegerType) testCase {
			dt.Min(10).Max(20)
			return testCase{
				value:  9,
				result: 9,
				err:    errors.New("minimum"),
			}
		},
		"RangeMaxIncorrect": func(dt *field.IntegerType) testCase {
			dt.Min(10).Max(20)
			return testCase{
				value:  30,
				result: 30,
				err:    errors.New("maximum"),
			}
		},
		"RangeValid": func(dt *field.IntegerType) testCase {
			dt.Min(10).Max(20)
			return testCase{
				value:  15,
				result: 15,
			}
		},
	}

	for key, tt := range testCases {
		dt := field.Int()
		expRes := tt(dt)
		testDataType(t, key, dt, expRes, 0)
	}
}

func TestFloat(t *testing.T) {
	testCases := map[string]func(dt *field.FloatType) testCase{
		"base_case": func(dt *field.FloatType) testCase {
			return testCase{
				value:  4.0,
				result: 4.0,
			}
		},
		"Positive": func(dt *field.FloatType) testCase {
			dt.Positive()
			return testCase{
				value:  -1,
				result: -1,
				err:    errors.New("minimum"),
			}
		},
		"PositiveValid": func(dt *field.FloatType) testCase {
			dt.Positive()
			return testCase{
				value:  1.0,
				result: 1.0,
			}
		},
		"Negative": func(dt *field.FloatType) testCase {
			dt.Negative()
			return testCase{
				value:  10.0,
				result: 10.0,
				err:    errors.New("maximum"),
			}
		},
		"NegativeValid": func(dt *field.FloatType) testCase {
			dt.Negative()
			return testCase{
				value:  -15.0,
				result: -15.0,
			}
		},
		"Min": func(dt *field.FloatType) testCase {
			dt.Min(50.0)
			return testCase{
				value:  10.3,
				result: 10.3,
				err:    errors.New("minimum"),
			}
		},
		"MinValid": func(dt *field.FloatType) testCase {
			dt.Min(50.23)
			return testCase{
				value:  50.23,
				result: 50.23,
			}
		},
		"Max": func(dt *field.FloatType) testCase {
			dt.Max(15.42)
			return testCase{
				value:  30.2,
				result: 30.2,
				err:    errors.New("maximum"),
			}
		},
		"MaxValid": func(dt *field.FloatType) testCase {
			dt.Max(10.23)
			return testCase{
				value:  -15.2323,
				result: -15.2323,
			}
		},
		"RangeMinIncorrect": func(dt *field.FloatType) testCase {
			dt.Min(10.12).Max(20.21)
			return testCase{
				value:  9.24,
				result: 9.24,
				err:    errors.New("minimum"),
			}
		},
		"RangeMaxIncorrect": func(dt *field.FloatType) testCase {
			dt.Min(10.23).Max(20.23)
			return testCase{
				value:  30.12,
				result: 30.12,
				err:    errors.New("maximum"),
			}
		},
		"RangeValid": func(dt *field.FloatType) testCase {
			dt.Min(10.23).Max(20.23)
			return testCase{
				value:  15,
				result: 15,
			}
		},
	}

	for key, tt := range testCases {
		dt := field.Float()
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
			dt := field.Time()

			tv := time.Now()
			return dt, testCase{
				value:        tv,
				result:       tv.UTC(),
				validationFn: timesEqualFn,
			}
		},
		"base_caseDifferentTimezone": func() (field.DataType, testCase) {
			dt := field.Time()

			loc, err := time.LoadLocation("America/New_York")
			assert.Nil(t, err)
			tv := time.Date(2020, time.January, 1, 0, 0, 0, 0, loc)

			return dt, testCase{
				value:        tv,
				result:       tv.UTC(),
				validationFn: timesEqualFn,
			}
		},
		"Add": func() (field.DataType, testCase) {
			dt := field.Time().Add(3 * time.Hour)

			now := time.Now()

			return dt, testCase{
				value:  now,
				result: now.Add(3 * time.Hour).UTC(),
				validationFn: func(expRes *testCase) {
					res := expRes.result.(time.Time)
					assert.True(t, now.Before(res))
				},
			}
		},
		"AddNegative": func() (field.DataType, testCase) {
			dt := field.Time().Add(-3 * time.Hour)

			now := time.Now()

			return dt, testCase{
				value:  now,
				result: now.Add(-3 * time.Hour).UTC(),
				validationFn: func(expRes *testCase) {
					res := expRes.result.(time.Time)
					assert.True(t, now.After(res))
				},
			}
		},
		"Round": func() (field.DataType, testCase) {
			dt := field.Time().Round(1 * time.Hour)

			loc, err := time.LoadLocation("America/New_York")
			assert.Nil(t, err)
			// 9:30AM
			tv := time.Date(2020, time.January, 1, 9, 30, 0, 0, loc)

			return dt, testCase{
				value:  tv,
				result: tv.Round(time.Hour).UTC(),
				validationFn: func(expRes *testCase) {
					res := expRes.result.(time.Time)
					// rounds up to 10AM local
					assert.True(t, res.Equal(time.Date(2020, time.January, 1, 10, 0, 0, 0, loc)))

					assert.Equal(t, time.UTC, res.Location())
				},
			}
		},
		"Truncate": func() (field.DataType, testCase) {
			dt := field.Time().Truncate(1 * time.Hour)

			loc, err := time.LoadLocation("America/New_York")
			assert.Nil(t, err)
			// 9:30AM
			tv := time.Date(2020, time.January, 1, 9, 29, 0, 0, loc)

			return dt, testCase{
				value:  tv,
				result: tv.Round(time.Hour).UTC(),
				validationFn: func(expRes *testCase) {
					res := expRes.result.(time.Time)
					// truncates down to 9AM local
					assert.True(t, res.Equal(time.Date(2020, time.January, 1, 9, 0, 0, 0, loc)))

					assert.Equal(t, time.UTC, res.Location())
				},
			}
		},
		"FutureDate": func() (field.DataType, testCase) {
			dt := field.Time().FutureDate()

			// 1/1/2020
			tv := time.Date(2020, time.January, 1, 1, 0, 0, 0, time.UTC)

			return dt, testCase{
				value:  tv,
				result: tv.UTC(),
				err:    errors.New("after"),
			}
		},
		"FutureDateValid": func() (field.DataType, testCase) {
			dt := field.Time().FutureDate()

			tv := time.Now().Add(5 * time.Hour)

			return dt, testCase{
				value:  tv,
				result: tv.UTC(),
			}
		},
		"PastDate": func() (field.DataType, testCase) {
			dt := field.Time().PastDate()

			tv := time.Now().Add(5 * time.Hour)

			return dt, testCase{
				value:  tv,
				result: tv.UTC(),
				err:    errors.New("before"),
			}
		},
		"PastDateValid": func() (field.DataType, testCase) {
			dt := field.Time().PastDate()

			tv := time.Now().Add(-5 * time.Hour)

			return dt, testCase{
				value:  tv,
				result: tv.UTC(),
			}
		},
		"WithinFuture": func() (field.DataType, testCase) {
			// time needs to be within the next 30 days
			dt := field.Time().Within(30 * 24 * time.Hour)

			tv := time.Now().Add(41 * 24 * time.Hour)

			return dt, testCase{
				value:  tv,
				result: tv.UTC(),
				err:    errors.New("within"),
			}
		},
		"WithinFutureValid": func() (field.DataType, testCase) {
			// time needs to be within the next 30 days
			dt := field.Time().Within(30 * 24 * time.Hour)

			tv := time.Now().Add(5 * time.Hour)

			return dt, testCase{
				value:  tv,
				result: tv.UTC(),
			}
		},
		"WithinPast": func() (field.DataType, testCase) {
			// time needs to be within the past 7 days
			dt := field.Time().Within(-7 * 24 * time.Hour)

			tv := time.Now().Add(-10 * 24 * time.Hour)

			return dt, testCase{
				value:  tv,
				result: tv.UTC(),
				err:    errors.New("within"),
			}
		},
		"WithinPastValid": func() (field.DataType, testCase) {
			// time needs to be within the past 7 days
			dt := field.Time().Within(-7 * 24 * time.Hour)

			tv := time.Now().Add(-5 * 24 * time.Hour)

			return dt, testCase{
				value:  tv,
				result: tv.UTC(),
			}
		},
		"WithinRangePastIncorrect": func() (field.DataType, testCase) {
			// time needs to be within +/- 2 weeks
			dt := field.Time().Within(-14 * 24 * time.Hour).Within(14 * 24 * time.Hour)

			tv := time.Now().Add(-15 * 24 * time.Hour)

			return dt, testCase{
				value:  tv,
				result: tv.UTC(),
				err:    errors.New("within"),
			}
		},
		"WithinRangeFutureIncorrect": func() (field.DataType, testCase) {
			// time needs to be within +/- 2 weeks
			dt := field.Time().Within(-14 * 24 * time.Hour).Within(14 * 24 * time.Hour)

			tv := time.Now().Add(15 * 24 * time.Hour)

			return dt, testCase{
				value:  tv,
				result: tv.UTC(),
				err:    errors.New("within"),
			}
		},
		"WithinRangeValid": func() (field.DataType, testCase) {
			// time needs to be within +/- 2 weeks
			dt := field.Time().Within(-14 * 24 * time.Hour).Within(14 * 24 * time.Hour)

			tv := time.Now().Add(1 * 24 * time.Hour)

			return dt, testCase{
				value:  tv,
				result: tv.UTC(),
			}
		},
		"LocalTimezone": func() (field.DataType, testCase) {
			// we want local time for some reason
			dt := field.Time().Formatter(func(t time.Time) time.Time {
				return t.Local()
			})

			now := time.Now()

			return dt, testCase{
				value:  now,
				result: now.Local(),
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
				assert.Nil(t, err)
			} else {
				assert.NotNil(t, err)

				if err == nil {
					t.Fatal("failing here to prevent nil pointer dereference below")
				}
				assert.Condition(t, func() bool {
					return strings.Contains(err.Error(), expRes.err.Error())
				})
			}
		}

		formatter, ok := dt.(field.Formatter)
		if ok {
			assert.Equal(t, formatter.Format(expRes.value), expRes.result)
		}

		assert.Equal(t, typ, dt.Type())

		if expRes.validationFn != nil {
			expRes.validationFn(&expRes)
		}
	})
}
