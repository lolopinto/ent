package ent

import (
	"reflect"
	"testing"
)

type user struct {
	Node
	FirstName string `db:"first_name"`
	LastName  string `db:"last_name"`
	UserID    string `db:"user_id"`
}

type assocEdgeWithPkey struct {
	EdgeType string `db:"edge_type" pkey:"true"` // this is a pkey telling getFieldsAndValuesOfStruct() to not get the id key or try and set it
	EdgeName string `db:"edge_name"`
	// we still add magical created_at and updated_at fields here though because we're cheating and it works for what we want.
	// TODO: change getFieldsAndValuesOfStruct() to go down the rabbit hole and do the right thing by checking the fields we care
	// about instead of this
}

func TestGetFieldsAndValuesOfNodeStruct(t *testing.T) {
	u := &user{
		FirstName: "John",
		LastName:  "Snow",
		UserID:    "1234",
	}
	insertData := getFieldsAndValuesOfStruct(reflect.ValueOf(u), false)
	if len(insertData.columns) != 6 {
		t.Errorf("number of columns returned were not as expected, expected %d, got %d", 6, len(insertData.columns))
	}
	expectedColumnOrder := []string{
		"id",
		"first_name",
		"last_name",
		"user_id",
		"updated_at",
		"created_at",
	}
	for idx, col := range expectedColumnOrder {
		if insertData.columns[idx] != col {
			t.Errorf("expected %s column in the %dth position, didn't get it, got %s instead", col, idx, insertData.columns[idx])
		}
	}

	if len(insertData.values) != 6 {
		t.Errorf("number of values returned were not as expected, expected %d, got %d", 6, len(insertData.columns))
	}

	if u.ID != "" {
		t.Errorf("expected the Id field to not be set. was set instead")
	}
}

func TestGetFieldsAndValuesOfNodeSetIDFieldStruct(t *testing.T) {
	u := &user{
		FirstName: "John",
		LastName:  "Snow",
		UserID:    "1234",
	}
	getFieldsAndValuesOfStruct(reflect.ValueOf(u), true)

	if u.ID == "" {
		t.Errorf("expected the Id field to be set. was not set")
	}
}

func TestGetFieldsAndValuesOfNonNodeStruct(t *testing.T) {
	edge := &assocEdgeWithPkey{
		EdgeName: "user_to_notes_edge",
		EdgeType: "friends_edge",
	}
	insertData := getFieldsAndValuesOfStruct(reflect.ValueOf(edge), false)
	if len(insertData.columns) != 4 {
		t.Errorf("number of columns returned were not as expected, expected %d, got %d", 4, len(insertData.columns))
	}
	expectedColumnOrder := []string{
		"edge_type",
		"edge_name",
		"updated_at",
		"created_at",
	}
	for idx, col := range expectedColumnOrder {
		if insertData.columns[idx] != col {
			t.Errorf("expected %s column in the %dth position, didn't get it, got %s instead", col, idx, insertData.columns[idx])
		}
	}

	if len(insertData.values) != 4 {
		t.Errorf("number of values returned were not as expected, expected %d, got %d", 4, len(insertData.columns))
	}
}

func TestGetFieldsAndValuesOfNonNodeSetIDFieldStruct(t *testing.T) {
	edge := &assocEdgeWithPkey{
		EdgeName: "user_to_notes_edge",
		EdgeType: "friends_edge",
	}
	// calling with setIDField true shouldn't break anything
	getFieldsAndValuesOfStruct(reflect.ValueOf(edge), true)
}
