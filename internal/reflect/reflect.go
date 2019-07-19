package reflect

import "reflect"

// SetValueInEnt sets a value in an net if it's possible
func SetValueInEnt(value reflect.Value, fieldName string, fieldValue interface{}) {
	if value.Kind() == reflect.Ptr {
		value = value.Elem()
	}
	fbn := value.FieldByName(fieldName)
	if fbn.IsValid() {
		fbn.Set(reflect.ValueOf(fieldValue))
	}
}
