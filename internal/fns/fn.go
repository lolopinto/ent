package fns

import (
	"sync"

	"github.com/lolopinto/ent/internal/syncerr"
)

type Function func() error
type FunctionList []Function

func RunParallel(funcs FunctionList) error {
	var wg sync.WaitGroup
	wg.Add(len(funcs))
	var serr syncerr.Error

	for i := range funcs {
		go func(i int) {
			defer wg.Done()
			fn := funcs[i]
			serr.Append(fn())
		}(i)
	}
	wg.Wait()
	return serr.Err()
}

func RunVarargs(funcs ...Function) error {
	return RunParallel(funcs)
}
