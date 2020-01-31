package url

import (
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/lolopinto/ent/ent/field"
)

var DefaultSchemes = []string{
	"http",
	"https",
}

// Type returns a datatype that implements the field.DataType interface
// representing urls
// By default, it validates that the input is a valid url with either http or https scheme
// since that's common in urls stored in web databases
// It provides the ability to change this as needed
func Type() *dataType {
	dt := &dataType{}
	dt.Validate(func(url *url.URL) error {
		validSchemes := dt.validSchemes
		if validSchemes != nil && len(*validSchemes) == 0 {
			return nil
		}
		if validSchemes == nil {
			validSchemes = &DefaultSchemes
		}
		for _, scheme := range *validSchemes {
			if url.Scheme == scheme {
				return nil
			}
		}
		return errors.New("invalid scheme")
	})
	return dt
}

type dataType struct {
	validSchemes *[]string
	url          *url.URL
	validators   []func(*url.URL) error
}

// Type returns string to satisfy the field.DataType interface
func (t *dataType) Type() interface{} {
	return ""
}

// RestrictToHostname ensures that the hostname (host - port) of the url is equal to the given hostname
// This is different from RestrictToDomain which is a subset of the hostname. This ensures the *entire* hostname
// is the given hostname e.g. www.google.com vs google.com
// if you want any google url, RestrictToDomain("google.com"). If you want a google on desktop URI, you'd want
// RestrictToHostname("www.google.com")
func (t *dataType) RestrictToHostname(hostname string) *dataType {
	return t.Validate(func(url *url.URL) error {
		if url == nil {
			return errors.New("invalid url")
		}
		if hostname != url.Hostname() {
			return fmt.Errorf("invalid hostname. expected host %s, got %s", hostname, url.Hostname())
		}
		return nil
	})
}

// RestrictToSchemes provides a way to change from the default schemes
// Providing an empty slice clears all validation
// Providing any slice changes the validated schemes to the provided input
func (t *dataType) RestrictToSchemes(schemes []string) *dataType {
	t.validSchemes = &schemes
	return t
}

// RestrictToDomain ensures that the domain of the url is of the given domain
// If any subdomains are provided, it ensures that the "full" subdomain (any parts to the left of the given domain)
// is equal to any of the given subdomains
func (t *dataType) RestrictToDomain(domain string, subdomains ...string) *dataType {
	return t.Validate(func(url *url.URL) error {
		if url == nil {
			return errors.New("invalid url")
		}

		if !strings.HasSuffix(url.Hostname(), domain) {
			return fmt.Errorf("invalid domain %s for url %s", domain, url.String())
		}

		if len(subdomains) == 0 {
			return nil
		}
		parts := strings.Split(url.Hostname(), ".")
		domainParts := strings.Split(domain, ".")

		subdomain := strings.Join(parts[:len(parts)-len(domainParts)], ".")

		for _, s := range subdomains {
			if s == subdomain {
				return nil
			}
		}

		return fmt.Errorf("invalid subdomain")
	})
}

// Path ensures that the path of the url is equal to the given path
// Note that it expects the leading slash to be passed here
func (t *dataType) Path(path string) *dataType {
	return t.Validate(func(url *url.URL) error {
		if url.Path == path {
			return nil
		}
		return fmt.Errorf("invalid path, expected %s, got %s", path, url.Path)
	})
}

// QueryStringExists valdates that the query string contains the given key with one or more values
func (t *dataType) QueryStringExists(key string) *dataType {
	return t.Validate(func(url *url.URL) error {
		v := url.Query()

		if v.Get(key) == "" {
			return fmt.Errorf("querystring %s doesn't exist in url", key)
		}
		return nil
	})
}

// Validate takes a URL function and runs it to ensure the given url conforms
func (t *dataType) Validate(fn func(url *url.URL) error) *dataType {
	t.validators = append(t.validators, fn)
	return t
}

// Valid validates that the input is a valid url.
func (t *dataType) Valid(val interface{}) error {
	s := val.(string)
	url, err := url.Parse(s)
	if err != nil {
		return err
	}

	for _, val := range t.validators {
		if err := val(url); err != nil {
			return err
		}
	}

	t.url = url
	return nil
}

func (t *dataType) Format(val interface{}) (interface{}, error) {
	if t.url == nil {
		return nil, fmt.Errorf("called Format without calling Valid or with invalid url %s", val)

	}
	return t.url.String(), nil
}

var _ field.DataType = &dataType{}
