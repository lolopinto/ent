package enum

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
	"unicode"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/schema/change"
)

type Enum struct {
	Name             string
	Values           []Data
	DeprecatedValues []Data
	Imported         bool // Imported enum that's not in this file
}

func (c *Enum) Clone() *Enum {
	ret := &Enum{
		Name:     c.Name,
		Values:   c.Values,
		Imported: c.Imported,
	}
	return ret
}

func EnumEqual(e1, e2 *Enum) bool {
	ret := change.CompareNilVals(e1 == nil, e2 == nil)
	if ret != nil {
		return *ret
	}
	return e1.Name == e2.Name &&
		datasEqual(e1.Values, e2.Values) &&
		e1.Imported == e2.Imported
}

func EnumsEqual(l1, l2 []*Enum) bool {
	if len(l1) != len(l2) {
		return false
	}

	for i := range l1 {
		if !EnumEqual(l1[i], l2[i]) {
			return false
		}
	}
	return true
}

func mapifyList(l []*Enum) (map[string]*Enum, error) {
	ret := make(map[string]*Enum)

	for _, v := range l {
		dup, ok := ret[v.Name]
		if ok {
			// ignore for now but we need to fix this eventually
			if !EnumEqual(v, dup) {
				return nil, fmt.Errorf("%s duplicated in the list", v.Name)
			}
		}
		ret[v.Name] = v
	}
	return ret, nil
}

// this is different from compareEnums in internal/schema/compare_schema.go...
func CompareEnums(l1, l2 []*Enum) ([]change.Change, error) {
	var ret []change.Change
	m1, err := mapifyList(l1)
	if err != nil {
		return nil, err
	}
	m2, err := mapifyList(l2)
	if err != nil {
		return nil, err
	}
	for k, enum1 := range m1 {
		enum2, ok := m2[k]
		if !ok {
			ret = append(ret, change.Change{
				Change: change.RemoveEnum,
				Name:   enum1.Name,
			})
		} else {
			if !EnumEqual(enum1, enum2) {
				ret = append(ret, change.Change{
					Change: change.ModifyEnum,
					Name:   enum1.Name,
				})
			}
		}
	}

	for k, enum2 := range m2 {
		_, ok := m1[k]
		// in 2nd but not first, added
		if !ok {
			ret = append(ret, change.Change{
				Change: change.AddEnum,
				Name:   enum2.Name,
			})
		}
	}

	return ret, nil
}

func (c *Enum) GetEnumValues() []interface{} {
	ret := make([]interface{}, len(c.Values))
	for i, v := range c.Values {
		ret[i] = v.Value
	}
	return ret
}

type GQLEnum struct {
	Name             string // Name is the name of the enum
	Type             string // type of the enum e.g. nullable or not
	Values           []Data
	DeprecatedValues []Data
}

func (g GQLEnum) GetGraphQLNames() []string {
	ret := make([]string, len(g.Values))
	for i := range g.Values {
		ret[i] = g.Values[i].Name
	}
	return ret
}

func GQLEnumEqual(e1, e2 *GQLEnum) bool {
	ret := change.CompareNilVals(e1 == nil, e2 == nil)
	if ret != nil {
		return *ret
	}
	return e1.Name == e2.Name &&
		e1.Type == e2.Type &&
		datasEqual(e1.Values, e2.Values)
}

func GQLEnumsEqual(l1, l2 []*GQLEnum) bool {
	if len(l1) != len(l2) {
		return false
	}

	for i := range l1 {
		if !GQLEnumEqual(l1[i], l2[i]) {
			return false
		}
	}
	return true
}

type Data struct {
	Name        string
	Value       interface{}
	Comment     string
	PackagePath string
}

func datasEqual(l1, l2 []Data) bool {
	if len(l1) != len(l2) {
		return false
	}

	for i := range l1 {
		if !dataEqual(l1[i], l2[i]) {
			return false
		}
	}
	return true
}

func dataEqual(d1, d2 Data) bool {
	return d1.Name == d2.Name &&
		d1.Value == d2.Value &&
		d1.Comment == d2.Comment &&
		d1.PackagePath == d2.PackagePath
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
	TSName               string
	GQLName              string
	GQLType              string
	Values               []string
	EnumMap              map[string]string
	IntEnumMap           map[string]int
	DeprecatedIntEnumMap map[string]int
}

func (i *Input) HasValues() bool {
	return len(i.Values) > 0 || len(i.EnumMap) > 0 || len(i.IntEnumMap) > 0
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
	// golang maps are not stable so sort for stability
	sort.Slice(tsVals, func(i, j int) bool {
		return tsVals[i].Name < tsVals[j].Name
	})
	sort.Slice(gqlVals, func(i, j int) bool {
		return gqlVals[i].Name < gqlVals[j].Name
	})
	return tsVals, gqlVals
}

func (i *Input) getValuesFromIntEnumMap(m map[string]int) ([]Data, []Data) {
	tsVals := make([]Data, len(m))
	gqlVals := make([]Data, len(m))
	j := 0

	for k, val := range m {
		tsName := GetTSEnumNameForVal(k)

		gqlVals[j] = Data{
			// norm for graphql enums is all caps
			Name:  strings.ToUpper(strcase.ToSnake(k)),
			Value: val,
		}

		tsVals[j] = Data{
			Name:  tsName,
			Value: val,
		}
		j++
	}
	// golang maps are not stable so sort for stability
	sort.Slice(tsVals, func(i, j int) bool {
		return tsVals[i].Value.(int) < tsVals[j].Value.(int)
	})
	sort.Slice(gqlVals, func(i, j int) bool {
		return gqlVals[i].Value.(int) < gqlVals[j].Value.(int)
	})
	return tsVals, gqlVals
}

func NewInputFromEnumType(enumType enttype.EnumeratedType) *Input {
	data := enumType.GetEnumData()
	return &Input{
		TSName:               enumType.GetTSName(),
		GQLName:              enumType.GetGraphQLName(),
		GQLType:              enumType.GetTSType(),
		Values:               data.Values,
		EnumMap:              data.EnumMap,
		IntEnumMap:           data.IntEnumMap,
		DeprecatedIntEnumMap: data.DeprecatedIntEnumMap,
	}
}

func GetEnums(input *Input) (*Enum, *GQLEnum) {
	var tsVals []Data
	var gqlVals []Data
	var deprecatedTSVals []Data
	var deprecatedgqlVals []Data
	if len(input.EnumMap) > 0 {
		tsVals, gqlVals = input.getValuesFromEnumMap()
	} else if len(input.IntEnumMap) > 0 {
		tsVals, gqlVals = input.getValuesFromIntEnumMap(input.IntEnumMap)
		deprecatedTSVals, deprecatedgqlVals = input.getValuesFromIntEnumMap(input.DeprecatedIntEnumMap)
	} else {
		tsVals, gqlVals = input.getValuesFromValues()
	}
	gqlEnum := &GQLEnum{
		Name:             input.GQLName,
		Type:             input.GQLType,
		Values:           gqlVals,
		DeprecatedValues: deprecatedgqlVals,
	}

	tsEnum := &Enum{
		Name:   input.TSName,
		Values: tsVals,
		// not the best way to determine this but works for now
		Imported:         len(tsVals) == 0,
		DeprecatedValues: deprecatedTSVals,
	}
	return tsEnum, gqlEnum
}
