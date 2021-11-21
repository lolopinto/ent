package filehelper

import (
	"io/ioutil"
	"path/filepath"
)

type Result struct {
	Bytes  []byte
	Error  error
	Suffix string
}

func FindAndRead(start, needle string) *Result {
	curDir := start
	suffix := ""

	for {
		b, err := ioutil.ReadFile(filepath.Join(curDir, "/", needle))
		if err == nil {
			return &Result{
				Bytes:  b,
				Suffix: suffix,
			}
		}

		suffix = "/" + filepath.Base(curDir) + suffix
		// go up one directory
		curDir, err = filepath.Abs(filepath.Join(curDir, ".."))
		if err != nil {
			return &Result{
				Error: err,
			}
		}

		// got all the way to the top. bye felicia
		if curDir == "/" {
			break
		}
	}

	return &Result{}
}
