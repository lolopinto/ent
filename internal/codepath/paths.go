package codepath

// Package refers to the name of the package
const Package = "@snowtop/ent"

const EmailPackage = "@snowtop/ent-email"

const PhonenumberPackage = "@snowtop/ent-phonenumber"

const PasswordPackage = "@snowtop/ent-password"

// ActionPackage refers to the name of the action package
const ActionPackage = Package + "/action"

// AuthPackage refers to the name of the auth package where ent-auth stuff is
const AuthPackage = Package + "/auth"

// SchemaPackage refers to the name of the schema package
const SchemaPackage = Package + "/schema"

// GraphQLPackage refers to the name of the graphql package
const GraphQLPackage = Package + "/graphql"

func GetFilePathForInternalFile() string {
	return "src/ent/internal.ts"
}

func GetFilePathForEntIndexFile() string {
	return "src/ent/index.ts"
}

func GetInternalImportPath() string {
	return "src/ent/internal"
}

func GetExternalImportPath() string {
	return "src/ent/"
}

func GetFilePathForInternalGQLFile() string {
	return "src/graphql/resolvers/internal.ts"
}

func GetFilePathForExternalGQLFile() string {
	return "src/graphql/resolvers/index.ts"
}

func GetImportPathForInternalGQLFile() string {
	return "src/graphql/resolvers/internal"
}

func GetImportPathForExternalGQLFile() string {
	return "src/graphql/resolvers/"
}
