package ent

import (
	"fmt"
	"log"
	"reflect"
	"runtime/debug"
	"sync"

	"github.com/davecgh/go-spew/spew"
	"github.com/lolopinto/ent/ent/sql"
	"github.com/lolopinto/ent/ent/viewer"
	"github.com/pkg/errors"
)

// hmm this should be an interface...
// and ideally DenyWithReasonResult uses this?
// or vice versa?
// we want the information of what ent is not visible to also be encoded...
// type PrivacyError interface {

// }

// PrivacyError is the error type returned when an ent is not visible due to privacy reasons
type PrivacyError struct {
	entType string
	id      string
}

func getPrivacyError(ent Entity) *PrivacyError {
	var id string
	if ent != nil {
		id = ent.GetID()
	}
	return &PrivacyError{
		entType: getTypeName(ent),
		id:      id,
	}
}

// Error returns a formatted string that indicates why the ent is not visible
func (err *PrivacyError) Error() string {
	return fmt.Sprintf("Ent of type %s is not visible due to privacy reasons", err.entType)
}

// InvalidEntPrivacyError is the error type returned when an ent does not implement the right privacy policy
type InvalidEntPrivacyError struct {
	entType string
}

// Error returns a formatted string that indicates why the ent is not visible
func (err *InvalidEntPrivacyError) Error() string {
	return fmt.Sprintf("Ent of type %s does not implement a privacy policy", err.entType)
}

// InvalidPrivacyRule is the error type returned when an ent does not have the right privacy rules
type InvalidPrivacyRule struct{}

// Error returns a formatted string that indicates why the ent is not visible
func (err *InvalidPrivacyRule) Error() string {
	return fmt.Sprintf("Invalid privacy rule which does not have an allow/deny result")
}

// IsPrivacyError returns a boolean indicating if an error is a privacy error that indicates an ent is not visible
func IsPrivacyError(err error) bool {
	_, ok := err.(*PrivacyError)
	return ok
}

// IsInvalidPrivacyRule returns a boolean indicating if an error is because of an invalid privacy rule which is why the ent is not visible
func IsInvalidPrivacyRule(err error) bool {
	_, ok := err.(*InvalidPrivacyRule)
	return ok
}

// IsInvalidEntPrivacyError returns a boolean indicating if an error is because an ent does not implement the right privacy policy
func IsInvalidEntPrivacyError(err error) bool {
	_, ok := err.(*InvalidEntPrivacyError)
	return ok
}

func getTypeName(ent DBObject) string {
	// hmm kill it? no reflection
	// for errors
	if ent == nil {
		return ""
	}
	t := reflect.TypeOf(ent)
	if t.Kind() == reflect.Ptr {
		return t.Elem().Name()
	}
	return t.Name()
}

// TODO same issues as below
func LoadNode(v viewer.ViewerContext, id string, loader PrivacyBackedLoader) error {
	return <-GenLoadNode(v, id, loader)
}

// TODO...
func GenLoadNode(v viewer.ViewerContext, id string, loader PrivacyBackedLoader) chan error {
	res := make(chan error)
	go func() {
		if id == "" {
			debug.PrintStack()
		}
		l := &loadNodeLoader{
			id:        id,
			entLoader: loader,
		}
		err := loadData(l)
		ent := l.GetEntity()
		// there's an error loading raw data, return the value here and we're done.
		if err != nil {
			loader.SetPrivacyResult(id, nil, err)
			res <- err
			return
		}

		// check privacy policy...
		// note that when loading the one item we send that error back to error out the entire
		// thing just so that it's clearer to the client that loading the item
		// wasn't as expected.
		res <- <-genApplyPrivacyPolicyUnsure(v, ent, loader)
	}()
	return res
}

func logEntResult(ent interface{}, err error) {
	return
	// result
	// fmt.Printf(
	// 	"result from loading ent: err %v  privacy errror %v ent %v \n",
	// 	err,
	// 	IsPrivacyError(err),
	// 	ent,
	// )
}

func genApplyPrivacyPolicyUnsure(v viewer.ViewerContext, maybeEnt DBObject, loader PrivacyBackedLoader) <-chan error {
	res := make(chan error)
	go func() {
		ent, ok := maybeEnt.(Entity)
		var visible bool
		var err error

		if !ok {
			fmt.Println("invalid ent", ent)
			err = &InvalidEntPrivacyError{
				entType: getTypeName(ent),
			}
		} else {
			if v != ent.GetViewer() {
				err = fmt.Errorf("viewer mismatch. expected Instance Viewer to be same as passed in viewer")
			} else {
				err = ApplyPrivacyForEnt(v, ent)
				visible = err == nil
			}
		}

		// log and return
		if visible {
			loader.SetPrivacyResult(ent.GetID(), ent, nil)
			logEntResult(ent, nil)
		} else {
			logEntResult(nil, err)
			spew.Dump(ent)
			loader.SetPrivacyResult(ent.GetID(), nil, err)
		}

		res <- err
	}()
	return res
}

// ApplyPrivacyForEnt takes an ent and evaluates whether the ent is visible or not
func ApplyPrivacyForEnt(v viewer.ViewerContext, entity Entity) error {
	return ApplyPrivacyPolicy(v, entity.GetPrivacyPolicy(), entity)
}

// ApplyPrivacyPolicy takes a viewer, a privacy policy and the underlying ent
// that the privacy will be applied to
// This is useful for things like actions or per-field privacy where the privacy policy is
// different than the privacy for the ent but we still need the ent
// because that's what's passed to each PrivacyPolicyRule
func ApplyPrivacyPolicy(v viewer.ViewerContext, policy PrivacyPolicy, ent Entity) error {
	rules := policy.Rules()

	// TODO this is all done in parallel.
	// will eventually be worth having different modes and testing it per ent
	// and figuring out based on logic which mode makes sense for each ent

	var wg sync.WaitGroup
	results := make([]PrivacyResult, len(rules))
	wg.Add(len(rules))

	// go through the rules, build up the channels.
	// do this manually so that we guarantee the order of the results...
	for idx := range rules {
		idx := idx
		rule := rules[idx]
		go func(i int) {
			// hmm the "correct" thing here is to switch these 2 lines because of LIFO
			// but TestAlwaysPanicPolicy doesn't work when flipped
			defer wg.Done()
			defer func() {
				if r := recover(); r != nil {
					// set result to indicate that the test panicked and encode what happened
					results[i] = DenyWithReason(errors.Errorf("privacyResult panicked: %s", r))
				}
			}()
			results[i] = rule.Eval(v, ent)
		}(idx)
	}
	wg.Wait()

	// go through results of privacyRules and see what the privacy policy returns
	for idx, res := range results {
		if res == nil {
			log.Printf("invalid result. nil return value for Privacy Result at idx %d", idx)
			return DenyWithReason(errors.New("nil result :("))
		}
		if res.Result() == AllowPrivacyResult {
			return nil
		} else if res.Result() == DenyPrivacyResult {
			denyReason, ok := res.(DenyWithReasonResult)
			if ok {
				return denyReason
			}
			return getPrivacyError(ent)
		}
	}

	// TODO eventually figure out how to do this with static analysis
	// would be preferable to detect this at compile time instead of runtime
	// or with a test
	return &InvalidPrivacyRule{}
}

func GenLoadNodesViaQueryClause(v viewer.ViewerContext, entLoader PrivacyBackedLoader, clause sql.QueryClause) <-chan error {
	return genLoadNodesImpl(v, func() <-chan multiEntResult {
		return genLoadNodesViaClause(entLoader, clause)
	})
}

func LoadNodesViaQueryClause(v viewer.ViewerContext, entLoader PrivacyBackedLoader, clause sql.QueryClause) error {
	return <-GenLoadNodesViaQueryClause(v, entLoader, clause)
}

func GenLoadNodes(v viewer.ViewerContext, ids []string, entLoader PrivacyBackedLoader) <-chan error {
	return genLoadNodesImpl(v, func() <-chan multiEntResult {
		return genLoadNodes(ids, entLoader)
	})
}

func LoadNodes(v viewer.ViewerContext, ids []string, entLoader PrivacyBackedLoader) error {
	return <-GenLoadNodes(v, ids, entLoader)
}

func GenLoadNodesByType(v viewer.ViewerContext, id string, edgeType EdgeType, entLoader PrivacyBackedLoader) <-chan error {
	return genLoadNodesImpl(v, func() <-chan multiEntResult {
		return genLoadNodesByType(id, edgeType, entLoader)
	})
}

func LoadNodesByType(v viewer.ViewerContext, id string, edgeType EdgeType, entLoader PrivacyBackedLoader) error {
	return <-GenLoadNodesByType(v, id, edgeType, entLoader)
}

func LoadUniqueNodeByType(v viewer.ViewerContext, id string, edgeType EdgeType, loader PrivacyBackedLoader) error {
	edge, err := LoadUniqueEdgeByType(id, edgeType)
	if err != nil {
		return err
	}
	return LoadNode(v, edge.ID2, loader)
}

func GenLoadUniqueNodeByType(v viewer.ViewerContext, id string, edgeType EdgeType, loader PrivacyBackedLoader) chan error {
	ret := make(chan error)
	go func() {
		edgeResult := <-GenLoadUniqueEdgeByType(id, edgeType)
		if edgeResult.Err != nil {
			ret <- edgeResult.Err
			return
		}
		ret <- <-GenLoadNode(v, edgeResult.Edge.ID2, loader)
	}()
	return ret
}

// function that does the actual work of loading the raw data when fetching a list of nodes
type loadRawNodes func() <-chan multiEntResult

type multiEntResult struct {
	loader Loader
	ents   []DBObject
	err    error
}

// genLoadNodesImpl takes the raw nodes fetched by whatever means we need to fetch data and applies a privacy check to
// make sure that only the nodes which should be visible are returned to the viewer
// TODO change API of genLoadNodesImpl to use this: PrivacyBackedMultiEntLoader
// and then it'll be clear what the API to loadNodesLoader is: returning ents or map[string]interface{}
func genLoadNodesImpl(v viewer.ViewerContext, nodesLoader loadRawNodes) <-chan error {
	res := make(chan error)
	go func() {
		loaderResult := <-nodesLoader()
		if loaderResult.err != nil {
			res <- loaderResult.err
		} else {
			entLoader := loaderResult.loader
			privacyLoader, ok := entLoader.(PrivacyBackedLoader)
			if !ok {
				res <- errors.New("invalid loader passed here. need a PrivacyBackedMultiEntLoader")
				return
			}
			<-genApplyPrivacyPolicyForEnts(v, privacyLoader, loaderResult.ents)
			res <- nil
		}
	}()
	return res
}

func genApplyPrivacyPolicyForEnts(v viewer.ViewerContext, entLoader PrivacyBackedLoader, ents []DBObject) <-chan bool {
	done := make(chan bool)
	go func() {
		var wg sync.WaitGroup
		wg.Add(len(ents))
		for idx := range ents {
			go func(idx int) {
				defer wg.Done()
				obj := ents[idx]

				<-genApplyPrivacyPolicyUnsure(v, obj, entLoader)
			}(idx)
		}
		wg.Wait()
		done <- true
	}()
	return done
}
