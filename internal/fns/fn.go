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

// info is passed from one function to other
type TimedFunction func(info interface{}) error

// Runs a series of func
func RunAndTime(funcs []TimedFunction, info interface{}, log bool) error {
	if !log {
		for _, fn := range funcs {
			if err := fn(info); err != nil {
				return err
			}
		}
	}

	// need callback about what happened with duration

	return nil
}
