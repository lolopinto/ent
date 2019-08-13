package ent

import (
	"context"
	"fmt"
	"time"

	"github.com/davecgh/go-spew/spew"
	"github.com/pkg/errors"
	"github.com/rocketlaunchr/remember-go"
	"github.com/rocketlaunchr/remember-go/memory"
)

type cachedItem struct {
	data map[string]interface{}
	err  error
}

type cachedItems struct {
	datas []map[string]interface{}
	err   error
}

type cacheRetrievalFunc func() (interface{}, bool, error)

const cacheTTL = 1 * time.Hour

var ms = memory.NewMemoryStore(cacheTTL)

// call this something like loader or something
// which handles cache hit/ get/miss
func getItemFromCacheMaybe(key string, dataFunc func() (map[string]interface{}, error)) (map[string]interface{}, error) {
	if key == "" {
		panic("invalid key")
	}

	ctx := context.Background()
	// memory store
	//	ms := memory.NewMemoryStore(10 * time.Minute)
	fn := func(ctx context.Context) (interface{}, error) {
		res, err := dataFunc()
		return &cachedItem{
			data: res,
			err:  err,
		}, nil
	}

	// var cacheFunc cacheRetrievalFunc
	// cacheFunc =

	data, err := getSingleCachedItem(key, func() (interface{}, bool, error) {
		return remember.Cache(ctx, ms, key, cacheTTL, fn, remember.Options{
			// DisableCacheUsage: true,
			// UseFreshData:      true,
		})
	})
	if err != nil {
		return nil, err
	}

	// if data == nil {
	// 	return nil, nil
	// }
	// result, found, err := remember.Cache(ctx, ms, key, 1*time.Hour, fn)
	// if err != nil {
	// 	fmt.Println("error getting item from cache. whelp")
	// }
	// if found {
	// 	spew.Dump("cache hit for key ", key)
	// 	//		spew.Dump(result)
	// }
	// data, ok := result.(*cachedItem)
	// if !ok {
	// 	return nil, errors.New("got incorrect item from cache. whelp")
	// }
	// do we wanna cache errors? right now yes. todo come back to that?
	// todo depends on the types of errors
	// caching it so far so we don't hammer the db for no data rows
	return data.data, data.err
}

func getItemsFromCacheMaybe(key string, dataFunc func() ([]map[string]interface{}, error)) ([]map[string]interface{}, error) {
	if key == "" {
		panic("invalid key")
	}
	ctx := context.Background()
	// memory store
	//	ms := memory.NewMemoryStore(10 * time.Minute)
	fn := func(ctx context.Context) (interface{}, error) {
		res, err := dataFunc()
		return &cachedItems{
			datas: res,
			err:   err,
		}, nil
	}
	// data, err = getSingleCachedItem(key, func() cacheRetrievalFunc {
	// 	remember.Cache(ctx, ms, key, 1*time.Hour, fn)
	// })
	// if err != nil {
	// 	return nil, err
	// }
	result, found, err := remember.Cache(ctx, ms, key, 1*time.Hour, fn, remember.Options{
		// DisableCacheUsage: true,
		// UseFreshData:      true,
	})
	if err != nil {
		fmt.Println("error getting items from cache. whelp")
		spew.Dump("key", key, "result", result, "found", found, "err", err)
	}
	if found {
		//		spew.Dump("cache hit for key ", key)
		//		spew.Dump(result)
	}
	data, ok := result.(*cachedItems)
	if !ok {
		return nil, errors.New("got incorrect item from cache. whelp")
	}
	// do we wanna cache errors? right now yes. todo come back to that?
	// todo depends on the types of errors
	// caching it so far so we don't hammer the db for no data rows
	return data.datas, data.err
}

func getSingleCachedItem(key string, cacheFunc cacheRetrievalFunc) (*cachedItem, error) {
	result, found, err := cacheFunc()
	if err != nil {
		fmt.Println("error getting item from cache. whelp")
		//		spew.Dump("key", key, "result", result, "found", found, "err", err)
		return nil, err
	}
	//	spew.Dump(result, found, err)
	if found { // literally just means cache hit
		//		spew.Dump("cache hit for key ", key)
		//		spew.Dump(result)
	}
	// nothing in the cache
	if result == nil {
		return nil, nil
	}
	data, ok := result.(*cachedItem)
	if !ok {
		//		spew.Dump("result", result, "key", key, "item in cache")
		return nil, errors.New("got incorrect item from cache. whelp")
	}
	return data, nil
}

func setSingleCachedItem(key string, dataItem map[string]interface{}, err error) {
	//	spew.Dump("setcachevalue", key, dataItem, err)
	ms.Set(key, cacheTTL, &cachedItem{data: dataItem, err: err})
}

func deleteKey(key string) {
	ms.Forget(key)
}

func getItemInCache(key string) (map[string]interface{}, error) {
	//	loadNodesHelper
	data, err := getSingleCachedItem(key, func() (interface{}, bool, error) {
		return ms.Get(key)
	})
	if err != nil {
		return nil, err
	}
	// no cached item
	if data == nil {
		return nil, nil
	}
	return data.data, nil
}

//func splitKeys()

// type loader interface {
// 	GetKey() string
// 	DataFunc() (interface{}, error)
// }

//func loadItem(load loader )
