package util

// panic not ok in typescript path. ok in golang since that's deprecated and not updated
// using a different API to make it easier to grep/etc
func GoSchemaKill(v interface{}) {
	panic(v)
}
