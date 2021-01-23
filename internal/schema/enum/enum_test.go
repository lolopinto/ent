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
	// this is converted to snake caps.
	expectedVals := []string{
		"ARE_FRIENDS",
		"OUTGOING_FRIEND_REQUEST",
		"INCOMING_FRIEND_REQUEST",
		"CAN_SEND_REQUEST",
		"CANNOT_REQUEST",
	}

	typ := "FriendshipStatus"
	tsEnum, gqlEnum := GetEnums(typ, typ, typ, values)
	require.NotNil(t, tsEnum)
	assert.Equal(t, tsEnum.Name, typ)
	assert.Equal(t, tsEnum.Values, getValues(values))
	assert.Equal(t, tsEnum.Imported, false)

	require.NotNil(t, gqlEnum)
	assert.Equal(t, gqlEnum.Name, typ)
	assert.Equal(t, gqlEnum.Type, typ)
	assert.Equal(t, gqlEnum.Values, getValues(expectedVals))
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
