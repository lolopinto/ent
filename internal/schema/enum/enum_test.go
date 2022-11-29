package enum

import (
	"strconv"
	"strings"
	"testing"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEnum(t *testing.T) {
	values := []string{
		"areFriends",
		"outgoingFriendRequest",
		"incomingFriendRequest",
		"canSendRequest",
		"cannotRequest",
	}

	typ := "FriendshipStatus"
	tsEnum, gqlEnum := GetEnums(&Input{
		TSName:  typ,
		GQLName: typ,
		GQLType: typ,
		Values:  values,
	})
	tsEnum2, gqlEnum2 := GetEnums(&Input{
		TSName:  typ,
		GQLName: typ,
		GQLType: typ,
		Values:  values,
	})
	require.NotNil(t, tsEnum)
	require.NotNil(t, tsEnum2)
	assert.Equal(t, tsEnum.Name, typ)
	assert.Equal(t, tsEnum.Values, getValues(values))
	assert.Equal(t, tsEnum.Imported, false)

	require.NotNil(t, gqlEnum)
	require.NotNil(t, gqlEnum2)
	assert.Equal(t, gqlEnum.Name, typ)
	assert.Equal(t, gqlEnum.Type, typ)
	assert.Equal(t, gqlEnum.Values, getGQLValues(values))

	assert.True(t, EnumEqual(tsEnum, tsEnum2))
	assert.True(t, GQLEnumEqual(gqlEnum, gqlEnum2))
}

func TestEnumMap(t *testing.T) {
	typ := "Language"
	tsEnum, gqlEnum := GetEnums(&Input{
		TSName:  typ,
		GQLName: typ,
		GQLType: typ,
		EnumMap: map[string]string{
			"Java":       "java",
			"CPlusPlus":  "c++",
			"CSharp":     "c#",
			"JavaScript": "js",
			"TypeScript": "ts",
			"GoLang":     "go",
			"Python":     "python",
		},
	})
	tsEnum2, gqlEnum2 := GetEnums(&Input{
		TSName:  typ,
		GQLName: typ,
		GQLType: typ,
		EnumMap: map[string]string{
			"Java":       "java",
			"CPlusPlus":  "c++",
			"CSharp":     "c#",
			"JavaScript": "js",
			"TypeScript": "ts",
			"GoLang":     "go",
			"Python":     "python",
		},
	})
	require.NotNil(t, tsEnum)
	require.NotNil(t, tsEnum2)
	assert.Equal(t, tsEnum.Name, typ)
	assert.Equal(t, tsEnum.Values, []Data{
		{
			Name:  "CPlusPlus",
			Value: strconv.Quote("c++"),
		},
		{
			Name:  "CSharp",
			Value: strconv.Quote("c#"),
		},
		{
			Name:  "GoLang",
			Value: strconv.Quote("go"),
		},
		{
			Name:  "Java",
			Value: strconv.Quote("java"),
		},
		{
			Name:  "JavaScript",
			Value: strconv.Quote("js"),
		},
		{
			Name:  "Python",
			Value: strconv.Quote("python"),
		},
		{
			Name:  "TypeScript",
			Value: strconv.Quote("ts"),
		},
		{
			Name:       "Unknown",
			Value:      strconv.Quote("%unknown%"),
			UnknownVal: true,
		},
	})
	assert.Equal(t, tsEnum.Imported, false)

	require.NotNil(t, gqlEnum)
	require.NotNil(t, gqlEnum2)
	assert.Equal(t, gqlEnum.Name, typ)
	assert.Equal(t, gqlEnum.Type, typ)
	assert.Equal(t, gqlEnum.Values, []Data{
		{
			Name:  "C_PLUS_PLUS",
			Value: strconv.Quote("c++"),
		},
		{
			Name:  "C_SHARP",
			Value: strconv.Quote("c#"),
		},
		{
			Name:  "GO_LANG",
			Value: strconv.Quote("go"),
		},
		{
			Name:  "JAVA",
			Value: strconv.Quote("java"),
		},
		{
			Name:  "JAVA_SCRIPT",
			Value: strconv.Quote("js"),
		},
		{
			Name:  "PYTHON",
			Value: strconv.Quote("python"),
		},
		{
			Name:  "TYPE_SCRIPT",
			Value: strconv.Quote("ts"),
		},
		{
			Name:       "UNKNOWN",
			Value:      strconv.Quote("%unknown%"),
			UnknownVal: true,
		},
	})

	assert.True(t, EnumEqual(tsEnum, tsEnum2))
	assert.True(t, GQLEnumEqual(gqlEnum, gqlEnum2))
}

func TestIntEnumMap(t *testing.T) {
	typ := "Status"
	tsEnum, gqlEnum := GetEnums(&Input{
		TSName:  typ,
		GQLName: typ,
		GQLType: typ,
		IntEnumMap: map[string]int{
			"VERIFIED":    1,
			"UNVERIFIED":  2,
			"DEACTIVATED": 3,
			"DISABLED":    4,
		},
	})
	tsEnum2, gqlEnum2 := GetEnums(&Input{
		TSName:  typ,
		GQLName: typ,
		GQLType: typ,
		IntEnumMap: map[string]int{
			"VERIFIED":    1,
			"UNVERIFIED":  2,
			"DEACTIVATED": 3,
			"DISABLED":    4,
		},
	})
	require.NotNil(t, tsEnum)
	require.NotNil(t, tsEnum2)
	assert.Equal(t, tsEnum.Name, typ)
	assert.Equal(t, tsEnum.Values, []Data{
		{
			Name:       "UNKNOWN",
			Value:      JS_MIN_SAFE_INT,
			UnknownVal: true,
		},
		{
			Name:  "VERIFIED",
			Value: 1,
		},
		{
			Name:  "UNVERIFIED",
			Value: 2,
		},
		{
			Name:  "DEACTIVATED",
			Value: 3,
		},
		{
			Name:  "DISABLED",
			Value: 4,
		},
	})
	assert.Equal(t, tsEnum.Imported, false)

	require.NotNil(t, gqlEnum)
	require.NotNil(t, gqlEnum2)
	assert.Equal(t, gqlEnum.Name, typ)
	assert.Equal(t, gqlEnum.Type, typ)
	assert.Equal(t, gqlEnum.Values, []Data{
		{
			Name:       "UNKNOWN",
			Value:      JS_MIN_SAFE_INT,
			UnknownVal: true,
		},
		{
			Name:  "VERIFIED",
			Value: 1,
		},
		{
			Name:  "UNVERIFIED",
			Value: 2,
		},
		{
			Name:  "DEACTIVATED",
			Value: 3,
		},
		{
			Name:  "DISABLED",
			Value: 4,
		},
	})

	assert.True(t, EnumEqual(tsEnum, tsEnum2))
	assert.True(t, GQLEnumEqual(gqlEnum, gqlEnum2))
}

func TestUnequalEnums(t *testing.T) {
	typ := "Language"
	tsEnum, gqlEnum := GetEnums(&Input{
		TSName:  typ,
		GQLName: typ,
		GQLType: typ,
		EnumMap: map[string]string{
			"Java":       "java",
			"CPlusPlus":  "c++",
			"CSharp":     "c#",
			"JavaScript": "js",
			"TypeScript": "ts",
			"GoLang":     "go",
			"Python":     "python",
		},
	})
	tsEnum2, gqlEnum2 := GetEnums(&Input{
		TSName:  typ,
		GQLName: typ,
		GQLType: typ,
		EnumMap: map[string]string{
			"Java":       "java",
			"CPlusPlus":  "c++",
			"CSharp":     "c#",
			"JavaScript": "js",
			"TypeScript": "ts",
			"GoLang":     "golang",
			"Python":     "python",
		},
	})
	require.NotNil(t, tsEnum)
	require.NotNil(t, tsEnum2)

	require.NotNil(t, gqlEnum)
	require.NotNil(t, gqlEnum2)

	assert.False(t, EnumEqual(tsEnum, tsEnum2))
	assert.False(t, GQLEnumEqual(gqlEnum, gqlEnum2))
}

func TestIntEnumNoValues(t *testing.T) {
	input, err := NewInputFromEnumType(&enttype.IntegerEnumType{}, false)
	require.Nil(t, input)
	require.Error(t, err)
}

func TestStringEnumNoValues(t *testing.T) {
	input, err := NewInputFromEnumType(&enttype.StringEnumType{}, false)
	require.Nil(t, input)
	require.Error(t, err)
}

func TestIntEnumWithValues(t *testing.T) {
	input, err := NewInputFromEnumType(&enttype.IntegerEnumType{
		EnumMap: map[string]int{
			"Foo": 0,
		},
	}, false)
	require.Nil(t, err)
	require.NotNil(t, input)
}

func TestStringEnumWithValues(t *testing.T) {
	input, err := NewInputFromEnumType(&enttype.StringEnumType{
		Values: []string{"hello"},
	}, false)
	require.Nil(t, err)
	require.NotNil(t, input)
}

func TestStringEnumWithMap(t *testing.T) {
	input, err := NewInputFromEnumType(&enttype.StringEnumType{
		EnumMap: map[string]string{"FOO": "f"},
	}, false)
	require.Nil(t, err)
	require.NotNil(t, input)
}

func TestFkeyEnumNoValues(t *testing.T) {
	input, err := NewInputFromEnumType(&enttype.StringEnumType{}, true)
	require.Nil(t, err)
	require.NotNil(t, input)
}

func getValues(values []string) []Data {
	ret := make([]Data, len(values))
	for k, v := range values {
		ret[k] = Data{
			Name:  GetTSEnumNameForVal(v),
			Value: strconv.Quote(v),
		}
	}
	return append(ret, Data{
		Name:       "Unknown",
		Value:      strconv.Quote("%Unknown%"),
		UnknownVal: true,
	})
}

func getGQLValues(values []string) []Data {
	ret := make([]Data, len(values))
	for k, v := range values {
		ret[k] = Data{
			Name:  strings.ToUpper(strcase.ToSnake(v)),
			Value: strconv.Quote(v),
		}
	}
	return append(ret, Data{
		Name:       "UNKNOWN",
		Value:      strconv.Quote("%Unknown%"),
		UnknownVal: true,
	})
}
