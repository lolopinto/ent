package ent

// TODO everything here needs work
import (
	"context"
	"fmt"
	"time"

	"github.com/lolopinto/ent/internal/util"
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
		util.GoSchemaKill("invalid key")
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

	data, err := getSingleCachedItem(key, func() (interface{}, bool, error) {
		return remember.Cache(ctx, ms, key, cacheTTL, fn)
	})
	if err != nil {
		return nil, err
	}

	// do we wanna cache errors? right now yes. todo come back to that?
	// todo depends on the types of errors
	// caching it so far so we don't hammer the db for no data rows
	return data.data, data.err
}

func getItemsFromCacheMaybe(key string, dataFunc func() ([]map[string]interface{}, error)) ([]map[string]interface{}, error) {
	if key == "" {
		util.GoSchemaKill("invalid key")
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

	data, err := getMultiCacheItem(key, func() (interface{}, bool, error) {
		return remember.Cache(ctx, ms, key, 1*time.Hour, fn)
	})

	if err != nil {
		return nil, err
	}
	// do we wanna cache errors? right now yes. todo come back to that?
	// todo depends on the types of errors
	// caching it so far so we don't hammer the db for no data rows
	return data.datas, data.err
}

func cacheRetrieval(key string, cacheFunc cacheRetrievalFunc) (interface{}, error) {
	result, found, err := cacheFunc()
	if err != nil {
		fmt.Println("error getting item from cache. whelp")
		//		spew.Dump("key", key, "result", result, "found", found, "err", err)
		return nil, err
	}
	//	spew.Dump(result, found, err)
	if found { // literally just means cache hit
		//		fmt.Println("cache hit for key ", key)
		//		spew.Dump(result)
	}
	// nothing in the cache
	if result == nil {
		return nil, nil
	}

	return result, nil
}

func getSingleCachedItem(key string, cacheFunc cacheRetrievalFunc) (*cachedItem, error) {
	result, err := cacheRetrieval(key, cacheFunc)
	if err != nil {
		return nil, err
	} else if result == nil {
		return nil, nil
	}
	data, ok := result.(*cachedItem)
	if !ok {
		//		spew.Dump("result", result, "key", key, "item in cache")
		return nil, errors.New("got incorrect item from cache. whelp")
	}
	return data, nil
}

func getMultiCacheItem(key string, cacheFunc cacheRetrievalFunc) (*cachedItems, error) {
	result, err := cacheRetrieval(key, cacheFunc)
	if err != nil {
		return nil, err
	} else if result == nil {
		return nil, nil
	}
	data, ok := result.(*cachedItems)
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
	//fmt.Println("delete key", key)
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

func getItemsInCache(key string) ([]map[string]interface{}, error) {
	data, err := getMultiCacheItem(key, func() (interface{}, bool, error) {
		return ms.Get(key)
	})
	if err != nil {
		return nil, err
	}
	// no cached item
	if data == nil {
		return nil, nil
	}
	return data.datas, nil
}

// type loader interface {
// 	GetKey() string
// 	DataFunc() (interface{}, error)
// }

//func loadItem(load loader )
