package data

import (
	"fmt"
	"io/ioutil"
	"log"
	"strconv"
	"strings"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq" //driver not used
	yaml "gopkg.in/yaml.v3"
)

type dbInfo struct {
	Dialect  string `yaml:"dialect"`
	Database string `yaml:"database"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Pool     int    `yaml:"pool"`
}

type dbConfig struct {
	// only support development for now but need to support test and production soon
	Development dbInfo `yaml:"development"`
}

var db *sqlx.DB
var dbData *dbInfo

func initDbFile() {
	var config dbConfig
	b, err := ioutil.ReadFile("config/database.yml")
	if err != nil {
		b, err = ioutil.ReadFile("./testdata/config/database.yml")
		// TODO handle this better
		if err != nil {
			log.Fatalf("could not read yml file to load db: %v", err)
		}
	}
	err = yaml.Unmarshal(b, &config)
	if err != nil {
		log.Fatal(err)
		log.Fatalf("error unmarshalling file: %v", err)
		//log.Fatalf("could not unmarshall database file")
	}

	// only support one environment so just using it
	dbData = &config.Development
	if dbData.Host == "" ||
		dbData.User == "" ||
		dbData.Database == "" ||
		dbData.Dialect != "postgres" {
		log.Fatalf("invalid database configuration")
	}
}

// init() initializes the database connection pool for use later
// init function called as package is initalized. Maybe make this explicit with InitDB()?
func init() {
	initDbFile()
	psqlInfo := fmt.Sprintf("host=%s port=%d user=%s "+
		"dbname=%s sslmode=disable",
		dbData.Host, dbData.Port, dbData.User, dbData.Database)

	var err error
	db, err = sqlx.Open("postgres", psqlInfo)
	if err != nil {
		fmt.Println("error opening db", err)
		return
	}

	err = db.Ping()
	if err != nil {
		fmt.Println("DB unreachable", err)
	}
	//fmt.Println("InitDB", db)
}

// GetSQLAlchemyDatabaseURIgo returns the databause uri needed by sqlalchemy to generate a schema file
func GetSQLAlchemyDatabaseURIgo() string {
	// postgres only for now as above. specific driver also
	driver := "postgresql+pg8000"

	format := "{driver}://{user}:{password}@{host}:{port}/{dbname}"
	r := strings.NewReplacer(
		"{driver}", driver,
		"{user}", dbData.User,
		"{password}", dbData.Password,
		"{host}", dbData.Host,
		"{port}", strconv.Itoa(dbData.Port),
		"{dbname}", dbData.Database,
	)

	fmt.Println(r.Replace(format))
	return r.Replace(format)
}

// DBConn returns a database connection pool to the DB for use
func DBConn() *sqlx.DB {
	return db
}

// CloseDB closes the database connection pool
func CloseDB() {
	if db != nil {
		db.Close()
	}
}
