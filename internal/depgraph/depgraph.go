package depgraph

import (
	"errors"
	"fmt"
)

type data struct {
	value     interface{}
	completed bool
	deps      []string // todo this can eventually be a graph but we're keeping this simple for now
	optional  bool
	flagged   bool
}

type Depgraph struct {
	items map[string]*data
	queue []*queueItem
}

func (g *Depgraph) AddItem(key string, value interface{}, deps ...string) {
	if g.items == nil {
		g.items = make(map[string]*data)
	}
	g.items[key] = &data{
		value:     value,
		completed: false,
		deps:      deps,
	}
}

func (g *Depgraph) AddOptionalItem(key string, value interface{}) {
	g.AddItem(key, value)
	g.items[key].optional = true
}

// Run runs the dependency graph. takes a func that takes an interface{}, calls it exactly once for everything that has been added
// and makes sure it's called exactly once for each
func (g *Depgraph) Run(exec func(interface{}) error) error {
	itemsToCheck := []*data{}
	for _, item := range g.items {
		check, err := g.checkDependenciesCompleted(item)
		if err != nil {
			return err
		}
		if !check {
			itemsToCheck = append(itemsToCheck, item)
			continue
		}
		if err := exec(item.value); err != nil {
			return err
		}
		item.completed = true
	}

	i := 1
	for len(itemsToCheck) > 0 {
		i++
		if i == 5 {
			return errors.New("dependency graph not resolving. halp")
		}
		newItems, err := g.runDepgraph(itemsToCheck, exec)
		if err != nil {
			return err
		}
		itemsToCheck = newItems
	}
	return nil
}

func (g *Depgraph) runDepgraph(itemsToCheck []*data, exec func(interface{}) error) ([]*data, error) {
	newItems := []*data{}
	for _, item := range itemsToCheck {
		check, err := g.checkDependenciesCompleted(item)
		if err != nil {
			return nil, err
		}
		if !check {
			newItems = append(newItems, item)
			continue
		}
		if err := exec(item.value); err != nil {
			return nil, err
		}
		item.completed = true
	}
	return newItems, nil
}

type queueItem struct {
	item *data
	exec func(interface{}) error
}

func (g *Depgraph) CheckAndQueue(key string, exec func(interface{}) error) error {
	item, ok := g.items[key]
	if !ok {
		return fmt.Errorf("no function exists for key item %s", key)
	}
	item.flagged = true
	check, err := g.checkDependenciesCompleted(item)
	if err != nil {
		return err
	}
	if check {
		exec(item.value)
		item.completed = true
	} else {
		g.queue = append(g.queue, &queueItem{
			item: item,
			exec: exec,
		})
	}
	return nil
}

func (g *Depgraph) ClearOptionalItems() {
	for _, v := range g.items {
		if v.optional && !v.flagged {
			v.completed = true
		}
	}
}

func (g *Depgraph) RunQueuedUpItems() error {
	i := 1
	queue := g.queue
	for len(queue) > 0 {
		if i == 5 {
			return errors.New("dependency graph not resolving. halp")
		}
		newQueue, err := g.runQueue(queue)
		if err != nil {
			return err
		}
		queue = newQueue
		i = i + 1
	}
	g.queue = nil
	return nil
}

func (g *Depgraph) runQueue(queue []*queueItem) ([]*queueItem, error) {
	newQueue := []*queueItem{}
	for _, q := range queue {
		check, err := g.checkDependenciesCompleted(q.item)
		if err != nil {
			return nil, err
		}
		if !check {
			newQueue = append(newQueue, q)
			continue
		}
		q.exec(q.item.value)
		q.item.completed = true
	}
	return newQueue, nil
}

// RunLoop is used in scenarios where the client needs to control what's run and what's passed. they should
// "override" RunLoop(), call CheckAndQueue() for each item and then call RunQueuedUpItems once afterwards to run the rest
func (g *Depgraph) RunLoop() error {
	return fmt.Errorf("need client to implement")
}

func (g *Depgraph) checkDependenciesCompleted(item *data) (bool, error) {
	if len(item.deps) == 0 {
		return true, nil
	}
	for _, dep := range item.deps {
		depItem, ok := g.items[dep]
		if !ok {
			return false, fmt.Errorf("a dependency was added on key %s but no function exists for it", dep)
		}
		if !depItem.completed {
			return false, nil
		}
	}
	return true, nil
}
