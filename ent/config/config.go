package config

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/jmoiron/sqlx"
	"github.com/joho/godotenv"
	"github.com/lib/pq"
	"github.com/lolopinto/ent/internal/util"
	"github.com/pkg/errors"
	"gopkg.in/yaml.v2"
)

type Config struct {
	DB *DBConfig
}

type DBConfig struct {
	Dialect    string `yaml:"dialect"`
	Database   string `yaml:"database"`
	User       string `yaml:"user"`
	Password   string `yaml:"password"`
	Host       string `yaml:"host"`
	Port       int    `yaml:"port"`
	Pool       int    `yaml:"pool"`
	SslMode    string `yaml:"sslmode"`
	FilePath   string `yaml:"filePath"`
	connString string
}

func (db *DBConfig) GetConnectionStr() string {
	if db.Dialect == "postgres" {
		return db.getConnectionStr("postgres", true)
	}
	return db.connString
}

func (db *DBConfig) GetSQLAlchemyDatabaseURIgo() string {
	if db.Dialect == "postgres" {
		return db.getConnectionStr("postgresql+psycopg2", false)
	}
	return db.connString
}

func (db *DBConfig) Init() (*sqlx.DB, error) {
	var driverName, connString string
	if db.Dialect == "sqlite" {
		driverName = "sqlite3"
		connString = db.FilePath
	} else {
		driverName = "postgres"
		connString = db.GetConnectionStr()
	}

	db2, err := sqlx.Open(driverName, connString)
	if err != nil {
		fmt.Println("error opening db", err)
		return nil, err
	}

	err = db2.Ping()
	if err != nil {
		fmt.Println("DB unreachable", err)
		return nil, err
	}
	return db2, nil
}

func (r *DBConfig) setDbName(val string) {
	r.Database = val
}

func (r *DBConfig) setUser(val string) {
	r.User = val
}

func (r *DBConfig) setPassword(val string) {
	r.Password = val
}

func (r *DBConfig) setHost(val string) {
	r.Host = val
}

func (r *DBConfig) setPort(val string) {
	port, err := strconv.Atoi(val)
	if err != nil {
		panic(err)
	}
	r.Port = port
}

func (r *DBConfig) setSSLMode(val string) {
	r.SslMode = val
}

func (dbData *DBConfig) getConnectionStr(driver string, sslmode bool) string {
	format := "{driver}://{user}:{password}@{host}/{dbname}"
	parts := []string{
		"{driver}", driver,
		"{user}", dbData.User,
		"{password}", dbData.Password,
		"{host}", dbData.Host,
		"{dbname}", dbData.Database,
	}
	if dbData.Port != 0 {
		format = "{driver}://{user}:{password}@{host}:{port}/{dbname}"
		parts = append(parts, "{port}", strconv.Itoa(dbData.Port))
	}

	if sslmode {
		format = format + "?sslmode={sslmode}"
		parts = append(parts,
			"{sslmode}", dbData.SslMode,
		)
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

func IsSQLiteDialect() bool {
	return Get().DB.Dialect == "sqlite"
}

func GetConnectionStr() string {
	cfg := Get()
	if cfg == nil {
		log.Fatalf("invalid config")
	}
	return cfg.DB.GetConnectionStr()
}

func ResetConfig(rdbi *DBConfig) {
	cfg = &Config{
		DB: rdbi,
	}
}

func parseConnectionString() (*DBConfig, error) {
	// DB_CONNECTION_STRING trumps file
	conn := util.GetEnv("DB_CONNECTION_STRING", "")

	if conn == "" {
		return nil, nil
	}

	// sqlite...
	if strings.HasPrefix(conn, "sqlite:///") {
		filePath := strings.TrimPrefix(conn, "sqlite:///")
		return &DBConfig{
			Dialect:    "sqlite",
			FilePath:   filePath,
			connString: conn,
		}, nil
	}

	url, err := pq.ParseURL(conn)
	if err != nil {
		return nil, errors.Wrap(err, "error parsing url")
	}
	parts := strings.Split(url, " ")

	r := &DBConfig{
		// only postgres supported for now
		Dialect: "postgres",
		SslMode: "disable",
	}
	m := map[string]func(string){
		"dbname":   r.setDbName,
		"host":     r.setHost,
		"user":     r.setUser,
		"password": r.setPassword,
		"port":     r.setPort,
		"sslmode":  r.setSSLMode,
	}

	for _, part := range parts {

		parts2 := strings.Split(part, "=")
		if len(parts2) != 2 {
			log.Fatal("invalid 2")
		}

		fn := m[parts2[0]]
		if fn == nil {
			return nil, fmt.Errorf("invalid key %s in url", parts2[0])
		}

		fn(parts2[1])
	}
	return r, nil
}

func loadDBConfig() *DBConfig {
	// DB_CONNECTION_STRING trumps file
	dbInfo, err := parseConnectionString()
	if err != nil {
		panic(err)
	}
	if dbInfo != nil {
		return dbInfo
	}

	path := util.GetEnv("PATH_TO_DB_FILE", "config/database.yml")
	_, err = os.Stat(path)
	if err != nil {
		log.Fatalf("no way to get db config :%v", err)
	}

	b, err := ioutil.ReadFile(path)
	if err != nil {
		log.Fatalf("could not read yml file to load db: %v", err)
	}

	var dbData DBConfig
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

	return &dbData
}
