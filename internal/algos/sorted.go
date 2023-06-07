package algos

import (
	"golang.org/x/exp/constraints"
	"golang.org/x/exp/slices"
)

type key interface {
	constraints.Ordered
	comparable
}

type SortedMap[K key, V any] struct {
	m    map[K]V
	keys []K
}

func NewSortedMap[K key, V any]() *SortedMap[K, V] {
	return &SortedMap[K, V]{m: make(map[K]V)}
}

func (s *SortedMap[K, V]) Set(key K, value V) {
	if _, ok := s.m[key]; !ok {
		s.keys = append(s.keys, key)
		s.sort()
	}
	s.m[key] = value
}

func (s *SortedMap[K, V]) sort() {
	slices.Sort(s.keys)
}

func (s *SortedMap[K, V]) Get(key K) (V, bool) {
	v, ok := s.m[key]
	return v, ok
}

func (s *SortedMap[K, V]) Delete(key K) {
	delete(s.m, key)
	for i, k := range s.keys {
		if k == key {
			s.keys = append(s.keys[:i], s.keys[i+1:]...)
			s.sort()
			break
		}
	}
}

func (s *SortedMap[K, V]) Keys() []K {
	return s.keys
}

func (s *SortedMap[K, V]) Values() []V {
	ret := make([]V, len(s.keys))
	for i, k := range s.keys {
		ret[i] = s.m[k]
	}
	return ret
}

func (s *SortedMap[K, V]) Len() int {
	return len(s.keys)
}

func (s *SortedMap[K, V]) ForEachE(f func(k K, v V) error) error {
	for _, k := range s.keys {
		if err := f(k, s.m[k]); err != nil {
			return err
		}
	}
	return nil
}

func (s *SortedMap[K, V]) ForEach(f func(k K, v V)) {
	for _, k := range s.keys {
		f(k, s.m[k])
	}
}
