package ent

// TODO everything here needs work
import (
	"fmt"
	"time"

	"github.com/lolopinto/ent/internal/util"
	"github.com/pkg/errors"
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

// call this something like loader or something
// which handles cache hit/ get/miss
func getItemFromCacheMaybe(key string, dataFunc func() (map[string]interface{}, error)) (map[string]interface{}, error) {
	if key == "" {
		util.GoSchemaKill("invalid key")
	}

	data, err := getSingleCachedItem(key, func() (interface{}, bool, error) {
		return nil, false, nil
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

	data, err := getMultiCacheItem(key, func() (interface{}, bool, error) {
		return nil, false, nil
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

}

func deleteKey(key string) {
	//fmt.Println("delete key", key)

}

func getItemInCache(key string) (map[string]interface{}, error) {
	//	loadNodesHelper
	data, err := getSingleCachedItem(key, func() (interface{}, bool, error) {
		return nil, false, nil
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
		return nil, false, nil
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
