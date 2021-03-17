package cache

import (
	"time"

	"github.com/go-redis/redis"
)

type Redis struct {
	client *redis.Client
}

func NewRedis(option *redis.Options) (*Redis, error) {
	client := redis.NewClient(option)
	_, err := client.Ping().Result()
	if err != nil {
		return nil, err
	}
	return &Redis{
		redis.NewClient(option),
	}, nil
}

func (r *Redis) Get(key string) (interface{}, bool, error) {
	val, err := r.client.Get(key).Result()
	if err != nil {
		if err == redis.Nil {
			return val, false, nil
		}
		return val, false, err
	}
	return val, true, nil
}

func (r *Redis) Set(key string, val interface{}, d time.Duration) error {
	return r.client.Set(key, val, d).Err()
}

func (r *Redis) Delete(key string) error {
	return r.client.Del(key).Err()
}

func (r *Redis) Clear() error {
	return r.client.FlushAll().Err()
}
