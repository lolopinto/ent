package ent

import (
	"fmt"
	"log"
	"reflect"
	"runtime/debug"
	"sync"

	"github.com/lolopinto/ent/ent/viewer"
	entreflect "github.com/lolopinto/ent/internal/reflect"
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

func getTypeName(ent Entity) string {
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
func LoadNode(v viewer.ViewerContext, id string, ent Entity) error {
	return <-GenLoadNode(v, id, ent)
}

// TODO...
func GenLoadNode(v viewer.ViewerContext, id string, ent Entity) chan error {
	res := make(chan error)
	go func() {
		if id == "" {
			debug.PrintStack()
		}
		// working solutions so far:
		// use reflection to create a copy like below (need ent2 var)
		// use reflection to set to zero-value.
		// creating a new variable and setting it is useless since copy-by-reference
		// I guess we cannot set this to null. only zero-value of it once we create the variable...

		// fmt.Println("ent before anything", ent)
		// typ := reflect.TypeOf(ent)
		// if typ.Kind() == reflect.Ptr {
		// 	typ = typ.Elem()
		// }
		// value := reflect.New(typ)
		// ent2 := value.Interface()

		chanErr := make(chan error)
		// this is raw data fetching...
		// TODO rename these things..
		// GenLoadNode should be the public facing one
		// and GenLoadRawData or somethong along those lines should be what does the data fetching.
		go genLoadRawData(id, ent, ent.GetConfig(), chanErr)
		err := <-chanErr
		if err != nil {
			entreflect.SetZeroVal(ent)
			// there's an error, return the value here and we're done...
			res <- err
			return
		}

		// hmm todo need to wrap all of this in a new function or new else branch
		//fmt.Println("successfully loaded ent from data", ent)

		// check privacy policy...
		privacyResultChan := make(chan privacyPolicyResult)
		go genApplyPrivacyPolicy(v, ent, privacyResultChan)
		result := <-privacyResultChan

		//fmt.Println("result", result, getTypeName(result.err))

		// error in privacy loading
		if result.err != nil {
			entreflect.SetZeroVal(ent)
			logEntResult(ent, result.err)
			res <- result.err
		} else if result.visible {
			// only when it's visible do we set it so that we can return nil
			// success. return that value?
			// result is visible
			// no privacy error
			logEntResult(ent, nil)
			res <- nil
		} else {
			entData := ent
			entreflect.SetZeroVal(ent)
			err = &PrivacyError{
				entType: getTypeName(entData),
				id:      id,
			}
			logEntResult(ent, err)
			res <- err
		}
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

type privacyPolicyResult struct {
	visible bool
	err     error
}

func genApplyPrivacyPolicyUnsure(v viewer.ViewerContext, maybeEnt interface{}, privacyResultChan chan<- privacyPolicyResult) {
	ent, ok := maybeEnt.(Entity)
	//fmt.Println("genApplyPrivacyPolicy", maybeEnt, ent, ok)
	if !ok {
		fmt.Println("invalid ent", ent)
		privacyResultChan <- privacyPolicyResult{
			visible: false,
			err: &InvalidEntPrivacyError{
				entType: getTypeName(ent),
			},
		}
	} else {
		go genApplyPrivacyPolicy(v, ent, privacyResultChan)
	}
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
		f := func(i int) {
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
		}
		go f(idx)
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

// apply the privacy policy and determine if the ent is visible
func genApplyPrivacyPolicy(v viewer.ViewerContext, ent Entity, privacyResultChan chan<- privacyPolicyResult) {
	// TODO do this programmatically without reflection later
	// set viewer at the beginning because it's needed in GetPrivacyPolicy sometimes
	entreflect.SetViewerInEnt(v, ent)

	err := ApplyPrivacyForEnt(v, ent)
	result := privacyPolicyResult{
		visible: err == nil,
		err:     err,
	}
	privacyResultChan <- result
}

func GenLoadForeignKeyNodes(v viewer.ViewerContext, id string, colName string, entLoader MultiEntLoader) <-chan error {
	return genLoadNodesImpl(v, func() <-chan multiEntResult {
		return genLoadForeignKeyNodes(id, colName, entLoader)
	})
}

func LoadForeignKeyNodes(v viewer.ViewerContext, id string, colName string, entLoader MultiEntLoader) error {
	return <-GenLoadForeignKeyNodes(v, id, colName, entLoader)
}

func GenLoadNodes(v viewer.ViewerContext, ids []string, entLoader MultiEntLoader) <-chan error {
	return genLoadNodesImpl(v, func() <-chan multiEntResult {
		return genLoadNodes(ids, entLoader)
	})
}

func LoadNodes(v viewer.ViewerContext, ids []string, entLoader MultiEntLoader) error {
	return <-GenLoadNodes(v, ids, entLoader)
}

func GenLoadNodesByType(v viewer.ViewerContext, id string, edgeType EdgeType, entLoader MultiEntLoader) <-chan error {
	return genLoadNodesImpl(v, func() <-chan multiEntResult {
		return genLoadNodesByType(id, edgeType, entLoader)
	})
}

func LoadNodesByType(v viewer.ViewerContext, id string, edgeType EdgeType, entLoader MultiEntLoader) error {
	return <-GenLoadNodesByType(v, id, edgeType, entLoader)
}

func LoadUniqueNodeByType(v viewer.ViewerContext, id string, edgeType EdgeType, node Entity) error {
	edge, err := LoadUniqueEdgeByType(id, edgeType)
	if err != nil {
		return err
	}
	return LoadNode(v, edge.ID2, node)
}

func GenLoadUniqueNodeByType(v viewer.ViewerContext, id string, edgeType EdgeType, node Entity) chan error {
	ret := make(chan error)
	go func() {
		edgeResult := <-GenLoadUniqueEdgeByType(id, edgeType)
		if edgeResult.Err != nil {
			ret <- edgeResult.Err
			return
		}
		ret <- <-GenLoadNode(v, edgeResult.Edge.ID2, node)
	}()
	return ret
}

// function that does the actual work of loading the raw data when fetching a list of nodes
type loadRawNodes func() <-chan multiEntResult

type multiEntResult struct {
	loader MultiEntLoader
	ents   []DBObject
	err    error
}

// genLoadNodesImpl takes the raw nodes fetched by whatever means we need to fetch data and applies a privacy check to
// make sure that only the nodes which should be visible are returned to the viewer
func genLoadNodesImpl(v viewer.ViewerContext, nodesLoader loadRawNodes) <-chan error {
	res := make(chan error)
	go func() {
		loaderResult := <-nodesLoader()
		if loaderResult.err != nil {
			res <- loaderResult.err
		} else {
			doneChan := make(chan bool)
			go genApplyPrivacyPolicyForEnts(v, &loaderResult.ents, doneChan)
			<-doneChan
			// set ents here...
			//			loaderResult.loader
			// TODO need a better way and something that keeps track of errors
			// why things are not visible...
			//			spew.Dump(loaderResult)
			loaderResult.loader.SetResult(loaderResult.ents)
			res <- nil
		}
	}()
	return res
}

// TODO change eveywhere using interface{}
// TODO figure out go slice polymorphism in a sensible way :/
func genApplyPrivacyPolicyForEnts(v viewer.ViewerContext, nodes interface{}, doneChan chan<- bool) {
	// we know it's a slice since loadNodesHelper in data fetching code has already handled this so no need
	// to do the checking again
	// TODO figure out if we can do this without this much reflection
	// OR at least reuse the reflection from lower level in the stack?
	value := reflect.ValueOf(nodes)
	slice := value.Elem()
	direct := reflect.Indirect(value)

	// check privacy policy for each of the nodes
	resSlice := make([]privacyPolicyResult, slice.Len())
	for idx := 0; idx < slice.Len(); idx++ {
		node := slice.Index(idx).Interface()
		c := make(chan privacyPolicyResult)
		go genApplyPrivacyPolicyUnsure(v, node, c)
		resSlice[idx] = <-c
	}

	sliceType := slice.Type()
	resNodes := reflect.MakeSlice(sliceType, 0, slice.Cap())

	for idx, res := range resSlice {
		//	fmt.Println("result.....", res)

		// visible and no err yay!
		if res.visible && res.err == nil {
			resNodes = reflect.Append(resNodes, slice.Index(idx))
		} else if res.err != nil {
			// TODO doesn't make sense to send this to the client since it could be
			// lots of different ents not visible for whatever reason but maybe provide a way to
			// see it.
			// Maybe map instead of slice should be returned here?
		}
	}
	// return privacy aware ents here
	direct.Set(resNodes)

	// we done, we out of here...

	doneChan <- true
}
