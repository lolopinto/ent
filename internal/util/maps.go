package util

import "sync"

type ScyncedMap[K comparable, V any] struct {
	m     map[K]V
	mutex sync.RWMutex
}

func NewSyncedMap[K comparable, V any]() *ScyncedMap[K, V] {
	return &ScyncedMap[K, V]{
		m: make(map[K]V),
	}
}

func (sm *ScyncedMap[K, V]) Load(key K) (value V, ok bool) {
	sm.mutex.RLock()
	defer sm.mutex.RUnlock()
	value, ok = sm.m[key]
	return
}

func (sm *ScyncedMap[K, V]) Store(key K, value V) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()
	sm.m[key] = value
}

func (sm *ScyncedMap[K, V]) Update(key K, update func(value V, ok bool) V) {
	sm.mutex.Lock()
	defer sm.mutex.Unlock()
	value, ok := sm.m[key]
	sm.m[key] = update(value, ok)
}

func (sm *ScyncedMap[K, V]) Keys() []K {
	sm.mutex.RLock()
	defer sm.mutex.RUnlock()
	keys := make([]K, 0, len(sm.m))
	for key := range sm.m {
		keys = append(keys, key)
	}
	return keys
}
