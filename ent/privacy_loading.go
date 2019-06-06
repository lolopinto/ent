package ent

import (
	"fmt"
	"reflect"

	"github.com/davecgh/go-spew/spew"

	"github.com/lolopinto/jarvis/ent/privacy"
	"github.com/lolopinto/jarvis/ent/viewer"
)

// PrivacyError is the error type returned when an ent is not visible due to privacy reasons
type PrivacyError struct {
	entType string
	id      string
}

// Error returns a formatted string that indicates why the ent is not visible
func (err *PrivacyError) Error() string {
	return fmt.Sprintf("Ent of type %s is not visbile due to privacy reasons", err.entType)
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

func getTypeName(ent interface{}) string {
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

func setZeroVal(i interface{}) {
	// neither of these work...
	//ent = nil
	// &ent = nil
	//this doesn't quite set any embedded structs to nil...
	v := reflect.ValueOf(i)

	v.Elem().Set(reflect.Zero(v.Elem().Type()))
	spew.Dump(i)
}

// TODO same issues as below
func LoadPrivacyAwareNode(viewer viewer.ViewerContext, id string, ent interface{}, entConfig Config) error {
	chanErr := make(chan error)
	go GenLoadPrivacyAwareNode(viewer, id, ent, entConfig, chanErr)
	err := <-chanErr
	return err
}

// TODO...
func GenLoadPrivacyAwareNode(viewer viewer.ViewerContext, id string, ent interface{}, entConfig Config, errChan chan<- error) {
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
	go genLoadRawData(id, ent, entConfig, chanErr)
	err := <-chanErr
	if err != nil {
		// there's an error, return the value here and we're done...
		errChan <- err
	}

	// hmm todo need to wrap all of this in a new function or new else branch
	fmt.Println("successfully loaded ent from data", ent)

	// check privacy policy...
	privacyResultChan := make(chan privacyResult)
	go genApplyPrivacyPolicy(viewer, ent, privacyResultChan)
	result := <-privacyResultChan

	fmt.Println("result", result, getTypeName(result.err))

	// error in privacy loading
	if result.err != nil {
		setZeroVal(ent)
		logEntResult(ent, result.err)
		errChan <- result.err
	} else if result.visible {
		// only when it's visible do we set it so that we can return nil
		// success. return that value?
		// result is visible
		// no privacy error
		logEntResult(ent, nil)
		errChan <- nil
	} else {
		entData := ent
		setZeroVal(ent)
		err = &PrivacyError{
			entType: getTypeName(entData),
			id:      id,
		}
		logEntResult(ent, err)
		errChan <- err
	}
}

func logEntResult(ent interface{}, err error) {
	// result
	fmt.Println(
		"result from loading ent ",
		err,
		IsPrivacyError(err),
		IsInvalidEntPrivacyError(err),
		ent,
	)
}

type privacyResult struct {
	visible bool
	err     error
}

// apply the privacy policy and determine if the ent is visible
func genApplyPrivacyPolicy(viewer viewer.ViewerContext, ent interface{}, privacyResultChan chan<- privacyResult) {
	entWithPrivacy, ok := ent.(EntWithPrivacy)
	fmt.Println("genApplyPrivacyPolicy", ent, entWithPrivacy, ok)
	if !ok {
		fmt.Println("invalid ent", ent)
		privacyResultChan <- privacyResult{
			visible: false,
			err: &InvalidEntPrivacyError{
				entType: getTypeName(ent),
			},
		}
	} else {
		go genApplyPrivacyPolicyReal(viewer, entWithPrivacy, ent, privacyResultChan)
	}
}

func genApplyPrivacyPolicyReal(viewer viewer.ViewerContext, entWithPrivacy EntWithPrivacy, ent interface{}, privacyResultChan chan<- privacyResult) {
	//	fmt.Println("before getPrivacyPolicy", entWithPrivacy)

	privacyPolicy := entWithPrivacy.GetPrivacyPolicy()
	//fmt.Println("privacyPolicy ", privacyPolicy)

	rules := privacyPolicy.Rules()

	//fmt.Println("rules ", rules)
	spew.Dump("rules", rules)
	// TODO this is all done in parallel.
	// will eventually be worth having different modes and testing it per ent
	// and figuring out based on logic which mode makes sense for each ent

	//var chanResSlice []chan privacy.Result
	resSlice := make([]privacy.Result, len(rules))

	// go through the rules, build up the channels.
	// do this manually so that we guarantee the order of the results...
	for idx, rule := range rules {
		c := make(chan privacy.Result)
		go rule.GenEval(viewer, ent, c)
		resSlice[idx] = <-c
	}

	var result privacyResult
	var foundResult bool

	// go through results of privacyRules and see what the privacy policy returns
	for _, res := range resSlice {
		fmt.Println("res from privacy rule", res)
		if res == privacy.AllowResult {
			foundResult = true
			result = privacyResult{
				visible: true,
				err:     nil,
			}
			break
		} else if res == privacy.DenyResult {
			foundResult = true
			result = privacyResult{
				visible: false,
				err:     nil,
			}
			break
		}
	}

	if !foundResult {
		result = privacyResult{
			visible: false,
			// TODO eventually figure out how to do this with static analysis
			// would be preferable to detect this at compile time instead of runtime
			// or with a test
			err: &InvalidPrivacyRule{},
		}
	}

	privacyResultChan <- result
}

func GenLoadPrivacyAwareNodes(viewer viewer.ViewerContext, id string, nodes interface{}, colName string, entConfig Config, errChan chan<- error) {
	go genLoadNodes(viewer, nodes, errChan, func(chanErr chan<- error) {
		go GenLoadNodes(id, nodes, colName, entConfig, chanErr)
	})
}

func GenLoadPrivacyAwareNodesByType(viewer viewer.ViewerContext, id string, edgeType EdgeType, nodes interface{}, errChan chan<- error) {
	go genLoadNodes(viewer, nodes, errChan, func(chanErr chan<- error) {
		go GenLoadNodesByType(id, edgeType, nodes, chanErr)
	})
}

// function that does the actual work of loading the raw data when fetching a list of nodes
type loadRawNodes func(chanErr chan<- error)

// genLoadNodes takes the raw nodes fetched by whatever means we need to fetch data and applies a privacy check to
// make sure that only the nodes which should be visible are returned to the viewer
// params:...
func genLoadNodes(viewer viewer.ViewerContext, nodes interface{}, errChan chan<- error, nodesLoader loadRawNodes) {
	chanErr := make(chan error)
	go nodesLoader(chanErr)
	err := <-chanErr
	if err != nil {
		errChan <- err
	} else {
		doneChan := make(chan bool)
		go genApplyPrivacyPolicyForEnts(viewer, nodes, doneChan)
		<-doneChan
		errChan <- nil
	}
}

// TODO change eveywhere using interface{}
// TODO figure out go slice polymorphism in a sensible way :/
func genApplyPrivacyPolicyForEnts(viewer viewer.ViewerContext, nodes interface{}, doneChan chan<- bool) {
	// we know it's a slice since loadNodesHelper in data fetching code has already handled this so no need
	// to do the checking again
	// TODO figure out if we can do this without this much reflection
	// OR at least reuse the reflection from lower level in the stack?
	value := reflect.ValueOf(nodes)
	slice := value.Elem()
	direct := reflect.Indirect(value)

	// check privacy policy for each of the nodes
	resSlice := make([]privacyResult, slice.Len())
	for idx := 0; idx < slice.Len(); idx++ {
		node := slice.Index(idx).Interface()
		c := make(chan privacyResult)
		go genApplyPrivacyPolicy(viewer, node, c)
		resSlice[idx] = <-c
	}

	sliceType := slice.Type()
	resNodes := reflect.MakeSlice(sliceType, 0, slice.Cap())

	for idx, res := range resSlice {
		fmt.Println("result.....", res)

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
