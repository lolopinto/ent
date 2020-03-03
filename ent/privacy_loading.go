package ent

import (
	"fmt"
	"log"
	"reflect"
	"runtime/debug"
	"sync"

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

// LoadNode fetches an id given the viewer and id
func LoadNode(v viewer.ViewerContext, id string, loader PrivacyBackedLoader) error {
	if id == "" {
		debug.PrintStack()
	}
	l := &loadNodeLoader{
		id:        id,
		entLoader: loader,
	}

	return loadNodeFromLoader(v, loader, l)
}

// GenLoadNode is the concurrent version of LoadNode.
func GenLoadNode(v viewer.ViewerContext, id string, loader PrivacyBackedLoader) <-chan error {
	res := make(chan error)
	go func() {
		res <- LoadNode(v, id, loader)
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

// LoadNodeViaQueryClause loads a node with a query clause e.g. load the user given the query
// to load via email address like sql.Eq("email_address", "test@example.com")
func LoadNodeViaQueryClause(v viewer.ViewerContext, entLoader PrivacyBackedLoader, clause sql.QueryClause) error {
	l := &loadNodeLoader{
		entLoader: entLoader,
		clause:    clause,
	}
	return loadNodeFromLoader(v, entLoader, l)
}

// GenLoadNodesViaQueryClause loads a list of nodes givens a query clause e.g. fetching all nodes with a foreign key
func GenLoadNodesViaQueryClause(v viewer.ViewerContext, entLoader PrivacyBackedLoader, clause sql.QueryClause) <-chan error {
	return genLoadNodesImpl(v, func() multiEntResult {
		return loadNodesViaClause(entLoader, clause)
	})
}

// LoadNodesViaQueryClause loads a list of nodes givens a query clause e.g. fetching all nodes with a foreign key
func LoadNodesViaQueryClause(v viewer.ViewerContext, entLoader PrivacyBackedLoader, clause sql.QueryClause) error {
	return loadNodesImpl(v, func() multiEntResult {
		return loadNodesViaClause(entLoader, clause)
	})
}

// GenLoadNodes loads a list of nodes given the ids
func GenLoadNodes(v viewer.ViewerContext, ids []string, entLoader PrivacyBackedLoader) <-chan error {
	return genLoadNodesImpl(v, func() multiEntResult {
		return loadNodes(ids, entLoader)
	})
}

// LoadNodes loads a list of nodes given the ids
func LoadNodes(v viewer.ViewerContext, ids []string, entLoader PrivacyBackedLoader) error {
	return loadNodesImpl(v, func() multiEntResult {
		return loadNodes(ids, entLoader)
	})
}

// GenLoadNodesByType loads a list of nodes given the id and edgetype
func GenLoadNodesByType(v viewer.ViewerContext, id string, edgeType EdgeType, entLoader PrivacyBackedLoader) <-chan error {
	return genLoadNodesImpl(v, func() multiEntResult {
		return loadNodesByType(id, edgeType, entLoader)
	})
}

// LoadNodesByType loads a list of nodes given the id and edgetype
func LoadNodesByType(v viewer.ViewerContext, id string, edgeType EdgeType, entLoader PrivacyBackedLoader) error {
	return loadNodesImpl(v, func() multiEntResult {
		return loadNodesByType(id, edgeType, entLoader)
	})
}

// LoadUniqueNodeByType loads the unique node for a given edge type
func LoadUniqueNodeByType(v viewer.ViewerContext, id string, edgeType EdgeType, loader PrivacyBackedLoader) error {
	edge, err := LoadUniqueEdgeByType(id, edgeType)
	if err != nil || edge == nil {
		return err
	}
	return LoadNode(v, edge.ID2, loader)
}

// GenLoadUniqueNodeByType loads the unique node for a given edge type
func GenLoadUniqueNodeByType(v viewer.ViewerContext, id string, edgeType EdgeType, loader PrivacyBackedLoader) chan error {
	ret := make(chan error)
	go func() {
		ret <- LoadUniqueNodeByType(v, id, edgeType, loader)
	}()
	return ret
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

func applyPrivacyPolicyUnsure(v viewer.ViewerContext, maybeEnt DBObject, loader PrivacyBackedLoader) error {
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
		loader.SetPrivacyResult(ent.GetID(), nil, err)
	}

	return err
}

// function that does the actual work of loading the raw data when fetching a list of nodes
type loadRawNodes func() multiEntResult

type multiEntResult struct {
	loader Loader
	ents   []DBObject
	err    error
}

func getMultiEntResult(entLoader Loader, l *loadNodesLoader, err error) multiEntResult {
	if err != nil {
		return multiEntResult{
			err: err,
		}
	}
	return multiEntResult{
		ents:   l.dbobjects,
		loader: entLoader,
	}
}

// genLoadNodesImpl takes the raw nodes fetched by whatever means we need to fetch data and applies a privacy check to
// make sure that only the nodes which should be visible are returned to the viewer
func genLoadNodesImpl(v viewer.ViewerContext, nodesLoader loadRawNodes) <-chan error {
	res := make(chan error)
	go func() {
		res <- loadNodesImpl(v, nodesLoader)
	}()
	return res
}

func loadNodesImpl(v viewer.ViewerContext, nodesLoader loadRawNodes) error {
	loaderResult := nodesLoader()
	if loaderResult.err != nil {
		return loaderResult.err
	}
	entLoader := loaderResult.loader
	privacyLoader, ok := entLoader.(PrivacyBackedLoader)
	if !ok {
		return errors.New("invalid loader passed here. need a PrivacyBackedMultiEntLoader")
	}
	applyPrivacyPolicyForEnts(v, privacyLoader, loaderResult.ents)
	return nil
}

func applyPrivacyPolicyForEnts(v viewer.ViewerContext, entLoader PrivacyBackedLoader, ents []DBObject) {
	var wg sync.WaitGroup
	wg.Add(len(ents))
	for idx := range ents {
		go func(idx int) {
			defer wg.Done()
			obj := ents[idx]

			applyPrivacyPolicyUnsure(v, obj, entLoader)
		}(idx)
	}
	wg.Wait()
}

func loadNodeFromLoader(v viewer.ViewerContext, loader PrivacyBackedLoader, l *loadNodeLoader) error {
	err := loadData(l)
	ent := l.GetEntity()
	// there's an error loading raw data, return the value here and we're done.
	if err != nil {
		return err
	}

	// check privacy policy...
	// note that when loading the one item we send that error back to error out the entire
	// thing just so that it's clearer to the client that loading the item
	// wasn't as expected.
	return applyPrivacyPolicyUnsure(v, ent, loader)
}

func loadNodesViaClause(entLoader Loader, clause sql.QueryClause) multiEntResult {
	l := &loadNodesLoader{
		entLoader: entLoader,
		clause:    clause,
	}
	err := loadData(l)
	return getMultiEntResult(entLoader, l, err)
}

func loadNodesByType(id string, edgeType EdgeType, entLoader Loader) multiEntResult {
	l := &loadNodesLoader{
		entLoader: entLoader,
	}
	err := chainLoaders(
		[]loader{
			&loadEdgesByType{
				id:         id,
				edgeType:   edgeType,
				outputID2s: true,
			},
			l,
		},
	)
	return getMultiEntResult(entLoader, l, err)
}

func loadNodes(ids []string, entLoader Loader) multiEntResult {
	l := &loadNodesLoader{
		ids:       ids,
		entLoader: entLoader,
	}
	err := loadData(l)
	return getMultiEntResult(entLoader, l, err)
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
