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

func SetZeroVal(i interface{}) {
	// neither of these work...
	//ent = nil
	// &ent = nil
	//this doesn't quite set any embedded structs to nil...
	v := reflect.ValueOf(i)

	v.Elem().Set(reflect.Zero(v.Elem().Type()))
}

func SetViewerInEnt(v, ent interface{}) {
	SetValueInEnt(reflect.ValueOf(ent), "Viewer", v)
}
