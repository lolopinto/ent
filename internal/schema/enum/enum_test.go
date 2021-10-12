package enum

import (
	"strconv"
	"testing"

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
	gqlKeys := []string{
		"ARE_FRIENDS",
		"OUTGOING_FRIEND_REQUEST",
		"INCOMING_FRIEND_REQUEST",
		"CAN_SEND_REQUEST",
		"CANNOT_REQUEST",
	}

	typ := "FriendshipStatus"
	tsEnum, gqlEnum := GetEnums(&Input{
		TSName:  typ,
		GQLName: typ,
		GQLType: typ,
		Values:  values,
	})
	require.NotNil(t, tsEnum)
	assert.Equal(t, tsEnum.Name, typ)
	assert.Equal(t, tsEnum.Values, getValues(values))
	assert.Equal(t, tsEnum.Imported, false)

	require.NotNil(t, gqlEnum)
	assert.Equal(t, gqlEnum.Name, typ)
	assert.Equal(t, gqlEnum.Type, typ)
	assert.Equal(t, gqlEnum.Values, getGQLValues(values, gqlKeys))
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
	require.NotNil(t, tsEnum)
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
	})
	assert.Equal(t, tsEnum.Imported, false)

	require.NotNil(t, gqlEnum)
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
	})
}

func getValues(values []string) []Data {
	ret := make([]Data, len(values))
	for k, v := range values {
		ret[k] = Data{
			Name:  GetTSEnumNameForVal(v),
			Value: strconv.Quote(v),
		}
	}
	return ret
}

func getGQLValues(values, keys []string) []Data {
	ret := make([]Data, len(values))
	for k, v := range values {
		ret[k] = Data{
			Name:  keys[k],
			Value: strconv.Quote(v),
		}
	}
	return ret
}
