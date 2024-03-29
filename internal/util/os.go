package util

import "os"

func GetEnv(key, defaultValue string) string {
	val, ok := os.LookupEnv(key)
	if ok {
		return val
	}
	return defaultValue
}

func EnvIsTrue(key string) bool {
	val, ok := os.LookupEnv(key)
	if !ok {
		return false
	}
	return val == "true"
}
