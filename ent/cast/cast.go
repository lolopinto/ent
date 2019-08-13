package cast

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

func ToUUIDString(v interface{}) (string, error) {
	id := uuid.UUID{}
	if err := id.Scan(v); err != nil {
		return "", err
	}
	return id.String(), nil
}

//func ToNodeType(v interface{}) (NodeType, error)

func ToTime(v interface{}) (time.Time, error) {
	t, ok := v.(time.Time)
	if !ok {
		return t, errors.New("could not convert time field to appropriate type")
	}
	return t, nil
}

func ToString(v interface{}) (string, error) {
	str, ok := v.(string)
	if !ok {
		return "", errors.New("could not convert data field to appropriate type")
	}
	return str, nil
}

func ToBool(v interface{}) (bool, error) {
	val, ok := v.(bool)
	if !ok {
		return false, errors.New("could not convert data field to appropriate type")
	}
	return val, nil
}

//func ToNullString
