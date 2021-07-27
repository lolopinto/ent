package util

import (
	"path"
	"runtime"
)

func GetAbsolutePath(filePath string) string {
	_, filename, _, ok := runtime.Caller(1)
	if !ok {
		// this is a rare case that we should just kill for now
		// probably should change this function and callers
		panic("could not get path of caller")
	}
	return path.Join(path.Dir(filename), filePath)
}
