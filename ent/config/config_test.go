package config

import (
	"os"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
)

type testData struct {
	DBConfig
	connStringEnv string
	expConnStr    string
	sqlAlchemyURI string
	only          bool
	skip          bool
}

func clearConfig() {
	cfgMutex.Lock()
	defer cfgMutex.Unlock()
	cfg = nil
}

func TestConfig(t *testing.T) {
	tests := map[string]testData{
		"sqlite": {
			connStringEnv: "sqlite:///foo.db",
			DBConfig: DBConfig{
				Dialect:  "sqlite",
				FilePath: "foo.db",
			},
			expConnStr:    "sqlite:///foo.db",
			sqlAlchemyURI: "sqlite:///foo.db",
		},
		"postgres": {
			connStringEnv: "postgres://ola:@localhost/tsent_test",
			DBConfig: DBConfig{
				Dialect:  "postgres",
				Database: "tsent_test",
				User:     "ola",
				Host:     "localhost",
				SslMode:  "disable",
			},
			expConnStr:    "postgres://ola:@localhost/tsent_test?sslmode=disable",
			sqlAlchemyURI: "postgresql+psycopg2://ola:@localhost/tsent_test",
		},
		"postgres with escaped password": {
			connStringEnv: "postgres://ola:kx%40jj5%2Fg@localhost/tsent_test",
			DBConfig: DBConfig{
				Dialect:  "postgres",
				Database: "tsent_test",
				User:     "ola",
				Host:     "localhost",
				SslMode:  "disable",
				Password: "kx@jj5/g",
			},
			expConnStr:    "postgres://ola:kx%40jj5%2Fg@localhost/tsent_test?sslmode=disable",
			sqlAlchemyURI: "postgresql+psycopg2://ola:kx%40jj5%2Fg@localhost/tsent_test",
		},
	}

	hasOnly := false
	hasSkip := false
	for _, test := range tests {
		if test.only {
			hasOnly = true
		}
		if test.skip {
			hasSkip = true
		}
	}

	for name, test := range tests {
		if hasOnly && !test.only {
			continue
		}
		if hasSkip && test.skip {
			continue
		}
		t.Run(name, func(t *testing.T) {
			clearConfig()
			os.Setenv("DB_CONNECTION_STRING", test.connStringEnv)

			assert.Equal(t, GetConnectionStr(), test.expConnStr)
			db := Get().DB
			assert.Equal(t, test.Dialect, db.Dialect)
			assert.Equal(t, test.FilePath, db.FilePath)
			assert.Equal(t, test.Database, db.Database)
			assert.Equal(t, test.User, db.User)
			assert.Equal(t, test.Password, db.Password)
			assert.Equal(t, test.Host, db.Host)
			assert.Equal(t, test.Pool, db.Pool)
			assert.Equal(t, test.Port, db.Port)
			assert.Equal(t, test.SslMode, db.SslMode)
			assert.Equal(t, test.expConnStr, db.GetConnectionStr())
			assert.Equal(t, test.sqlAlchemyURI, db.GetSQLAlchemyDatabaseURIgo())

			os.Unsetenv("DB_CONNECTION_STRING")
		})
	}
}

func TestConcurrentGet(t *testing.T) {
	clearConfig()
	t.Cleanup(clearConfig)
	t.Setenv("DB_CONNECTION_STRING", "sqlite:///:memory:")

	const goroutines = 32
	start := make(chan struct{})
	configs := make(chan *Config, goroutines)
	var wg sync.WaitGroup
	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			configs <- Get()
		}()
	}

	close(start)
	wg.Wait()
	close(configs)

	var first *Config
	for current := range configs {
		if first == nil {
			first = current
			continue
		}
		assert.Same(t, first, current)
	}
}
