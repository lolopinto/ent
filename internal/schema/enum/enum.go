package enum

type Enum struct {
	Name   string
	Values []Data
}

type Data struct {
	Name        string
	Value       string
	Comment     string
	PackagePath string
}
