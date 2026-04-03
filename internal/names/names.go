package names

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/lolopinto/ent/internal/codegen/codegenapi"
)

// TODO even through strcase has been updated. time to own this
// so it doesn't change on us again

// TODO need a better name for this

func ToClassType(strs ...string) string {
	var sb strings.Builder
	for _, s := range strs {
		if !utf8.ValidString(s) {
			sb.WriteString(s)
			continue
		}
		for _, v := range splitCamelCase(s) {
			if isSeparatorToken(v.entry) {
				continue
			}
			if v.class == upper || v.class == digit {
				sb.WriteString(v.entry)
			} else {
				sb.WriteString(titleWord(v.entry))
			}
		}
	}
	return sb.String()
}

func ToTsFieldName(strs ...string) string {
	var sb strings.Builder
	hasDoneLower := false
	for idx, s := range strs {
		if idx == 0 && len(s) > 0 && s[0] == '_' {
			s = s[1:]
			sb.WriteString("_")
		}
		if s == "" {
			continue
		}
		if !utf8.ValidString(s) {
			sb.WriteString(s)
			hasDoneLower = true
			continue
		}

		var prev caseType = not_returned
		tokens := splitCamelCase(s)
		for i, v := range tokens {
			if isSeparatorToken(v.entry) {
				prev = v.class
				continue
			}
			if !hasDoneLower {
				sb.WriteString(lowerWord(v.entry))
				hasDoneLower = true
			} else if v.class == upper || v.class == digit {
				sb.WriteString(titleWord(v.entry))
			} else if v.class == other && prev == upper && len(v.entry) > 2 {
				sb.WriteString(lowerWord(v.entry))
			} else if v.class == lower && prev == upper && i == len(tokens)-1 && v.entry == "s" {
				sb.WriteString(v.entry)
			} else {
				sb.WriteString(titleWord(v.entry))
			}
			prev = v.class
		}
	}
	return sb.String()
}

func ToGraphQLName(cfg codegenapi.Config, s ...string) string {
	// special case id
	if len(s) == 1 && strings.ToLower(s[0]) == "id" {
		return "id"
	}
	if cfg.DefaultGraphQLFieldFormat() == codegenapi.LowerCamelCase {
		return ToTsFieldName(s...)
	}
	return ToDBColumn(s...)
}

func ToGraphQLNameIgnoreSettings(s ...string) string {
	if len(s) == 1 && strings.ToLower(s[0]) == "id" {
		return "id"
	}
	return ToTsFieldName(s...)

}

// ToDBColumn converts a string to a database column name
func ToDBColumn(strs ...string) string {
	var sb strings.Builder
	for idx, s := range strs {
		if idx == 0 && len(s) > 0 && s[0] == '_' {
			s = s[1:]
			sb.WriteString("_")
		}
		if s == "" {
			continue
		}
		sb.WriteString(toSnakeWord(s))

		if idx != len(strs)-1 {
			sb.WriteString("_")
		}
	}
	return sb.String()
}

// same implementation as ToDBColumn
func ToFilePathName(s string) string {
	// file path in file system
	// snake case
	return ToDBColumn(s)
}

func ToGraphQLEnumName(s string) string {
	// norm for graphql enum names is all caps
	return strings.ToUpper(ToDBColumn(s))
}

type caseType uint

const (
	lower caseType = iota
	upper
	digit
	other
	not_returned
)

type splitResult struct {
	entry string
	class caseType
}

type splitTempResult struct {
	runes []rune
	v     caseType
}

// lifted from https://github.com/fatih/camelcase/blob/master/camelcase.go
// and https://github.com/fatih/camelcase/pull/4/files
func splitCamelCase(s string) []splitResult {
	if !utf8.ValidString(s) {
		return []splitResult{
			{
				entry: s,
				class: other,
			},
		}
	}
	// var runes []struct{[]rune, caseType} = []struct{[]rune, caseType}{}
	var temp []splitTempResult
	// lastClass := 0
	// class := 0
	var lastClass caseType = not_returned
	var class caseType = not_returned

	// split into fields based on class of unicode character
	for _, r := range s {
		switch true {
		case unicode.IsLower(r):
			class = lower
		case unicode.IsUpper(r):
			class = upper
		case unicode.IsDigit(r):
			class = digit
		default:
			class = other
		}
		if class == lastClass {
			temp[len(temp)-1].runes = append(temp[len(temp)-1].runes, r)
		} else {
			temp = append(temp, splitTempResult{
				runes: []rune{r},
				v:     class,
			})
		}
		lastClass = class
	}

	// this is for handling the userIDs -> "user", "ID", "s" case
	isPlural := func(curr, next []rune) bool {
		return len(curr) > 1 && len(next) == 1 && next[0] == 's'
	}

	// handle upper case -> lower case, number --> lower case sequences, e.g.
	// "PDFL", "oader" -> "PDF", "Loader"
	// "192", "nd" -> "192nd", ""
	for i := 0; i < len(temp)-1; i++ {
		if unicode.IsUpper(temp[i].runes[0]) && unicode.IsLower(temp[i+1].runes[0]) && !isPlural(temp[i].runes, temp[i+1].runes) {
			temp[i+1].runes = append([]rune{temp[i].runes[len(temp[i].runes)-1]}, temp[i+1].runes...)
			temp[i].runes = temp[i].runes[:len(temp[i].runes)-1]

			temp[i+1].v = other
		} else if unicode.IsDigit(temp[i].runes[0]) && unicode.IsLower(temp[i+1].runes[0]) {
			temp[i].runes = append(temp[i].runes, temp[i+1].runes...)
			temp[i+1].runes = nil
			i++

			temp[i].v = other
		}
	}

	results := []splitResult{}

	// construct []string from results
	for _, s := range temp {
		if len(s.runes) > 0 {
			results = append(results, splitResult{
				class: s.v,
				entry: string(s.runes),
			})
		}
	}
	return results
}
