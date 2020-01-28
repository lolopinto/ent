// Code generated by github.com/lolopinto/ent/ent, DO NOT edit.

package models

import (
	"context"
	"sync"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/ent/cast"
	"github.com/lolopinto/ent/ent/privacy"
	"github.com/lolopinto/ent/ent/viewer"

	"github.com/lolopinto/ent/internal/test_schema/models/configs"
)

const (
	// AddressType is the node type for the Address object. Used to identify this node in edges and other places.
	AddressType ent.NodeType = "address"
)

// Address represents the `Address` model
type Address struct {
	ent.Node
	privacy.AlwaysDenyPrivacyPolicy
	Country       string   `db:"country"`
	StreetAddress string   `db:"street_address"`
	State         string   `db:"state"`
	ResidentNames []string `db:"resident_names"`
	Zip           string   `db:"zip"`
	City          string   `db:"city"`
	Viewer        viewer.ViewerContext
}

// AddressResult stores the result of loading a Address. It's a tuple type which has 2 fields:
// a Address and an error
type AddressResult struct {
	Address *Address
	Err     error
}

func (res *AddressResult) Error() string {
	return res.Err.Error()
}

// AddresssResult stores the result of loading a slice of Addresss. It's a tuple type which has 2 fields:
// a []*Address and an error
type AddresssResult struct {
	Addresss []*Address
	Err      error
}

func (res *AddresssResult) Error() string {
	return res.Err.Error()
}

// IsNode is needed by gqlgen to indicate that this implements the Node interface in GraphQL
func (address Address) IsNode() {}

// GetType returns the NodeType of this entity. In this case: ContactType
func (address *Address) GetType() ent.NodeType {
	return AddressType
}

// GetViewer returns the viewer for this entity.
func (address *Address) GetViewer() viewer.ViewerContext {
	return address.Viewer
}

// LoadAddressFromContext loads the given Address given the context and id
func LoadAddressFromContext(ctx context.Context, id string) (*Address, error) {
	v, err := viewer.ForContext(ctx)
	if err != nil {
		return nil, err
	}
	return LoadAddress(v, id)
}

// LoadAddress loads the given Address given the viewer and id
func LoadAddress(v viewer.ViewerContext, id string) (*Address, error) {
	var address Address
	err := ent.LoadNode(v, id, &address, &configs.AddressConfig{})
	return &address, err
}

// GenLoadAddress loads the given Address given the id
func GenLoadAddress(v viewer.ViewerContext, id string, result *AddressResult, wg *sync.WaitGroup) {
	defer wg.Done()
	var address Address
	chanErr := make(chan error)
	go ent.GenLoadNode(v, id, &address, &configs.AddressConfig{}, chanErr)
	err := <-chanErr
	result.Address = &address
	result.Err = err
}

// DBFields is used by the ent framework to load the ent from the underlying database
func (address *Address) DBFields() ent.DBFields {
	return ent.DBFields{
		"id": func(v interface{}) error {
			var err error
			address.ID, err = cast.ToUUIDString(v)
			return err
		},
		"country": func(v interface{}) error {
			var err error
			address.Country, err = cast.ToString(v)
			return err
		},
		"street_address": func(v interface{}) error {
			var err error
			address.StreetAddress, err = cast.ToString(v)
			return err
		},
		"state": func(v interface{}) error {
			var err error
			address.State, err = cast.ToString(v)
			return err
		},
		"resident_names": func(v interface{}) error {
			return cast.UnmarshallJSON(v, &address.ResidentNames)
		},
		"zip": func(v interface{}) error {
			var err error
			address.Zip, err = cast.ToString(v)
			return err
		},
		"city": func(v interface{}) error {
			var err error
			address.City, err = cast.ToString(v)
			return err
		},
	}
}

// UnsupportedScan flags that we can't call StructScan() on the ent to get data out of the db, have to always use MapScan() and DBFields() method above
func (address *Address) UnsupportedScan() bool {
	return true
}

var _ ent.Entity = &Address{}
