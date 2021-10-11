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

type Input struct {
	TSName  string
	GQLName string
	GQLType string
	Values  []string
	EnumMap map[string]string
}

func (i *Input) HasValues() bool {
	return len(i.Values) > 0 || len(i.EnumMap) > 0
}

func (i *Input) getValuesFromValues() ([]Data, []Data) {
	tsVals := make([]Data, len(i.Values))
	gqlVals := make([]Data, len(i.Values))
	for j, val := range i.Values {
		tsName := GetTSEnumNameForVal(val)

		gqlVals[j] = Data{
			// norm for graphql enum names is all caps
			Name:  strings.ToUpper(strcase.ToSnake(val)),
			Value: strconv.Quote(val),
		}
		tsVals[j] = Data{
			Name: tsName,
			// value is actually what's put there for now
			// TODO we need to figure out if there's a standard here
			// or a way to have keys: values for the generated enums
			Value: strconv.Quote(val),
		}
	}
	return tsVals, gqlVals
}

func (i *Input) getValuesFromEnumMap() ([]Data, []Data) {
	tsVals := make([]Data, len(i.EnumMap))
	gqlVals := make([]Data, len(i.EnumMap))
	j := 0
	for k, val := range i.EnumMap {
		tsName := GetTSEnumNameForVal(k)

		gqlVals[j] = Data{
			// norm for graphql enums is all caps
			Name:  strings.ToUpper(strcase.ToSnake(k)),
			Value: strconv.Quote(val),
		}

		tsVals[j] = Data{
			Name:  tsName,
			Value: strconv.Quote(val),
		}
		j++
	}
	// golang maps are not stabe so sort for stability
	sort.Slice(tsVals, func(i, j int) bool {
		return tsVals[i].Name < tsVals[j].Name
	})
	sort.Slice(gqlVals, func(i, j int) bool {
		return gqlVals[i].Name < gqlVals[j].Name
	})
	return tsVals, gqlVals
}

func GetEnums(input *Input) (*Enum, *GQLEnum) {
	var tsVals []Data
	var gqlVals []Data
	if len(input.EnumMap) > 0 {
		tsVals, gqlVals = input.getValuesFromEnumMap()
	} else {
		tsVals, gqlVals = input.getValuesFromValues()
	}
	gqlEnum := &GQLEnum{
		Name:   input.GQLName,
		Type:   input.GQLType,
		Values: gqlVals,
	}

	tsEnum := &Enum{
		Name:   input.TSName,
		Values: tsVals,
		// not the best way to determine this but works for now
		Imported: len(tsVals) == 0,
	}
	return tsEnum, gqlEnum
}
