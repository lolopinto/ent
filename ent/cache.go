package ent

import (
	"context"
	"fmt"
	"time"

	"github.com/pkg/errors"
	"github.com/rocketlaunchr/remember-go"
	"github.com/rocketlaunchr/remember-go/memory"
)

type cachedItem struct {
	data map[string]interface{}
	err  error
}

var ms = memory.NewMemoryStore(1 * time.Hour)

// call this something like loader or something
// which handles cache hit/ get/miss
func getItemFromCacheMaybe(key string, dataFunc func() (map[string]interface{}, error)) (map[string]interface{}, error) {
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
	result, found, err := remember.Cache(ctx, ms, key, 1*time.Hour, fn)
	if err != nil {
		fmt.Println("error getting item from cache. whelp")
	}
	if found {
		fmt.Println("cache hit for key ", key)
		//		spew.Dump(result)
	}
	data, ok := result.(*cachedItem)
	if !ok {
		return nil, errors.New("got incorrect item from cache. whelp")
	}
	// do we wanna cache errors? right now yes. todo come back to that?
	// todo depends on the types of errors
	// caching it so far so we don't hammer the db for no data rows
	return data.data, data.err
}

func deleteKey(key string) {
	ms.Forget(key)
}

// type loader interface {
// 	GetKey() string
// 	DataFunc() (interface{}, error)
// }

//func loadItem(load loader )
