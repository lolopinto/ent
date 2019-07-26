package util

import (
	"go/scanner"

	"github.com/davecgh/go-spew/spew"
	"golang.org/x/tools/go/packages"
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

func ErrSlice(err []packages.Error) {
	str := ""
	for _, e := range err {
		str += e.Error() + "\n"
	}
	panic(str)
}
