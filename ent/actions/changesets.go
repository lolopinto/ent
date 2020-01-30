package actions

import (
	"sync"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/syncerr"
)

func runChangesets(changesetFn ...func() (ent.Changeset, error)) ([]ent.Changeset, error) {
	if len(changesetFn) == 1 {
		c, err := changesetFn[0]()
		return []ent.Changeset{c}, err
	}

	var serr syncerr.Error
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
			serr.Append(err)
			m.Lock()
			defer m.Unlock()
			if c != nil {
				changesets = append(changesets, c)
			}
		}(idx)
	}
	wg.Wait()
	if err := serr.Err(); err != nil {
		return nil, err
	}
	return changesets, nil
}
