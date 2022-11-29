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
	Name              string
	Values            []Data
	DeprecatedValues  []Data
	Imported          bool // Imported enum that's not in this file
	convertFuncTSType string
}

func (c *Enum) Clone() *Enum {
	ret := &Enum{
		Name:     c.Name,
		Values:   c.Values,
		Imported: c.Imported,
	}
	return ret
}

type convertFunctionInfo struct {
	Name              string
	UnknownKey        string
	ConvertFuncTSType string
}

func (c *Enum) GetConvertFunctionInfo() *convertFunctionInfo {
	var unknown *Data
	for _, v := range c.Values {
		if v.UnknownVal {
			unknown = &v
		}
	}
	if unknown == nil {
		return nil
	}
	return &convertFunctionInfo{
		Name:              fmt.Sprintf("convert%s", c.Name),
		UnknownKey:        unknown.Name,
		ConvertFuncTSType: c.convertFuncTSType,
	}
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

func (g GQLEnum) GetGraphQLType() string {
	return g.Name + "Type"
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
	UnknownVal  bool
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
	ret, _ := GetTSEnumNameForValInfo(val)
	return ret
}

func stringAllUpper(val string) bool {
	all := true
	for _, char := range val {
		if !unicode.IsLetter(char) {
			continue
		}
		if !unicode.IsUpper(char) {
			all = false
			break
		}
	}
	return all
}

func stringAllLower(val string) bool {
	all := true
	for _, char := range val {
		if !unicode.IsLetter(char) {
			continue
		}
		if !unicode.IsLower(char) {
			all = false
			break
		}
	}
	return all
}

// min int. weird to have enum with unknown value
const JS_MIN_SAFE_INT = -9007199254740991

func GetTSEnumNameForValInfo(val string) (string, bool) {
	all := stringAllUpper(val)
	// keep all caps constants as all caps constants
	if all {
		return val, all
	}
	return strcase.ToCamel(val), false
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

func getUnknownVals[T any](keyAllUpper, valAllUpper, valAllLower bool, m map[string]T) (*Data, *Data) {
	var ok bool
	var key string
	var value string
	if keyAllUpper {
		key = "UNKNOWN"
		_, ok = m["UNKNOWN"]
	} else {
		key = "Unknown"
		_, ok = m["Unknown"]
	}

	if valAllUpper {
		value = "%UNKNOWN%"
	} else if valAllLower {
		value = "%unknown%"
	} else {
		value = "%Unknown%"
	}

	// no unknown, add unknown
	if !ok {
		gqlVal := &Data{
			// norm for graphql enums is all caps
			Name:       strings.ToUpper(key),
			Value:      strconv.Quote(value),
			UnknownVal: true,
		}

		tsVal := &Data{
			Name:       key,
			Value:      strconv.Quote(value),
			UnknownVal: true,
		}
		return tsVal, gqlVal
	}
	return nil, nil
}

func (i *Input) getValuesFromValues() ([]Data, []Data) {
	tsVals := make([]Data, len(i.Values))
	gqlVals := make([]Data, len(i.Values))

	keys := make(map[string]bool)
	allUpper := true
	allLower := true
	for j, val := range i.Values {
		tsName, upper := GetTSEnumNameForValInfo(val)
		allUpper = allUpper && upper
		allLower = allLower && stringAllLower(val)

		keys[val] = true

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

	tsVal, gqlVal := getUnknownVals(allUpper, allUpper, allLower, keys)
	if gqlVal != nil {
		gqlVals = append(gqlVals, *gqlVal)
	}
	if tsVal != nil {
		tsVals = append(tsVals, *tsVal)
	}

	return tsVals, gqlVals
}

func (i *Input) getValuesFromEnumMap() ([]Data, []Data) {
	tsVals := make([]Data, len(i.EnumMap))
	gqlVals := make([]Data, len(i.EnumMap))
	j := 0
	allUpper := true
	valAllUpper := true
	valAllLower := true

	for k, val := range i.EnumMap {
		tsName, upper := GetTSEnumNameForValInfo(k)
		allUpper = allUpper && upper
		valAllUpper = valAllUpper && stringAllUpper(val)
		valAllLower = valAllLower && stringAllLower(val)

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

	tsVal, gqlVal := getUnknownVals(allUpper, valAllUpper, valAllLower, i.EnumMap)

	if gqlVal != nil {
		gqlVals = append(gqlVals, *gqlVal)
	}
	if tsVal != nil {
		tsVals = append(tsVals, *tsVal)
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

func (i *Input) getValuesFromIntEnumMap(m map[string]int, addUnknown bool) ([]Data, []Data) {
	tsVals := make([]Data, len(m))
	gqlVals := make([]Data, len(m))
	j := 0

	allUpper := true

	for k, val := range m {
		tsName, upper := GetTSEnumNameForValInfo(k)
		allUpper = allUpper && upper

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

	if addUnknown {
		tsVal, gqlVal := getUnknownVals(allUpper, allUpper, false, i.IntEnumMap)
		if tsVal != nil {
			// TODO this should be an option...
			tsVal.Value = JS_MIN_SAFE_INT
			tsVals = append(tsVals, *tsVal)
		}
		if gqlVal != nil {
			// TODO this should be an option...
			gqlVal.Value = JS_MIN_SAFE_INT
			gqlVals = append(gqlVals, *gqlVal)
		}
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

func NewInputFromEnumType(enumType enttype.EnumeratedType, fkey bool) (*Input, error) {
	data := enumType.GetEnumData()
	input := &Input{
		TSName:               data.TSName,
		GQLName:              data.GraphQLName,
		GQLType:              enumType.GetTSType(),
		Values:               data.Values,
		EnumMap:              data.EnumMap,
		IntEnumMap:           data.IntEnumMap,
		DeprecatedIntEnumMap: data.DeprecatedIntEnumMap,
	}
	if !input.HasValues() && !fkey {
		return nil, fmt.Errorf("Enum %s has no values", input.TSName)
	}
	return input, nil
}

func GetEnums(input *Input) (*Enum, *GQLEnum) {
	var tsVals []Data
	var gqlVals []Data
	var deprecatedTSVals []Data
	var deprecatedgqlVals []Data
	convertFuncTSType := "string"
	// include UNKNOWN
	if len(input.EnumMap) > 0 {
		tsVals, gqlVals = input.getValuesFromEnumMap()
	} else if len(input.IntEnumMap) > 0 {
		tsVals, gqlVals = input.getValuesFromIntEnumMap(input.IntEnumMap, true)
		deprecatedTSVals, deprecatedgqlVals = input.getValuesFromIntEnumMap(input.DeprecatedIntEnumMap, false)
		convertFuncTSType = "number"
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
		Imported:          len(tsVals) == 0,
		DeprecatedValues:  deprecatedTSVals,
		convertFuncTSType: convertFuncTSType,
	}
	return tsEnum, gqlEnum
}
