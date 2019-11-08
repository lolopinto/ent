package actions

import (
	"sync"

	"github.com/lolopinto/ent/ent"
)

func runChangesets(changesetFn ...func() (ent.Changeset, error)) ([]ent.Changeset, error) {
	if len(changesetFn) == 1 {
		c, err := changesetFn[0]()
		return []ent.Changeset{c}, err
	}

	var errs []error
	var changesets []ent.Changeset

	var wg sync.WaitGroup
	wg.Add(len(changesetFn))
	for idx := range changesetFn {
		fn := changesetFn[idx]
		f := func(fn func() (ent.Changeset, error)) {
			defer wg.Done()
			c, err := fn()
			// hmm this may not be the best way. is this safe?
			if err != nil {
				errs = append(errs, err)
			}
			if c != nil {
				changesets = append(changesets, c)
			}
		}
		go f(fn)
	}
	wg.Wait()
	if len(errs) != 0 {
		// TODO we need the list of errors abstraction
		return nil, errs[0]
	}
	return changesets, nil
}
