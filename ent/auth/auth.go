package auth

import (
	"log"
	"net/http"
	"sync"

	"github.com/lolopinto/ent/ent/request"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/internal/util"
)

// Auth interface should be implemented to get information from the request (such as header or cookie) to authenticate
// the user.
type Auth interface {
	// Viewer gathers information from the request (and optionally writes to the response)
	// and returns the authenticated viewer for this request. If cannot authenticate the viewer,
	// this method should return nil.
	// The framework will eventually put a LoggedOutViewer: viewer.LoggedOutViewer()
	// if no ViewerContext is returned by any Auth Handler
	AuthViewer(http.ResponseWriter, *http.Request) viewer.ViewerContext
}

var (
	authMutex    sync.RWMutex
	authHandlers = make(map[string][]Auth)
)

// Register takes a list and a list of Auth(er?) instances and registers them
// as possible things that can be applied in the auth middleware to authenticate the viewer
// Since these functions are registered ad-hoc, if there's a strict dependency
// between functions, they should be passed in with one Register function
func Register(name string, handlers ...Auth) {
	authMutex.Lock()
	defer authMutex.Unlock()
	if handlers == nil {
		util.GoSchemaKill("auth: Register Auth is nil")
	}

	if _, dup := authHandlers[name]; dup {
		util.GoSchemaKill("auth: Register called twice for handler " + name)
	}
	authHandlers[name] = handlers
}

// Clear is provided to be used in tests
// It unregiseters all Auth handlers.
// Use in production at your own risk...
func Clear() {
	authMutex.Lock()
	defer authMutex.Unlock()
	// used in tests
	authHandlers = make(map[string][]Auth)
}

// get the viewer from all the auth handlers. return logged out viewer
// if no auth handler returns one
func getViewer(w http.ResponseWriter, r *http.Request) viewer.ViewerContext {
	for name, handlers := range authHandlers {
		for _, handler := range handlers {

			if v := handler.AuthViewer(w, r); v != nil {
				log.Printf("auth handler %s authenticated user %s \n", name, v.GetViewerID())
				return v
			}
		}
	}
	log.Printf("no auth handler returned viewer. default to logged out viewer")
	return viewer.LoggedOutViewer()
}

// default auth middleware that is registered with the request package
func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// by default this works with a logged out viewer.
		v := getViewer(w, r)
		r = viewer.NewRequestWithContext(r, v)
		next.ServeHTTP(w, r)
	})
}

func init() {
	request.Register("auth", authMiddleware)
}
