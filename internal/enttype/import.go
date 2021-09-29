package enttype

import (
	"fmt"
	"strings"

	"github.com/lolopinto/ent/internal/codepath"
)

type Import interface {
	ImportPath() string
	Import() string
	DefaultImport() bool
	Aliases() []string
}

type baseImport struct {
}

func (b *baseImport) ImportPath() string {
	return codepath.SchemaPackage
}

func (b *baseImport) DefaultImport() bool {
	return false
}

type StringImport struct {
	baseImport
}

func (imp *StringImport) Import() string {
	return "StringType"
}

func (imp *StringImport) Aliases() []string {
	return []string{"string", "text"}
}

type UUIDImport struct {
	baseImport
}

func (imp *UUIDImport) Import() string {
	return "UUIDType"
}

func (imp *UUIDImport) Aliases() []string {
	return []string{"uuid"}
}

type IntImport struct {
	baseImport
}

func (imp *IntImport) Import() string {
	return "IntegerType"
}

func (imp *IntImport) Aliases() []string {
	return []string{"int", "integer"}
}

type BigIntImport struct {
	baseImport
}

func (imp *BigIntImport) Import() string {
	return "BigIntegerType"
}

func (imp *BigIntImport) Aliases() []string {
	return []string{"bigint", "int64"}
}

type FloatImport struct {
	baseImport
}

func (imp *FloatImport) Import() string {
	return "FloatType"
}

func (imp *FloatImport) Aliases() []string {
	return []string{"float"}
}

type BoolImport struct {
	baseImport
}

func (imp *BoolImport) Import() string {
	return "BooleanType"
}

func (imp *BoolImport) Aliases() []string {
	return []string{"bool", "boolean"}
}

type TimestampImport struct {
	baseImport
}

func (imp *TimestampImport) Import() string {
	return "TimestampType"
}

func (imp *TimestampImport) Aliases() []string {
	return []string{"timestamp"}
}

type TimestamptzImport struct {
	baseImport
}

func (imp *TimestamptzImport) Import() string {
	return "TimestamptzType"
}

func (imp *TimestamptzImport) Aliases() []string {
	return []string{"timestamptz"}
}

type TimeImport struct {
	baseImport
}

func (imp *TimeImport) Import() string {
	return "TimeType"
}

func (imp *TimeImport) Aliases() []string {
	return []string{"time"}
}

type TimetzImport struct {
	baseImport
}

func (imp *TimetzImport) Import() string {
	return "TimetzType"
}

func (imp *TimetzImport) Aliases() []string {
	return []string{"timetz"}
}

type DateImport struct {
	baseImport
}

func (imp *DateImport) Import() string {
	return "DateType"
}

func (imp *DateImport) Aliases() []string {
	return []string{"date"}
}

type EmailImport struct {
	baseImport
}

func (imp *EmailImport) ImportPath() string {
	return codepath.EmailPackage
}

func (imp *EmailImport) Import() string {
	return "EmailType"
}

func (imp *EmailImport) Aliases() []string {
	return []string{"email", "email-address", "email_address"}
}

type PhoneImport struct {
	baseImport
}

func (imp *PhoneImport) ImportPath() string {
	return codepath.PhonenumberPackage
}

func (imp *PhoneImport) Import() string {
	return "PhoneNumberType"
}

func (imp *PhoneImport) Aliases() []string {
	return []string{"phone", "phone_number", "phone-number"}
}

type PasswordImport struct {
	baseImport
}

func (imp *PasswordImport) ImportPath() string {
	return codepath.PasswordPackage
}

func (imp *PasswordImport) Import() string {
	return "PasswordType"
}

func (imp *PasswordImport) Aliases() []string {
	return []string{"password"}
}

type JSONImport struct {
	baseImport
}

func (imp *JSONImport) ImportPath() string {
	return codepath.Package
}

func (imp *JSONImport) Import() string {
	return "JSONType"
}

func (imp *JSONImport) Aliases() []string {
	return []string{"json"}
}

type JSONBImport struct {
	baseImport
}

func (imp *JSONBImport) ImportPath() string {
	return codepath.Package
}

func (imp *JSONBImport) Import() string {
	return "JSONBType"
}

func (imp *JSONBImport) Aliases() []string {
	return []string{"jsonb"}
}

var allImports = []Import{
	&StringImport{},
	&UUIDImport{},
	&IntImport{},
	&BigIntImport{},
	&JSONImport{},
	&JSONBImport{},
	&FloatImport{},
	&BoolImport{},
	&TimestampImport{},
	&TimestamptzImport{},
	&TimeImport{},
	&TimetzImport{},
	&DateImport{},
	&EmailImport{},
	&PhoneImport{},
	&PasswordImport{},
}

// TODO list types...

var m map[string]Import

func init() {
	m = make(map[string]Import)
	for _, imp := range allImports {
		for _, alias := range imp.Aliases() {
			alias = strings.ToLower(alias)
			if m[alias] != nil {
				panic(fmt.Errorf("developer error. duplicate alias %s", alias))
			}
			m[alias] = imp
		}
	}
}

func GetTypeForField(s string) Import {
	return m[s]
}

func ValidateTypeForImport(s string) (Import, error) {
	typ := strings.ToLower(s)

	imp, ok := m[typ]
	if !ok {
		return nil, fmt.Errorf("%s is not a valid type for a field", typ)
	}
	return imp, nil
}
