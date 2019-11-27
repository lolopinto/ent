package cast

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

func ToUUIDString(v interface{}) (string, error) {
	// handle nil value as non-error
	// this should have been nullable...
	// time to remove this now that we have support for this...
	if v == nil {
		return "", nil
	}
	id := uuid.UUID{}
	if err := id.Scan(v); err != nil {
		return "", err
	}
	return id.String(), nil
}

func ToNullableUUIDString(v interface{}) (*string, error) {
	if v == nil {
		return nil, nil
	}
	str, err := ToUUIDString(v)
	if err != nil {
		return nil, err
	}
	return &str, nil
}

//func ToNodeType(v interface{}) (NodeType, error)

func ToTime(v interface{}) (time.Time, error) {
	t, ok := v.(time.Time)
	if !ok {
		return t, fmt.Errorf("could not convert time field %v to appropriate type", v)
	}
	return t, nil
}

func ToNullableTime(v interface{}) (*time.Time, error) {
	if v == nil {
		return nil, nil
	}
	t, err := ToTime(v)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func ToString(v interface{}) (string, error) {
	str, ok := v.(string)
	if !ok {
		// when it's a fkey, it's stored as uuid in db...
		// we have that information and should just call ToUUIDString not ToString() in the long run
		uuid, err := ToUUIDString(v)
		if err == nil {
			return uuid, nil
		}
		return "", fmt.Errorf("could not convert string field %v to appropriate type", v)
	}
	return str, nil
}

// TODO test nullable versions here...
func ToNullableString(v interface{}) (*string, error) {
	if v == nil {
		return nil, nil
	}
	str, err := ToString(v)
	if err != nil {
		return nil, err
	}
	return &str, nil
}

func ToBool(v interface{}) (bool, error) {
	val, ok := v.(bool)
	if !ok {
		return false, fmt.Errorf("could not convert bool field %v to appropriate type", v)
	}
	return val, nil
}

func ToNullableBool(v interface{}) (*bool, error) {
	if v == nil {
		return nil, nil
	}
	b, err := ToBool(v)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func ToInt(v interface{}) (int, error) {
	// losing some data
	val, ok := v.(int64)
	if ok {
		return int(val), nil
	}
	val2, ok := v.(int)
	if ok {
		return val2, nil
	}
	return 0, fmt.Errorf("could not convert int field %v to appropriate type", v)
}

func ToNullableInt(v interface{}) (*int, error) {
	if v == nil {
		return nil, nil
	}
	i, err := ToInt(v)
	if err != nil {
		return nil, err
	}
	return &i, nil
}

// We need both a float64 and float32 in the long run. Just always use float64 until API changes
// db returns float64 so we should just do that.
func ToFloat(v interface{}) (float64, error) {
	val, ok := v.(float64)
	if ok {
		return float64(val), nil
	}
	val2, ok := v.(float32)
	if ok {
		return float64(val2), nil
	}
	return 0, fmt.Errorf("could not convert float field %v to appropriate type", v)
}

func ToNullableFloat(v interface{}) (*float64, error) {
	if v == nil {
		return nil, nil
	}
	f, err := ToFloat(v)
	if err != nil {
		return nil, err
	}
	return &f, nil
}
