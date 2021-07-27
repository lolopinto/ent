package request

import (
	"net/http"
	"sync"

	"github.com/lolopinto/ent/internal/util"
)

var (
	middlewareMutex sync.RWMutex
	// by default, should be authMiddleware...
	middlewares = make(map[string][]func(http.Handler) http.Handler)
)

// Register takes a name and a list of function handlers and registers
// them as middleware functions that can be applied to the router or whatever
// system that's being used for routing
// Since these functions are registered ad-hoc, if there's a strict dependency
// between functions, they should be passed in with one Register function
func Register(name string, fns ...func(http.Handler) http.Handler) {
	middlewareMutex.Lock()
	defer middlewareMutex.Unlock()
	if fns == nil {
		util.GoSchemaKill("request: Register function is nil")
	}

	if _, dup := middlewares[name]; dup {
		util.GoSchemaKill("request: Register called twice for middleware func " + name)
	}
	middlewares[name] = fns
}

// There's currently no public API for this. TBD on if this will be provided
func unregisterAllMiddlewares() {
	middlewareMutex.Lock()
	defer middlewareMutex.Unlock()
	// used in tests
	middlewares = make(map[string][]func(http.Handler) http.Handler)
}

// GetAllMiddlewares returns a list of middlewares (respecting order) in cases where the
// order was explicit. When there was no explicit order given, e.g. different Register functions,
// order is undetermined
// TODO: provide dependency management and expose something depgraph-like here because this will
// eventually be needed for sure
func GetAllMiddlewares() []func(http.Handler) http.Handler {
	res := []func(http.Handler) http.Handler{}
	for _, v := range middlewares {
		res = append(res, v...)
	}
	return res
}
