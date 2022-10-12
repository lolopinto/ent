package enttype

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/ent/config"
	"github.com/lolopinto/ent/internal/tsimport"
)

type stringType struct {
}

func (t *stringType) GetDBType() string {
	return "sa.Text()"
}

func (t *stringType) GetImportType() Import {
	return &StringImport{}
}

type StringType struct {
	stringType
}

func (t *StringType) GetGraphQLType() string {
	return "String!"
}

func (t *StringType) GetTSType() string {
	return "string"
}

func (t *StringType) GetNullableType() TSType {
	return &NullableStringType{}
}

func (t *StringType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewGQLImportPath("GraphQLString"),
	}
}

type EmailType struct {
	StringType
}

func (t *EmailType) GetImportType() Import {
	return &EmailImport{}
}

func (t *EmailType) GetNullableType() TSType {
	return &NullableEmailType{}
}

type PhoneType struct {
	StringType
}

func (t *PhoneType) GetImportType() Import {
	return &PhoneImport{}
}

func (t *PhoneType) GetNullableType() TSType {
	return &NullablePhoneType{}
}

type PasswordType struct {
	StringType
}

func (t *PasswordType) GetImportType() Import {
	return &PasswordImport{}
}

func (t *PasswordType) GetNullableType() TSType {
	return &NullablePasswordType{}
}

type NullableStringType struct {
	stringType
}

func (t *NullableStringType) GetGraphQLType() string {
	return "String"
}

func (t *NullableStringType) GetTSType() string {
	return "string | null"
}

func (t *NullableStringType) GetNonNullableType() TSType {
	return &StringType{}
}

func (t *NullableStringType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewGQLImportPath("GraphQLString"),
	}
}

type NullableEmailType struct {
	NullableStringType
}

func (t *NullableEmailType) GetImportType() Import {
	return &EmailImport{}
}

func (t *NullableEmailType) GetNonNullableType() TSType {
	return &EmailType{}
}

type NullablePhoneType struct {
	NullableStringType
}

func (t *NullablePhoneType) GetImportType() Import {
	return &PhoneImport{}
}

func (t *NullablePhoneType) GetNonNullableType() TSType {
	return &PhoneType{}
}

type NullablePasswordType struct {
	NullableStringType
}

func (t *NullablePasswordType) GetImportType() Import {
	return &PasswordImport{}
}

func (t *NullablePasswordType) GetNonNullableType() TSType {
	return &PasswordType{}
}

type boolType struct{}

func (t *boolType) GetDBType() string {
	return "sa.Boolean()"
}

func (t *boolType) GetImportType() Import {
	return &BoolImport{}
}

func getSqliteImportMap(imps ...*tsimport.ImportPath) ConvertDataTypeRet {
	return map[config.Dialect][]*tsimport.ImportPath{
		config.SQLite: imps,
	}
}

func getAllDialectsImportMap(imps ...*tsimport.ImportPath) ConvertDataTypeRet {
	return map[config.Dialect][]*tsimport.ImportPath{
		config.SQLite:   imps,
		config.Postgres: imps,
	}
}

func (t *boolType) Convert() ConvertDataTypeRet {
	return getSqliteImportMap(tsimport.NewEntImportPath("convertBool"))
}

func (t *boolType) convertListWithItem() ConvertDataTypeRet {
	return getSqliteImportMap(tsimport.NewEntImportPath("convertBoolList"))
}

func (t *boolType) convertNullableListWithItem() ConvertDataTypeRet {
	return getSqliteImportMap(tsimport.NewEntImportPath("convertNullableBoolList"))
}

type BoolType struct {
	boolType
}

func (t *BoolType) GetGraphQLType() string {
	return "Boolean!"
}

func (t *BoolType) GetTSType() string {
	return "boolean"
}

func (t *BoolType) GetNullableType() TSType {
	return &NullableBoolType{}
}

func (t *BoolType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewGQLImportPath("GraphQLBoolean"),
	}
}

type NullableBoolType struct {
	boolType
}

func (t *NullableBoolType) GetGraphQLType() string {
	return "Boolean"
}

func (t *NullableBoolType) GetTSType() string {
	return "boolean | null"
}

func (t *NullableBoolType) GetNonNullableType() TSType {
	return &BoolType{}
}

func (t *NullableBoolType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewGQLImportPath("GraphQLBoolean"),
	}
}

func (t *NullableBoolType) Convert() ConvertDataTypeRet {
	return getSqliteImportMap(tsimport.NewEntImportPath("convertNullableBool"))
}

type idType struct{}

func (t *idType) IsIDType() bool {
	return true
}

func (t *idType) GetDBType() string {
	if config.IsSQLiteDialect() {
		// SQLite doesn't support UUID so do the translation here
		return "sa.Text()"
	}
	return "postgresql.UUID()"
}

func (t *idType) GetTsTypeImports() []*tsimport.ImportPath {
	// so that we "useImport ID" in the generation
	return []*tsimport.ImportPath{
		tsimport.NewEntImportPath("ID"),
	}
}

func (t *idType) GetImportType() Import {
	return &UUIDImport{}
}

// UUIDType
type IDType struct {
	idType
}

func (t *IDType) GetGraphQLType() string {
	return "ID!"
}

func (t *IDType) GetTSType() string {
	return "ID"
}

func (t *IDType) GetNullableType() TSType {
	return &NullableIDType{}
}

func (t *IDType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewGQLImportPath("GraphQLID"),
	}
}

func (t *IDType) CustomGQLRender(cfg Config, v string) string {
	if !cfg.Base64EncodeIDs() {
		return v
	}

	return fmt.Sprintf("mustDecodeIDFromGQLID(%s)", v)
}

func (t *IDType) ArgImports(cfg Config) []*tsimport.ImportPath {
	if !cfg.Base64EncodeIDs() {
		return []*tsimport.ImportPath{}
	}
	return []*tsimport.ImportPath{
		tsimport.NewEntGraphQLImportPath("mustDecodeIDFromGQLID"),
	}
}

type NullableIDType struct {
	idType
}

func (t *NullableIDType) GetGraphQLType() string {
	return "ID"
}

func (t *NullableIDType) GetTSType() string {
	return "ID | null"
}

func (t *NullableIDType) GetNonNullableType() TSType {
	return &IDType{}
}

func (t *NullableIDType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewGQLImportPath("GraphQLID"),
	}
}

func (t *NullableIDType) CustomGQLRender(cfg Config, v string) string {
	if !cfg.Base64EncodeIDs() {
		return v
	}

	return fmt.Sprintf("mustDecodeNullableIDFromGQLID(%s)", v)
}

func (t *NullableIDType) ArgImports(cfg Config) []*tsimport.ImportPath {
	if !cfg.Base64EncodeIDs() {
		return []*tsimport.ImportPath{}
	}

	return []*tsimport.ImportPath{
		tsimport.NewEntGraphQLImportPath("mustDecodeNullableIDFromGQLID"),
	}
}

type intType struct{}

func (t *intType) GetDBType() string {
	return "sa.Integer()"
}

func (t *intType) GetImportType() Import {
	return &IntImport{}
}

type IntegerType struct {
	intType
}

func (t *IntegerType) GetGraphQLType() string {
	return "Int!"
}

func (t *IntegerType) GetTSType() string {
	return "number"
}

func (t *IntegerType) GetNullableType() TSType {
	return &NullableIntegerType{}
}

func (t *IntegerType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewGQLImportPath("GraphQLInt"),
	}
}

type BigIntegerType struct {
	IntegerType
}

func (t *BigIntegerType) GetNullableType() TSType {
	return &NullableBigIntegerType{}
}

func (t *BigIntegerType) GetGraphQLType() string {
	return "String!"
}

func (t *BigIntegerType) GetDBType() string {
	return "sa.BigInteger()"
}

func (t *BigIntegerType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewGQLImportPath("GraphQLString"),
	}
}

func (t *BigIntegerType) Convert() ConvertDataTypeRet {
	return getAllDialectsImportMap(&tsimport.ImportPath{
		Import: "BigInt",
	})
}

func (t *BigIntegerType) GetTSType() string {
	return "BigInt"
}

func (t *BigIntegerType) GetImportType() Import {
	return &BigIntImport{}
}

type NullableIntegerType struct {
	intType
}

func (t *NullableIntegerType) GetGraphQLType() string {
	return "Int"
}

func (t *NullableIntegerType) GetTSType() string {
	return "number | null"
}

func (t *NullableIntegerType) GetNonNullableType() TSType {
	return &IntegerType{}
}

func (t *NullableIntegerType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewGQLImportPath("GraphQLInt"),
	}
}

// what's the best graphql representation?
// for now we'll use strings but there's a few graphql representations
// on the Internet
type NullableBigIntegerType struct {
	NullableIntegerType
}

func (t *NullableBigIntegerType) GetNonNullableType() TSType {
	return &BigIntegerType{}
}

func (t *NullableBigIntegerType) GetGraphQLType() string {
	return "String"
}

func (t *NullableBigIntegerType) Convert() ConvertDataTypeRet {
	return getAllDialectsImportMap(&tsimport.ImportPath{
		Import: "BigInt",
	})
}

func (t *NullableBigIntegerType) GetTSType() string {
	return "BigInt | null"
}

func (t *NullableBigIntegerType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewGQLImportPath("GraphQLString"),
	}
}

func (t *NullableBigIntegerType) GetImportType() Import {
	return &BigIntImport{}
}

func (t *NullableBigIntegerType) GetDBType() string {
	return "sa.BigInteger()"
}

type floatType struct{}

func (t *floatType) GetDBType() string {
	return "sa.Float()"
}

func (t *floatType) GetImportType() Import {
	return &FloatImport{}
}

type FloatType struct {
	floatType
}

func (t *FloatType) GetGraphQLType() string {
	return "Float!"
}

func (t *FloatType) GetTSType() string {
	return "number"
}

func (t *FloatType) GetNullableType() TSType {
	return &NullableFloatType{}
}

func (t *FloatType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewGQLImportPath("GraphQLFloat"),
	}
}

type NullableFloatType struct {
	floatType
}

func (t *NullableFloatType) GetGraphQLType() string {
	return "Float"
}

func (t *NullableFloatType) GetTSType() string {
	return "number | null"
}

func (t *NullableFloatType) GetNonNullableType() TSType {
	return &FloatType{}
}

func (t *NullableFloatType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewGQLImportPath("GraphQLFloat"),
	}
}

type timestampType struct{}

func (t *timestampType) GetDBType() string {
	return "sa.TIMESTAMP()"
}

func (t *timestampType) GetImportType() Import {
	return &TimestampImport{}
}

type dateType struct {
	timestampType
}

func (t *dateType) Convert() ConvertDataTypeRet {
	return getSqliteImportMap(tsimport.NewEntImportPath("convertDate"))
}

func (t *dateType) convertListWithItem() ConvertDataTypeRet {
	return getSqliteImportMap(tsimport.NewEntImportPath("convertDateList"))
}

func (t *dateType) convertNullableListWithItem() ConvertDataTypeRet {
	return getSqliteImportMap(tsimport.NewEntImportPath("convertNullableDateList"))
}

func (t *dateType) GetTSType() string {
	return "Date"
}

func (t *dateType) GetImportType() Import {
	return &DateImport{}
}

type TimestampType struct {
	dateType
}

// use the built in graphql type
func (t *TimestampType) GetGraphQLType() string {
	return "Time!"
}

func (t *TimestampType) GetTSType() string {
	return "Date"
}

func (t *TimestampType) GetNullableType() TSType {
	return &NullableTimestampType{}
}

func (t *TimestampType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewEntGraphQLImportPath("GraphQLTime"),
	}
}

func (t *TimestampType) GetImportType() Import {
	return &TimestampImport{}
}

type TimestamptzType struct {
	TimestampType
}

func (t *TimestamptzType) GetDBType() string {
	return "sa.TIMESTAMP(timezone=True)"
}

func (t *TimestamptzType) GetNullableType() TSType {
	return &NullableTimestamptzType{}
}

func (t *TimestamptzType) GetImportType() Import {
	return &TimestamptzImport{}
}

type DateType struct {
	TimestampType
}

func (t *DateType) GetDBType() string {
	return "sa.Date()"
}

func (t *DateType) GetNullableType() TSType {
	return &NullableDateType{}
}

func (t *DateType) GetImportType() Import {
	return &DateImport{}
}

type NullableTimestampType struct {
	timestampType
}

func (t *NullableTimestampType) GetGraphQLType() string {
	return "Time"
}

func (t *NullableTimestampType) GetTSType() string {
	return "Date | null"
}

func (t *NullableTimestampType) GetNonNullableType() TSType {
	return &TimestampType{}
}

func (t *NullableTimestampType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewEntGraphQLImportPath("GraphQLTime"),
	}
}

func (t *NullableTimestampType) Convert() ConvertDataTypeRet {
	return getSqliteImportMap(tsimport.NewEntImportPath("convertNullableDate"))
}

type NullableTimestamptzType struct {
	NullableTimestampType
}

func (t *NullableTimestamptzType) GetDBType() string {
	return "sa.TIMESTAMP(timezone=True)"
}

func (t *NullableTimestamptzType) GetNonNullableType() TSType {
	return &TimestamptzType{}
}

func (t *NullableTimestamptzType) GetImportType() Import {
	return &TimestamptzImport{}
}

type NullableDateType struct {
	NullableTimestampType
}

func (t *NullableDateType) GetDBType() string {
	return "sa.Date()"
}

func (t *NullableDateType) GetNonNullableType() TSType {
	return &DateType{}
}

func (t *NullableDateType) GetImportType() Import {
	return &DateImport{}
}

type TimeType struct {
	timestampType
}

func (t *TimeType) GetDBType() string {
	return "sa.Time()"
}

func (t *TimeType) GetTSType() string {
	return "string"
}

func (t *TimeType) GetNullableType() TSType {
	return &NullableTimeType{}
}

func (t *TimeType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		// string format for time. or do we want a new scalar time?
		tsimport.NewGQLImportPath("GraphQLString"),
	}
}

func (t *TimeType) GetGraphQLType() string {
	return "String!"
}

func (t *TimeType) GetImportType() Import {
	return &TimeImport{}
}

type TimetzType struct {
	TimeType
}

func (t *TimetzType) GetDBType() string {
	return "sa.Time(timezone=True)"
}

func (t *TimetzType) GetNullableType() TSType {
	return &NullableTimetzType{}
}

func (t *TimetzType) GetImportType() Import {
	return &TimetzImport{}
}

type NullableTimeType struct {
	timestampType
}

func (t *NullableTimeType) GetDBType() string {
	return "sa.Time()"
}

func (t *NullableTimeType) GetTSType() string {
	return "string | null"
}

func (t *NullableTimeType) GetNonNullableType() TSType {
	return &TimeType{}
}

func (t *NullableTimeType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		// string format for time. or do we want a new scalar time?
		tsimport.NewGQLImportPath("GraphQLString"),
	}
}

func (t *NullableTimeType) GetGraphQLType() string {
	return "String"
}

func (t *NullableTimeType) GetImportType() Import {
	return &TimeImport{}
}

type NullableTimetzType struct {
	NullableTimeType
}

func (t *NullableTimetzType) GetDBType() string {
	return "sa.Time(timezone=True)"
}

func (t *NullableTimetzType) GetNonNullableType() TSType {
	return &TimetzType{}
}

func (t *NullableTimetzType) GetImportType() Import {
	return &TimetzImport{}
}

// public for tests
type CommonObjectType struct {
	TSType         string
	GraphQLType    string
	ActionName     string
	ExcludedFields []string
}

func (t *CommonObjectType) GetDBType() string {
	if config.IsSQLiteDialect() {
		return "sa.Text()"
	}
	return "postgresql.JSONB"
}

func (t *CommonObjectType) GetActionFieldsInfo() *ActionFieldsInfo {
	return &ActionFieldsInfo{
		ActionName:     t.ActionName,
		ExcludedFields: t.ExcludedFields,
	}
}

func (t *CommonObjectType) GetCustomTypeInfo() *CustomTypeInfo {
	return &CustomTypeInfo{
		TSInterface:      t.TSType,
		GraphQLInterface: t.GraphQLType,
		Type:             CustomInterface,
	}
}

type ObjectType struct {
	CommonObjectType
}

func (t *ObjectType) GetGraphQLType() string {
	return fmt.Sprintf("%s!", t.GraphQLType)
}

func (t *ObjectType) GetTSType() string {
	return t.TSType
}

func (t *ObjectType) GetNullableType() TSType {
	return &NullableObjectType{}
}

func (t *ObjectType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		{
			Import: t.GraphQLType,
		},
	}
}

type NullableObjectType struct {
	CommonObjectType
}

func (t *NullableObjectType) GetGraphQLType() string {
	return t.GraphQLType
}

func (t *NullableObjectType) GetTSType() string {
	return fmt.Sprintf("%s | null", t.TSType)
}

func (t *NullableObjectType) GetNullableType() TSType {
	return &ObjectType{}
}

func (t *NullableObjectType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		{
			Import: t.GraphQLType,
		},
	}
}

type ListWrapperType struct {
	Type TSType
	// doesn't care if content is nullable. that's handled by Type passed...
	Nullable bool
}

func (t *ListWrapperType) GetDBType() string {
	if config.IsSQLiteDialect() {
		return "sa.Text()"
	}

	return fmt.Sprintf("postgresql.ARRAY(%s)", t.Type.GetDBType())
}

func (t *ListWrapperType) GetGraphQLType() string {
	if t.Nullable {
		return fmt.Sprintf("[%s]", t.Type.GetGraphQLType())
	}
	return fmt.Sprintf("[%s]!", t.Type.GetGraphQLType())
}

func (t *ListWrapperType) GetTSType() string {
	if t.Nullable {
		return fmt.Sprintf("%s[] | null", t.Type.GetTSType())
	}
	return fmt.Sprintf("%s[]", t.Type.GetTSType())
}

func (t *ListWrapperType) GetNullableType() TSType {
	return &ListWrapperType{
		Type:     t.Type,
		Nullable: true,
	}
}

func (t *ListWrapperType) GetNonNullableType() TSType {
	return &ListWrapperType{
		Type:     t.Type,
		Nullable: false,
	}
}

func (t *ListWrapperType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	var ret = []*tsimport.ImportPath{}

	if !t.Nullable {
		ret = append(ret, tsimport.NewGQLClassImportPath("GraphQLNonNull"))
	}
	ret = append(ret, tsimport.NewGQLClassImportPath("GraphQLList"))
	ret = append(ret, t.Type.GetTSGraphQLImports(input)...)
	return ret
}

func (t *ListWrapperType) GetActionFieldsInfo() *ActionFieldsInfo {
	t2, ok := t.Type.(TSTypeWithActionFields)
	if !ok {
		return nil
	}
	return t2.GetActionFieldsInfo()
}

func (t *ListWrapperType) GetCustomTypeInfo() *CustomTypeInfo {
	t2, ok := t.Type.(TSTypeWithCustomType)
	if !ok {
		return nil
	}
	return t2.GetCustomTypeInfo()
}

func (t *ListWrapperType) GetImportDepsType() *tsimport.ImportPath {
	t2, ok := t.Type.(ImportDepsType)
	if !ok {
		return nil
	}
	return t2.GetImportDepsType()
}

type enumType struct {
}

func (t *enumType) getDBTypeForEnumDBType(values []string, typ string) string {
	var sb strings.Builder
	for _, v := range values {
		sb.WriteString(strconv.Quote(v))
		sb.WriteString(", ")
	}
	// TODO eventually provide option to define enum type
	// for now we take it from TSType if that's given since it makes sense to be consistent with that
	// if not provided, we use the name
	// we also need DBTypeName or something too
	enumType := strconv.Quote(strcase.ToSnake(typ))
	sb.WriteString(fmt.Sprintf("name=%s", enumType))
	return fmt.Sprintf("postgresql.ENUM(%s)", sb.String())

}

type StringEnumType struct {
	enumType
	EnumDBType               bool
	Type                     string
	GraphQLType              string
	Values                   []string
	EnumMap                  map[string]string
	overrideImportPath       *tsimport.ImportPath
	overideGraphQLImportPath *tsimport.ImportPath
}

func (t *StringEnumType) GetDBType() string {
	if t.EnumDBType {
		return t.getDBTypeForEnumDBType(t.Values, t.Type)
	}
	return "sa.Text()"
}

func (t *StringEnumType) SetImportPath(imp *tsimport.ImportPath) *StringEnumType {
	t.overrideImportPath = imp
	return t
}

func (t *StringEnumType) SetGraphQLImportPath(imp *tsimport.ImportPath) *StringEnumType {
	t.overideGraphQLImportPath = imp
	return t
}

func (t *StringEnumType) GetEnumData() *EnumData {
	return &EnumData{
		TSName:      t.Type,
		GraphQLName: t.GraphQLType,
		Values:      t.Values,
		EnumMap:     t.EnumMap,
	}
}

func (t *StringEnumType) GetGraphQLType() string {
	return fmt.Sprintf("%s!", t.GraphQLType)
}

func (t *StringEnumType) GetTSType() string {
	return t.Type
}

func (t *StringEnumType) GetTsTypeImports() []*tsimport.ImportPath {
	if t.overrideImportPath != nil {
		return []*tsimport.ImportPath{
			t.overrideImportPath,
		}
	}
	return []*tsimport.ImportPath{
		tsimport.NewLocalEntImportPath(t.Type),
	}
}

func (t *StringEnumType) GetNullableType() TSType {
	return &NullableStringEnumType{
		Type:        t.Type,
		GraphQLType: t.GraphQLType,
		Values:      t.Values,
	}
}

func (t *StringEnumType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	if t.overideGraphQLImportPath != nil {
		return []*tsimport.ImportPath{
			tsimport.NewGQLClassImportPath("GraphQLNonNull"),
			t.overideGraphQLImportPath,
		}
	}
	return []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewLocalGraphQLEntImportPath(t.GraphQLType),
	}
}

var _ EnumeratedType = &StringEnumType{}

type NullableStringEnumType struct {
	enumType
	EnumDBType  bool
	Type        string
	GraphQLType string
	Values      []string
	EnumMap     map[string]string
}

func (t *NullableStringEnumType) GetDBType() string {
	if t.EnumDBType {
		return t.getDBTypeForEnumDBType(t.Values, t.Type)
	}
	return "sa.Text()"
}

func (t *NullableStringEnumType) GetEnumData() *EnumData {
	return &EnumData{
		TSName:      t.Type,
		GraphQLName: t.GraphQLType,
		Values:      t.Values,
		EnumMap:     t.EnumMap,
	}
}

func (t *NullableStringEnumType) GetGraphQLType() string {
	return t.GraphQLType
}

func (t *NullableStringEnumType) GetTSType() string {
	return fmt.Sprintf("%s | null", t.Type)
}

func (t *NullableStringEnumType) GetTsTypeImports() []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewLocalEntImportPath(t.Type),
	}
}

func (t *NullableStringEnumType) GetNonNullableType() TSType {
	return &StringEnumType{
		Type:        t.Type,
		GraphQLType: t.GraphQLType,
		Values:      t.Values,
	}
}

func (t *NullableStringEnumType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewLocalGraphQLEntImportPath(t.GraphQLType),
	}
}

var _ EnumeratedType = &NullableStringEnumType{}

type IntegerEnumType struct {
	Type              string
	GraphQLType       string
	EnumMap           map[string]int
	DeprecatedEnumMap map[string]int
}

func (t *IntegerEnumType) GetDBType() string {
	return "sa.Integer()"
}

func (t *IntegerEnumType) GetEnumData() *EnumData {
	return &EnumData{
		TSName:               t.Type,
		GraphQLName:          t.GraphQLType,
		IntEnumMap:           t.EnumMap,
		DeprecatedIntEnumMap: t.DeprecatedEnumMap,
	}
}

func (t *IntegerEnumType) GetGraphQLType() string {
	return fmt.Sprintf("%s!", t.GraphQLType)
}

func (t *IntegerEnumType) GetTSType() string {
	return t.Type
}

func (t *IntegerEnumType) GetTsTypeImports() []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewLocalEntImportPath(t.Type),
	}
}

func (t *IntegerEnumType) GetNullableType() TSType {
	return &NullableIntegerEnumType{
		Type:              t.Type,
		GraphQLType:       t.GraphQLType,
		EnumMap:           t.EnumMap,
		DeprecatedEnumMap: t.DeprecatedEnumMap,
	}
}

func (t *IntegerEnumType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewLocalGraphQLEntImportPath(t.GraphQLType),
	}
}

var _ EnumeratedType = &IntegerEnumType{}

type NullableIntegerEnumType struct {
	Type              string
	GraphQLType       string
	EnumMap           map[string]int
	DeprecatedEnumMap map[string]int
}

func (t *NullableIntegerEnumType) GetDBType() string {
	return "sa.Integer()"
}

func (t *NullableIntegerEnumType) GetEnumData() *EnumData {
	return &EnumData{
		TSName:               t.Type,
		GraphQLName:          t.GraphQLType,
		IntEnumMap:           t.EnumMap,
		DeprecatedIntEnumMap: t.DeprecatedEnumMap,
	}
}

func (t *NullableIntegerEnumType) GetGraphQLType() string {
	return t.GraphQLType
}

func (t *NullableIntegerEnumType) GetTSType() string {
	return fmt.Sprintf("%s | null", t.Type)
}

func (t *NullableIntegerEnumType) GetTsTypeImports() []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewLocalEntImportPath(t.Type),
	}
}

func (t *NullableIntegerEnumType) GetNonNullableType() TSType {
	return &IntegerEnumType{
		Type:              t.Type,
		GraphQLType:       t.GraphQLType,
		EnumMap:           t.EnumMap,
		DeprecatedEnumMap: t.DeprecatedEnumMap,
	}
}

func (t *NullableIntegerEnumType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewLocalGraphQLEntImportPath(t.GraphQLType),
	}
}

var _ EnumeratedType = &NullableIntegerEnumType{}

type arrayListType struct {
}

func (t *arrayListType) getDBType(elemType TSType) string {
	if config.IsSQLiteDialect() {
		return "sa.Text()"
	}

	return fmt.Sprintf("postgresql.ARRAY(%s)", elemType.GetDBType())
}

func (t *arrayListType) getTsTypeImports(elemType TSType) []*tsimport.ImportPath {
	t2, ok := elemType.(TSTypeWithImports)
	if !ok {
		return []*tsimport.ImportPath{}
	}
	return t2.GetTsTypeImports()
}

type ArrayListType struct {
	arrayListType
	ElemType           TSType
	ElemDBTypeNotArray bool
}

func (t *ArrayListType) GetDBType() string {
	if t.ElemDBTypeNotArray {
		return t.ElemType.GetDBType()
	}
	return t.getDBType(t.ElemType)
}

func (t *ArrayListType) GetGraphQLType() string {
	return fmt.Sprintf("[%s]!", t.ElemType.GetGraphQLType())
}

func (t *ArrayListType) GetTSType() string {
	return fmt.Sprintf("%s[]", t.ElemType.GetTSType())
}

func (t *ArrayListType) GetTsTypeImports() []*tsimport.ImportPath {
	return t.getTsTypeImports(t.ElemType)
}

func (t *ArrayListType) GetNullableType() TSType {
	return &NullableArrayListType{
		ElemType:           t.ElemType,
		ElemDBTypeNotArray: t.ElemDBTypeNotArray,
	}
}

func (t *ArrayListType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	gqlType, ok := t.ElemType.(TSType)
	if !ok {
		panic(fmt.Sprintf("got TSType %v which is not a GraphQL type", t.ElemType))
	}
	ret := []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		tsimport.NewGQLClassImportPath("GraphQLList"),
	}
	ret = append(ret, gqlType.GetTSGraphQLImports(input)...)
	return ret
}

func (t *ArrayListType) Convert() ConvertDataTypeRet {
	elem, ok := t.ElemType.(convertListElemType)
	if !ok {
		return getSqliteImportMap(tsimport.NewEntImportPath("convertList"))
	}
	return elem.convertListWithItem()
}

func (t *ArrayListType) GetImportDepsType() *tsimport.ImportPath {
	t2, ok := t.ElemType.(ImportDepsType)
	if !ok {
		return nil
	}
	return t2.GetImportDepsType()
}

func (t *ArrayListType) GetSubFields() interface{} {
	t2, ok := t.ElemType.(TSWithSubFields)
	if !ok {
		return nil
	}
	return t2.GetSubFields()
}

func (t *ArrayListType) GetCustomTypeInfo() *CustomTypeInfo {
	t2, ok := t.ElemType.(TSTypeWithCustomType)
	if !ok {
		return nil
	}
	return t2.GetCustomTypeInfo()
}

type NullableArrayListType struct {
	arrayListType
	ElemType           TSType
	ElemDBTypeNotArray bool
}

func (t *NullableArrayListType) GetDBType() string {
	if t.ElemDBTypeNotArray {
		return t.ElemType.GetDBType()
	}
	return t.getDBType(t.ElemType)
}

func (t *NullableArrayListType) GetTsTypeImports() []*tsimport.ImportPath {
	return t.getTsTypeImports(t.ElemType)
}

func (t *NullableArrayListType) GetNonNullableType() TSType {
	return &ArrayListType{
		ElemType:           t.ElemType,
		ElemDBTypeNotArray: t.ElemDBTypeNotArray,
	}
}

func (t *NullableArrayListType) GetGraphQLType() string {
	return fmt.Sprintf("[%s]", t.ElemType.GetGraphQLType())
}

func (t *NullableArrayListType) GetTSType() string {
	return fmt.Sprintf("%s[] | null", t.ElemType.GetTSType())
}

func (t *NullableArrayListType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	ret := []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLList"),
	}
	ret = append(ret, t.ElemType.GetTSGraphQLImports(input)...)
	return ret
}

// TODO why is there ListWrapperType (for ActionFields)
// and NullableArrayListType /ArrayListType for regular lists?
// TODO GetCustomTypeInfo
func (t *NullableArrayListType) Convert() ConvertDataTypeRet {
	elem, ok := t.ElemType.(convertListElemType)
	if !ok {
		return getSqliteImportMap(tsimport.NewEntImportPath("convertNullableList"))
	}
	return elem.convertNullableListWithItem()
}

func (t *NullableArrayListType) GetImportDepsType() *tsimport.ImportPath {
	t2, ok := t.ElemType.(ImportDepsType)
	if !ok {
		return nil
	}
	return t2.GetImportDepsType()
}

func (t *NullableArrayListType) GetSubFields() interface{} {
	t2, ok := t.ElemType.(TSWithSubFields)
	if !ok {
		return nil
	}
	return t2.GetSubFields()
}

func (t *NullableArrayListType) GetCustomTypeInfo() *CustomTypeInfo {
	t2, ok := t.ElemType.(TSTypeWithCustomType)
	if !ok {
		return nil
	}
	return t2.GetCustomTypeInfo()
}

type CommonJSONType struct {
	ImportType *tsimport.ImportPath
	// input SubFields. not typed because of circular dependencies
	SubFields              interface{}
	UnionFields            interface{}
	CustomTsInterface      string
	CustomGraphQLInterface string
}

func (t *CommonJSONType) getDBType(jsonb bool) string {
	if config.IsSQLiteDialect() {
		return "sa.Text()"
	}
	if jsonb {
		return "postgresql.JSONB"
	}
	return "postgresql.JSON"
}

func (t *CommonJSONType) GetGraphQLType() string {
	if t.CustomGraphQLInterface != "" {
		return t.CustomGraphQLInterface + "!"
	}
	return "JSON!"
}

func (t *CommonJSONType) getTSTypeFromInfo(impType *tsimport.ImportPath) string {
	var typ string
	if impType != nil {
		typ = impType.Import
	} else if t.CustomTsInterface != "" {
		typ = t.CustomTsInterface
	}
	return typ
}

func (t *CommonJSONType) getTsType(nullable bool, impType *tsimport.ImportPath) string {
	typ := t.getTSTypeFromInfo(impType)
	if typ == "" {
		return "any"
	}
	if nullable {
		return typ + " | null"
	}
	return typ
}

func (t *CommonJSONType) GetTsTypeImports() []*tsimport.ImportPath {
	return t.getTsTypeImports(t.ImportType)
}

func (t *CommonJSONType) getTsTypeImports(impType *tsimport.ImportPath) []*tsimport.ImportPath {
	if impType != nil {
		return []*tsimport.ImportPath{
			impType,
		}
	}
	typ := t.getTSTypeFromInfo(impType)
	if typ == "" {
		return nil
	}

	return []*tsimport.ImportPath{
		tsimport.NewLocalEntImportPath(typ),
	}
}

func (t *CommonJSONType) getJSONGraphQLType(gqlType string, input bool) *tsimport.ImportPath {
	if t.SubFields == nil && t.UnionFields == nil {
		// TODO https://github.com/taion/graphql-type-json
		return tsimport.NewGraphQLJSONImportPath("GraphQLJSON")
	}
	if input {
		return tsimport.NewLocalGraphQLInputEntImportPath(gqlType)
	}
	return tsimport.NewLocalGraphQLEntImportPath(gqlType)
}

func (t *CommonJSONType) GetImportType() Import {
	return &JSONImport{}
}

func (t *CommonJSONType) GetImportDepsType() *tsimport.ImportPath {
	return t.ImportType
}

func (t *CommonJSONType) GetSubFields() interface{} {
	return t.SubFields
}

func (t *CommonJSONType) GetUnionFields() interface{} {
	return t.UnionFields
}

func (t *CommonJSONType) GetCustomTypeInfo() *CustomTypeInfo {
	typ := CustomInterface
	if t.UnionFields != nil {
		typ = CustomUnion
	}
	return &CustomTypeInfo{
		TSInterface:      t.CustomTsInterface,
		GraphQLInterface: t.CustomGraphQLInterface,
		Type:             typ,
	}
}

func (t *CommonJSONType) GetCustomGraphQLInterface() string {
	return t.CustomGraphQLInterface
}

type JSONType struct {
	CommonJSONType
}

func (t *JSONType) GetDBType() string {
	return t.getDBType(false)
}

func (t *JSONType) GetTSType() string {
	return t.getTsType(false, t.ImportType)
}

func (t *JSONType) GetNullableType() TSType {
	ret := &NullableJSONType{}
	ret.ImportType = t.ImportType
	ret.SubFields = t.SubFields
	ret.UnionFields = t.UnionFields
	ret.CustomGraphQLInterface = t.CustomGraphQLInterface
	ret.CustomTsInterface = t.CustomTsInterface
	return ret
}

func (t *JSONType) Convert() ConvertDataTypeRet {
	return getSqliteImportMap(tsimport.NewEntImportPath("convertJSON"))
}

func (t *JSONType) convertListWithItem() ConvertDataTypeRet {
	return getSqliteImportMap(tsimport.NewEntImportPath("convertJSONList"))
}

func (t *JSONType) convertNullableListWithItem() ConvertDataTypeRet {
	return getSqliteImportMap(tsimport.NewEntImportPath("convertNullableJSONList"))
}

func (t *JSONType) GetImportDepsType() *tsimport.ImportPath {
	return t.ImportType
}

func (t *JSONType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		t.getJSONGraphQLType(t.CustomGraphQLInterface, input),
	}
}

type NullableJSONType struct {
	CommonJSONType
}

func (t *NullableJSONType) GetDBType() string {
	return t.getDBType(false)
}

func (t *NullableJSONType) GetTSType() string {
	return t.getTsType(true, t.ImportType)
}

func (t *NullableJSONType) GetGraphQLType() string {
	if t.CustomGraphQLInterface != "" {
		return t.CustomGraphQLInterface
	}
	return "JSON"
}

func (t *NullableJSONType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		t.getJSONGraphQLType(t.CustomGraphQLInterface, input),
	}
}

func (t *NullableJSONType) Convert() ConvertDataTypeRet {
	return getSqliteImportMap(tsimport.NewEntImportPath("convertNullableJSON"))
}

func (t *NullableJSONType) convertListWithItem() ConvertDataTypeRet {
	return getSqliteImportMap(tsimport.NewEntImportPath("convertJSONList"))
}

func (t *NullableJSONType) convertNullableListWithItem() ConvertDataTypeRet {
	return getSqliteImportMap(tsimport.NewEntImportPath("convertNullableJSONList"))
}

func (t *NullableJSONType) GetNonNullableType() TSType {
	ret := &JSONType{}
	ret.ImportType = t.ImportType
	ret.SubFields = t.SubFields
	ret.UnionFields = t.UnionFields
	ret.CustomGraphQLInterface = t.CustomGraphQLInterface
	ret.CustomTsInterface = t.CustomTsInterface
	return ret
}

func (t *NullableJSONType) GetImportDepsType() *tsimport.ImportPath {
	return t.ImportType
}

type JSONBType struct {
	CommonJSONType
}

func (t *JSONBType) GetDBType() string {
	return t.getDBType(true)
}

func (t *JSONBType) GetTSType() string {
	return t.getTsType(false, t.ImportType)
}

func (t *JSONBType) GetNullableType() TSType {
	ret := &NullableJSONBType{}
	ret.ImportType = t.ImportType
	ret.SubFields = t.SubFields
	ret.UnionFields = t.UnionFields
	ret.CustomGraphQLInterface = t.CustomGraphQLInterface
	ret.CustomTsInterface = t.CustomTsInterface
	return ret
}

func (t *JSONBType) Convert() ConvertDataTypeRet {
	return getSqliteImportMap(tsimport.NewEntImportPath("convertJSON"))
}

func (t *JSONBType) convertListWithItem() ConvertDataTypeRet {
	return getSqliteImportMap(tsimport.NewEntImportPath("convertJSONList"))
}

func (t *JSONBType) convertNullableListWithItem() ConvertDataTypeRet {
	return getSqliteImportMap(tsimport.NewEntImportPath("convertNullableJSONList"))
}

func (t *JSONBType) GetImportDepsType() *tsimport.ImportPath {
	return t.ImportType
}

func (t *JSONBType) GetImportType() Import {
	return &JSONBImport{}
}

func (t *JSONBType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		tsimport.NewGQLClassImportPath("GraphQLNonNull"),
		t.getJSONGraphQLType(t.CustomGraphQLInterface, input),
	}
}

type NullableJSONBType struct {
	CommonJSONType
}

func (t *NullableJSONBType) GetDBType() string {
	return t.getDBType(true)
}

func (t *NullableJSONBType) GetTSType() string {
	return t.getTsType(true, t.ImportType)
}

func (t *NullableJSONBType) GetGraphQLType() string {
	if t.CustomGraphQLInterface != "" {
		return t.CustomGraphQLInterface
	}
	return "JSON"
}

func (t *NullableJSONBType) GetTSGraphQLImports(input bool) []*tsimport.ImportPath {
	return []*tsimport.ImportPath{
		t.getJSONGraphQLType(t.CustomGraphQLInterface, input),
	}
}

func (t *NullableJSONBType) GetNonNullableType() TSType {
	ret := &JSONBType{}
	ret.ImportType = t.ImportType
	ret.SubFields = t.SubFields
	ret.UnionFields = t.UnionFields
	ret.CustomGraphQLInterface = t.CustomGraphQLInterface
	ret.CustomTsInterface = t.CustomTsInterface
	return ret
}

func (t *NullableJSONBType) Convert() ConvertDataTypeRet {
	return getSqliteImportMap(tsimport.NewEntImportPath("convertNullableJSON"))
}

func (t *NullableJSONBType) convertListWithItem() ConvertDataTypeRet {
	return getSqliteImportMap(tsimport.NewEntImportPath("convertJSONList"))
}

func (t *NullableJSONBType) convertNullableListWithItem() ConvertDataTypeRet {
	return getSqliteImportMap(tsimport.NewEntImportPath("convertNullableJSONList"))
}

func (t *NullableJSONBType) GetImportType() Import {
	return &JSONBImport{}
}

func IsImportDepsType(t Type) bool {
	_, ok := t.(ImportDepsType)
	return ok
}

func ConvertFuncs(t Type) []string {
	imps := ConvertImportPaths(t)
	if imps == nil {
		return nil
	}
	var ret []string
	for _, imp := range imps {
		ret = append(ret, imp.Import)
	}
	return ret
}

func ConvertImportPaths(t Type) []*tsimport.ImportPath {
	tt, ok := t.(ConvertDataType)
	if !ok {
		return nil
	}

	m := tt.Convert()
	return m[config.GetDialect()]
}

// this exists because we need to account for lists...
func GetEnumType(t Type) (EnumeratedType, bool) {
	enumType, ok := t.(EnumeratedType)
	if ok {
		return enumType, ok
	}
	listType, ok := t.(*ArrayListType)
	if ok {
		enumType, ok := listType.ElemType.(EnumeratedType)
		if ok {
			return enumType, ok
		}
	}
	nullListType, ok := t.(*NullableArrayListType)
	if ok {
		enumType, ok := nullListType.ElemType.(EnumeratedType)
		if ok {
			return enumType, ok
		}
	}

	return nil, false
}

// TODO need an interface for this
func IsListType(t Type) bool {
	_, ok := t.(*ArrayListType)
	_, ok2 := t.(*NullableArrayListType)
	return ok || ok2
}

func IsJSONBType(t Type) bool {
	_, ok := t.(*JSONBType)
	_, ok2 := t.(*NullableJSONBType)
	return ok || ok2
}

func IsIDType(t Type) bool {
	_, ok := t.(*IDType)
	_, ok2 := t.(*NullableIDType)
	return ok || ok2
}
