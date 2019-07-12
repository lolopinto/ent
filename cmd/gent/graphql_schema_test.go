package main

import "testing"

func TestBuildGraphQLSchema(t *testing.T) {
	data := geTestGraphQLSchemaTemplate(t)

	if len(data.Types) != 3 {
		// AccountConfig TodoConfig Query
		t.Errorf("expected 3 types created, got %d instead", len(data.Types))
	}
}

func TestGraphQLObjectFields(t *testing.T) {
	s := getTestGraphQLObject("Account", t)

	if s.Type != "type" {
		t.Errorf("expected the Account GraphQL object's type to be %s, got %s instead", "type", s.Type)
	}

	if s.TypeName != "Account" {
		t.Errorf("graphql object type name was not as expected. expected %s, got %s", "Account", s.TypeName)
	}

	if len(s.SchemaLines) != 6 {
		t.Errorf("expected %d schema lines, got %d instead", 6, len(s.SchemaLines))
	}
}

func TestGraphQLIDField(t *testing.T) {
	s := getTestGraphQLObject("Account", t)

	// id field is always first. todo change this in the future to be more structured
	// similar to what we have with dbSchema/dbColumn/constraints etc
	line := s.SchemaLines[0]
	testLine(line, "id: ID!", "id", t)
}

func TestGraphQLStringField(t *testing.T) {
	s := getTestGraphQLObject("Account", t)

	// fields are currently sorted according to the order in account_config
	line := s.SchemaLines[1]
	testLine(line, "firstName: String!", "firstName", t)
}

func TestGraphQLIntegerField(t *testing.T) {
	s := getTestGraphQLObject("Account", t)

	// todo: order-dependent
	line := s.SchemaLines[4]
	testLine(line, "numberOfLogins: Int!", "numberOfLogins", t)
}

func TestGraphQLTimeField(t *testing.T) {
	s := getTestGraphQLObject("Account", t)

	// todo: order-dependent
	line := s.SchemaLines[5]
	testLine(line, "lastLoginAt: Time!", "lastLoginAt", t)
}

func TestGraphQLOtherIDField(t *testing.T) {
	s := getTestGraphQLObject("Todo", t)

	// todo: order-dependent
	line := s.SchemaLines[3]
	// TODO multiple things wrong here.
	// 1: We need to move the logic in db_schema that accounts for this to fieldInfo
	// so that we account for strings in here and make this ID!
	// 2: we don't want IDs in here when they map to an accompanying object. so we should really
	// create an Account edge here automatically since we know it's a fkey
	// OR if there's a FieldEdge that maps to an ID field, we should use that and make sure there's a graphql edge for that instead
	testLine(line, "accountID: String!", "accountID", t)
}

func TestGraphQLQuery(t *testing.T) {
	s := getTestGraphQLObject("Query", t)

	// account(id: ), todo(id: )
	if len(s.SchemaLines) != 2 {
		t.Errorf("expected %d queries in schema, got %d instead", 2, len(s.SchemaLines))
	}
}

func testLine(line, expectedLine, fieldName string, t *testing.T) {
	if line != expectedLine {
		t.Errorf("schema for the %s field was not as expected, expected %s, got %s instead", fieldName, expectedLine, line)
	}
}

func getTestGraphQLObject(typeName string, t *testing.T) *graphQLSchemaInfo {
	data := geTestGraphQLSchemaTemplate(t)
	s, ok := data.Types[typeName]
	if !ok {
		t.Errorf("couldn't get graphql object for %s object", typeName)
	}
	return s
}

func geTestGraphQLSchemaTemplate(t *testing.T) *graphqlSchemaTemplate {
	schema := newGraphQLSchema(getParsedTestSchemaFiles())
	return schema.buildGraphQLSchemaData()
}
