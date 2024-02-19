package names

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"

	strcase2 "github.com/stoewer/go-strcase"
)

// TODO even through strcase has been updated. time to own this
// so it doesn't change on us again

// TODO need a better name for this

func allUpper(s string) bool {
	for _, r := range s {
		if !unicode.IsUpper(r) {
			return false
		}
	}
	return true
}

func ToClassType(strs ...string) string {
	// I think what I really want here is capitalize the first letter of each word
	// instead of this
	// woule need to audit this better tho
	var sb strings.Builder
	for _, s := range strs {
		for _, v := range splitCamelCase(s) {
			// all upper, keep it that way and don't try and camel case it
			// TODO instead of doing all this. we should probably just keep developer's input as is
			// and append suffixes to it as opposed to this
			// would need to do a better job of keeping track of where it's from as opposed to this
			if allUpper(v) {
				sb.WriteString(v)
			} else {
				sb.WriteString(strcase.ToCamel(v))
			}
		}
		// sb.WriteString(strcase2.UpperCamelCase(s))
	}
	return sb.String()
}

// TODO TranslateIDSuffix converted too
func ToTsFieldName(strs ...string) string {
	// use strcase to handle it for now?
	// and then we can change it later if need be
	var sb strings.Builder
	hasDoneLower := false
	for idx, s := range strs {

		if idx == 0 && len(s) > 0 && s[0] == '_' {
			s = s[1:]
			// keep the first letter lowercase
			sb.WriteString("_")
		}
		if s == "" {
			continue
		}
		if !hasDoneLower {
			sb.WriteString(strcase.ToLowerCamel(s))
			hasDoneLower = true
		} else {
			sb.WriteString(strcase.ToCamel(s))
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

// ToDBColumn converts a string to a database column name
func ToDBColumn(strs ...string) string {
	var sb strings.Builder
	for idx, s := range strs {

		if idx == 0 && len(s) > 0 && s[0] == '_' {
			s = s[1:]
			// keep the first letter lowercase
			sb.WriteString("_")
		}
		if s == "" {
			continue
		}

		// this is to handle userIDs -> user_ids
		split := splitCamelCase(s)
		if len(split) > 2 {
			last := split[len(split)-1]
			next_last := split[len(split)-2]
			if last == "s" && allUpper(next_last) {
				// get the first n-2 words
				split = split[:len(split)-2]
				sb.WriteString((strcase.ToSnake(strings.Join(split, ""))))
				sb.WriteString("_")

				// combine the last two
				sb.WriteString(strcase2.SnakeCase(next_last))
				sb.WriteString(last)
				continue
			}
		}

		sb.WriteString(strcase2.SnakeCase(s))
		// sb.WriteString(strcase.ToSnake(s))

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

// lifted from https://github.com/fatih/camelcase/blob/master/camelcase.go
// and https://github.com/fatih/camelcase/pull/4/files
func splitCamelCase(s string) []string {
	if !utf8.ValidString(s) {
		return []string{s}
	}
	entries := []string{}
	var runes [][]rune
	lastClass := 0
	class := 0
	// split into fields based on class of unicode character
	for _, r := range s {
		switch true {
		case unicode.IsLower(r):
			class = 1
		case unicode.IsUpper(r):
			class = 2
		case unicode.IsDigit(r):
			class = 3
		default:
			class = 4
		}
		if class == lastClass {
			runes[len(runes)-1] = append(runes[len(runes)-1], r)
		} else {
			runes = append(runes, []rune{r})
		}
		lastClass = class
	}

	// this is for handling the userIDs -> "user", "ID", "s" case
	isPlural := func(v []rune) bool {
		return len(v) == 1 && v[0] == 's'
	}

	// handle upper case -> lower case, number --> lower case sequences, e.g.
	// "PDFL", "oader" -> "PDF", "Loader"
	// "192", "nd" -> "192nd", ""
	for i := 0; i < len(runes)-1; i++ {
		if unicode.IsUpper(runes[i][0]) && unicode.IsLower(runes[i+1][0]) && !isPlural(runes[i+1]) {
			runes[i+1] = append([]rune{runes[i][len(runes[i])-1]}, runes[i+1]...)
			runes[i] = runes[i][:len(runes[i])-1]
		} else if unicode.IsDigit(runes[i][0]) && unicode.IsLower(runes[i+1][0]) {
			runes[i] = append(runes[i], runes[i+1]...)
			runes[i+1] = nil
			i++
		}
	}
	// construct []string from results
	for _, s := range runes {
		if len(s) > 0 {
			entries = append(entries, string(s))
		}
	}
	return entries
}
