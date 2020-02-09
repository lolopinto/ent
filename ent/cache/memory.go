package cache

import (
	"time"

	"github.com/patrickmn/go-cache"
)

type Memory struct {
	cache *cache.Cache
}

func NewMemory(defaultExpiration, cleanupInterval time.Duration) *Memory {
	c := cache.New(defaultExpiration, cleanupInterval)
	return &Memory{cache: c}
}

func (m *Memory) Get(key string) (interface{}, bool) {
	return m.cache.Get(key)
}

func (m *Memory) Set(key string, val interface{}, d time.Duration) {
	m.cache.Set(key, val, d)
}

func (m *Memory) Delete(key string) {
	m.cache.Delete(key)
}
