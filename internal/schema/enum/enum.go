package enum

import (
	"sort"
	"strconv"
	"strings"
	"unicode"

	"github.com/iancoleman/strcase"
)

type Enum struct {
	Name     string
	Values   []Data
	Imported bool // Imported enum that's not in this file
}

type GQLEnum struct {
	Name   string // Name is the name of the enum
	Type   string // type of the enum e.g. nullable or not
	Values []Data
}

type Data struct {
	Name        string
	Value       string
	Comment     string
	PackagePath string
}

func GetTSEnumNameForVal(val string) string {
	allUpper := true
	for _, char := range val {
		if !unicode.IsLetter(char) {
			continue
		}
		if !unicode.IsUpper(char) {
			allUpper = false
			break
		}
	}
	// keep all caps constants as all caps constants
	if allUpper {
		return val
	}
	return strcase.ToCamel(val)
}

func GetEnums(tsName, gqlName, gqlType string, values []string) (*Enum, *GQLEnum) {
	sort.Strings(values)
	tsVals := make([]Data, len(values))
	gqlVals := make([]Data, len(values))
	for i, val := range values {
		tsName := GetTSEnumNameForVal(val)

		gqlVal := strings.ToUpper(strcase.ToSnake(val))
		gqlVals[i] = Data{
			Name: gqlVal,
			// norm for graphql enums is all caps
			Value: strconv.Quote(gqlVal),
		}
		tsVals[i] = Data{
			Name: tsName,
			// value is actually what's put there for now
			// TODO we need to figure out if there's a standard here
			// or a way to have keys: values for the generated enums
			Value: strconv.Quote(val),
		}
	}

	gqlEnum := &GQLEnum{
		Name:   gqlName,
		Type:   gqlType,
		Values: gqlVals,
	}

	tsEnum := &Enum{
		Name:   tsName,
		Values: tsVals,
		// not the best way to determine this but works for now
		Imported: len(tsVals) == 0,
	}
	return tsEnum, gqlEnum
}
