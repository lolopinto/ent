package cast

import (
	"encoding/json"
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
	// stored as utc and it's time without timezone
	return time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), time.UTC), nil
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

func ConvertToNullableBool(b bool) *bool {
	return &b
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

func ToInt64(v interface{}) (int64, error) {
	val, ok := v.(int64)
	if ok {
		return val, nil
	}
	return 0, fmt.Errorf("could not convert int64 field %v to appropriate type", v)
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

func ToNullableInt64(v interface{}) (*int64, error) {
	if v == nil {
		return nil, nil
	}
	i, err := ToInt64(v)
	if err != nil {
		return nil, err
	}
	return &i, nil
}

// We need both a float64 and float32 in the long run. Just always use float64 until API changes
// db returns float64 so we should just do that.
func ToFloat(v interface{}) (float64, error) {
	f, ok := v.(float64)
	if ok {
		return float64(f), nil
	}
	f32, ok := v.(float32)
	if ok {
		return float64(f32), nil
	}
	i, ok := v.(int)
	if ok {
		return float64(i), nil
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

func UnmarshallJSON(src interface{}, dest interface{}) error {
	switch s := src.(type) {
	case string:
		return json.Unmarshal([]byte(s), dest)
	case []byte:
		return json.Unmarshal(s, dest)
	default:
		str, err := ToString(src)
		if err != nil {
			return err
		}
		b := []byte(str)
		return json.Unmarshal(b, dest)
	}
}
