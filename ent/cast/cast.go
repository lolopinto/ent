package cast

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

func ToUUIDString(v interface{}) (string, error) {
	// handle nil value as non-error
	if v == nil {
		return "", nil
	}
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
		return "", errors.New("could not convert string field to appropriate type")
	}
	return str, nil
}

func ToBool(v interface{}) (bool, error) {
	val, ok := v.(bool)
	if !ok {
		return false, errors.New("could not convert bool field to appropriate type")
	}
	return val, nil
}

func ToInt(v interface{}) (int, error) {
	// losing some data
	val, ok := v.(int)
	if ok {
		return val, nil
	}
	val2, ok := v.(int64)
	if ok {
		return int(val2), nil
	}
	return 0, errors.New("could not convert int field to appropriate type")
}

//func ToNullString
