package cast

import (
	"fmt"
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
		return t, fmt.Errorf("could not convert time field %v to appropriate type", v)
	}
	return t, nil
}

func ToString(v interface{}) (string, error) {
	str, ok := v.(string)
	if !ok {
		uuid, err := ToUUIDString(v)
		if err == nil {
			return uuid, nil
		}
		return "", fmt.Errorf("could not convert string field %v to appropriate type", v)
	}
	return str, nil
}

func ToBool(v interface{}) (bool, error) {
	val, ok := v.(bool)
	if !ok {
		return false, fmt.Errorf("could not convert bool field %v to appropriate type", v)
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
	return 0, fmt.Errorf("could not convert int field %v to appropriate type", v)
}

//func ToNullString
