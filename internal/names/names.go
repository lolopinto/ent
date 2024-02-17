package names

import (
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/codegen/codegenapi"
)

// TODO even through strcase has been updated. time to own this
// so it doesn't change on us again

// TODO need a better name for this
func ToClassType(strs ...string) string {
	var sb strings.Builder
	for _, s := range strs {
		sb.WriteString(strcase.ToCamel(s))
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
		sb.WriteString(strcase.ToSnake(s))

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
