package config

import (
	"io/ioutil"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
	"gopkg.in/yaml.v2"
)

type Config struct {
	DB *DBConfig
}

type DBConfig struct {
	// depending on what we have return what's needed?
	connection string
	rawDBInfo  *RawDbInfo
}

func (db *DBConfig) GetConnectionStr() string {
	if db.connection != "" {
		return db.connection
	}

	dbData := db.rawDBInfo
	// Todo probably throw here?
	if dbData == nil {
		return ""
	}

	return getConnectionStr(dbData, "postgres", true)
}

func (db *DBConfig) GetSQLAlchemyDatabaseURIgo() string {
	// postgres only for now as above. specific driver also
	// TODO handle null connection string
	// no ssl mode
	return getConnectionStr(db.rawDBInfo, "postgresql+pg8000", false)
}

func getConnectionStr(dbData *RawDbInfo, driver string, sslmode bool) string {
	format := "{driver}://{user}:{password}@{host}:{port}/{dbname}"
	parts := []string{
		"{driver}", driver,
		"{user}", dbData.User,
		"{password}", dbData.Password,
		"{host}", dbData.Host,
		"{port}", strconv.Itoa(dbData.Port),
		"{dbname}", dbData.Database,
	}
	if sslmode {
		format = format + "?sslmode={sslmode}"
		parts = append(parts, []string{
			"{sslmode}", dbData.SslMode,
		}...)
	}
	r := strings.NewReplacer(parts...)

	return r.Replace(format)
}

type RawDbInfo struct {
	Dialect  string `yaml:"dialect"`
	Database string `yaml:"database"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Pool     int    `yaml:"pool"`
	SslMode  string `yaml:"sslmode"`
}

func init() {
	// load any .env file if it exists
	if err := godotenv.Load(); err != nil {
	}
}

var cfg *Config

// Get returns the singleton config for the application
func Get() *Config {
	if cfg == nil {
		cfg = &Config{
			DB: loadDBConfig(),
		}
	}
	return cfg
}

func loadDBConfig() *DBConfig {
	// this is what we'll use in production. what render supports
	conn := getEnv("DB_CONNECTION_STRING", "")
	if conn != "" {
		return &DBConfig{
			connection: conn,
		}
	}
	// for tests and development
	path := getEnv("PATH_TO_DB_FILE", "config/database.yml")
	if path == "" {
		return nil
	}
	b, err := ioutil.ReadFile(path)
	if err != nil {
		log.Fatalf("could not read yml file to load db: %v", err)
	}
	var dbData RawDbInfo
	err = yaml.Unmarshal(b, &dbData)
	if err != nil {
		log.Fatal(err)
		log.Fatalf("error unmarshalling file: %v", err)
	}

	// validate that this is something useful
	if dbData.Host == "" ||
		dbData.User == "" ||
		dbData.Database == "" ||
		dbData.Dialect != "postgres" {
		log.Fatalf("invalid database configuration")
	}

	return &DBConfig{
		rawDBInfo: &dbData,
	}
}

func getEnv(key, defaultValue string) string {
	val, ok := os.LookupEnv(key)
	if ok {
		return val
	}
	return defaultValue
}
