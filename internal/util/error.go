package util

import (
	"go/scanner"

	"github.com/davecgh/go-spew/spew"
)

func Die(err error) {
	if err != nil {
		spew.Dump(err)
		err2, ok := err.(scanner.ErrorList)
		if ok {
			for _, err3 := range err2 {
				spew.Dump(err3)
			}
		}
		panic(err)
	}
}
