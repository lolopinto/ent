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
	var m sync.Mutex
	var changesets []ent.Changeset

	var wg sync.WaitGroup
	wg.Add(len(changesetFn))
	for idx := range changesetFn {
		go func(idx int) {
			fn := changesetFn[idx]

			defer wg.Done()
			c, err := fn()
			if c == nil && err == nil {
				return
			}
			m.Lock()
			defer m.Unlock()
			if err != nil {
				errs = append(errs, err)
			}
			if c != nil {
				changesets = append(changesets, c)
			}
		}(idx)
	}
	wg.Wait()
	if len(errs) != 0 {
		// TODO we need the list of errors abstraction
		return nil, errs[0]
	}
	return changesets, nil
}
