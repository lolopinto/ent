package config

import (
	"io/ioutil"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
	"github.com/lolopinto/ent/internal/util"
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

	// Todo probably throw here?
	if db.rawDBInfo == nil {
		panic("no connection string or db ")
	}

	return db.rawDBInfo.GetConnectionStr("postgres", true)
}

func (db *DBConfig) GetSQLAlchemyDatabaseURIgo() string {
	if db.connection != "" {
		return db.connection
	}
	// postgres only for now as above. specific driver also
	// no ssl mode
	return db.rawDBInfo.GetConnectionStr("postgres", false)
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

func (dbData *RawDbInfo) GetConnectionStr(driver string, sslmode bool) string {
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

func GetConnectionStr() string {
	cfg := Get()
	if cfg == nil {
		log.Fatalf("invalid config")
	}
	return cfg.DB.GetConnectionStr()
}

func ResetConfig(rdbi *RawDbInfo) {
	cfg = &Config{
		DB: &DBConfig{
			rawDBInfo: rdbi,
		},
	}
}

func loadDBConfig() *DBConfig {
	// DB_CONNECTION_STRING trumps file
	conn := util.GetEnv("DB_CONNECTION_STRING", "")
	if conn != "" {
		return &DBConfig{
			connection: conn,
		}
	}

	path := util.GetEnv("PATH_TO_DB_FILE", "config/database.yml")
	_, err := os.Stat(path)
	if err != nil {
		log.Fatalf("no way to get db config :%v", err)
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
