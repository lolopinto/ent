package util

import (
	"errors"
	"path"
	"runtime"
)

func GetAbsolutePath(filePath string) string {
	_, filename, _, ok := runtime.Caller(1)
	if !ok {
		Die(errors.New("could not get path of template file"))
	}
	return path.Join(path.Dir(filename), filePath)
}
