package testingutils

import (
	"sync"
	"testing"
)

type Fn func(t *testing.T, str string) interface{}

// RunOnce is used to make sure that an expensive operation is run only once per key
// It caches the result the first time it's run
type RunOnce struct {
	m     map[string]interface{}
	mutex sync.Mutex
	fn    Fn
}

var e *RunOnce

func NewRunOnce(fn Fn) *RunOnce {
	m := &RunOnce{}
	m.m = make(map[string]interface{})
	m.fn = fn
	return m
}

func (e *RunOnce) Get(t *testing.T, str string) interface{} {
	if e.m[str] != nil {
		return e.m[str]
	}
	e.mutex.Lock()
	defer e.mutex.Unlock()
	result := e.fn(t, str)
	e.m[str] = result
	return result
}
