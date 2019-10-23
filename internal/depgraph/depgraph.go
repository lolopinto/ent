package depgraph

import (
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
func (g *Depgraph) Run(exec func(interface{})) {
	itemsToCheck := []*data{}
	for _, item := range g.items {
		if !g.checkDependenciesCompleted(item) {
			itemsToCheck = append(itemsToCheck, item)
			continue
		}
		exec(item.value)
		item.completed = true
	}

	i := 1
	for len(itemsToCheck) > 0 {
		i++
		if i == 5 {
			panic("dependency graph not resolving. halp!")
		}
		newItems := g.runDepgraph(itemsToCheck, exec)
		itemsToCheck = newItems
	}
}

func (g *Depgraph) runDepgraph(itemsToCheck []*data, exec func(interface{})) []*data {
	newItems := []*data{}
	for _, item := range itemsToCheck {
		if !g.checkDependenciesCompleted(item) {
			newItems = append(newItems, item)
			continue
		}
		exec(item.value)
		item.completed = true
	}
	return newItems
}

type queueItem struct {
	item *data
	exec func(interface{})
}

func (g *Depgraph) CheckAndQueue(key string, exec func(interface{})) {
	item, ok := g.items[key]
	if !ok {
		panic(fmt.Sprintf("no function exists for key item %s", key))
	}
	item.flagged = true
	if g.checkDependenciesCompleted(item) {
		exec(item.value)
		item.completed = true
	} else {
		g.queue = append(g.queue, &queueItem{
			item: item,
			exec: exec,
		})
	}
}

func (g *Depgraph) ClearOptionalItems() {
	for _, v := range g.items {
		if v.optional && !v.flagged {
			v.completed = true
		}
	}
}

func (g *Depgraph) RunQueuedUpItems() {
	i := 1
	queue := g.queue
	for len(queue) > 0 {
		if i == 5 {
			panic("dependency graph not resolving. halp!")
		}
		newQueue := g.runQueue(queue)
		queue = newQueue
		i = i + 1
	}
	g.queue = nil
}

func (g *Depgraph) runQueue(queue []*queueItem) []*queueItem {
	newQueue := []*queueItem{}
	for _, q := range queue {
		if !g.checkDependenciesCompleted(q.item) {
			newQueue = append(newQueue, q)
			continue
		}
		q.exec(q.item.value)
		q.item.completed = true
	}
	return newQueue
}

// RunLoop is used in scenarios where the client needs to control what's run and what's passed. they should
// "override" RunLoop(), call CheckAndQueue() for each item and then call RunQueuedUpItems once afterwards to run the rest
func (g *Depgraph) RunLoop() {
	panic("need client to implement")
}

func (g *Depgraph) checkDependenciesCompleted(item *data) bool {
	if len(item.deps) == 0 {
		return true
	}
	for _, dep := range item.deps {
		depItem, ok := g.items[dep]
		if !ok {
			panic(fmt.Errorf("a dependency was added on key %s but no function exists for it", dep))
		}
		if !depItem.completed {
			return false
		}
	}
	return true
}
