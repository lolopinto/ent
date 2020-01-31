package url_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/lolopinto/ent/ent/field"
	"github.com/lolopinto/ent/ent/field/url"
	"github.com/stretchr/testify/require"
)

type testCase struct {
	input  string
	output string
	err    error
}

func TestDataType(t *testing.T) {
	testCases := map[string]func() (field.FullDataType, testCase){
		"base": func() (field.FullDataType, testCase) {
			dt := url.Type()

			return dt, testCase{"https://google.com", "https://google.com", nil}
		},
		"hostname-shared-domain": func() (field.FullDataType, testCase) {
			dt := url.Type().RestrictToHostname("google.com")

			return dt, testCase{"https://www.google.com", "https://www.google.com", errors.New("invalid hostname")}
		},
		"hostname-different-subdomain": func() (field.FullDataType, testCase) {
			dt := url.Type().RestrictToHostname("news.google.com")

			return dt, testCase{"https://www.google.com", "https://www.google.com", errors.New("invalid hostname")}
		},
		"hostname-valid": func() (field.FullDataType, testCase) {
			dt := url.Type().RestrictToHostname("www.google.com")

			return dt, testCase{"https://www.google.com", "https://www.google.com", nil}
		},
		"domain": func() (field.FullDataType, testCase) {
			dt := url.Type().RestrictToDomain("wikipedia.org")

			return dt, testCase{"https://www.google.com", "https://www.google.com", errors.New("invalid domain")}
		},
		"domain-valid": func() (field.FullDataType, testCase) {
			dt := url.Type().RestrictToDomain("wikipedia.org")

			return dt, testCase{"https://en.wikipedia.org", "https://en.wikipedia.org", nil}
		},
		"domain-subdomain-invalid": func() (field.FullDataType, testCase) {
			dt := url.Type().RestrictToDomain("wikipedia.org", "en")

			return dt, testCase{"https://fr.wikipedia.org", "https://fr.wikipedia.org", errors.New("invalid subdomain")}
		},
		"domain-subdomain-valid": func() (field.FullDataType, testCase) {
			dt := url.Type().RestrictToDomain("wikipedia.org", "en", "fr")

			return dt, testCase{"https://fr.wikipedia.org", "https://fr.wikipedia.org", nil}
		},
		"long-domain-invalid": func() (field.FullDataType, testCase) {
			dt := url.Type().RestrictToDomain("aws.amazon.com")

			return dt, testCase{"https://amazon.com", "", errors.New("invalid domain")}
		},
		"long-domain-valid": func() (field.FullDataType, testCase) {
			dt := url.Type().RestrictToDomain("aws.amazon.com")

			return dt, testCase{"https://docs.aws.amazon.com", "https://docs.aws.amazon.com", nil}
		},
		"s3-invalid": func() (field.FullDataType, testCase) {
			dt := url.Type().RestrictToDomain("amazonaws.com")

			return dt, testCase{"https://docs.aws.amazon.com", "https://docs.aws.amazon.com", errors.New("invalid domain")}
		},
		"s3-valid": func() (field.FullDataType, testCase) {
			dt := url.Type().RestrictToDomain("amazonaws.com")

			return dt, testCase{
				"https://MyAWSbucket.s3.us-east-1.amazonaws.com/yourobject",
				"https://MyAWSbucket.s3.us-east-1.amazonaws.com/yourobject",
				nil,
			}
		},
		"ftp-scheme": func() (field.FullDataType, testCase) {
			dt := url.Type()

			return dt, testCase{
				"ftp://ftp.funet.fi/pub/standards/RFC/rfc959.txt",
				"ftp://ftp.funet.fi/pub/standards/RFC/rfc959.txt",
				errors.New("invalid scheme"),
			}
		},
		"ftp-scheme-valid": func() (field.FullDataType, testCase) {
			dt := url.Type().RestrictToSchemes([]string{"ftp"})

			return dt, testCase{
				"ftp://ftp.funet.fi/pub/standards/RFC/rfc959.txt",
				"ftp://ftp.funet.fi/pub/standards/RFC/rfc959.txt",
				nil,
			}
		},
		"ftp-no-scheme-valid": func() (field.FullDataType, testCase) {
			dt := url.Type().RestrictToSchemes([]string{})

			return dt, testCase{
				"ftp://ftp.funet.fi/pub/standards/RFC/rfc959.txt",
				"ftp://ftp.funet.fi/pub/standards/RFC/rfc959.txt",
				nil,
			}
		},
		"tel-no-scheme-valid": func() (field.FullDataType, testCase) {
			dt := url.Type().RestrictToSchemes([]string{})

			return dt, testCase{
				"tel:+16501234567",
				"tel:+16501234567",
				nil,
			}
		},
		"path-invalid": func() (field.FullDataType, testCase) {
			dt := url.Type().Path("/profile.php")

			return dt, testCase{
				"https://www.facebook.com/home.php",
				"https://www.facebook.com/profile.php",
				errors.New("invalid path"),
			}
		},
		"path-valid": func() (field.FullDataType, testCase) {
			dt := url.Type().Path("/profile.php")

			return dt, testCase{
				"https://www.facebook.com/profile.php?id=4",
				"https://www.facebook.com/profile.php?id=4",
				nil,
			}
		},
		"query-invalid": func() (field.FullDataType, testCase) {
			dt := url.Type().Path("/profile.php").QueryStringExists("foo")

			return dt, testCase{
				"https://www.facebook.com/profile.php?id=4",
				"https://www.facebook.com/profile.php?id=4",
				errors.New("querystring foo"),
			}
		},
		"query-valid": func() (field.FullDataType, testCase) {
			dt := url.Type().Path("/profile.php").QueryStringExists("id")

			return dt, testCase{
				"https://www.facebook.com/profile.php?id=4",
				"https://www.facebook.com/profile.php?id=4",
				nil,
			}
		},
	}

	for key, fn := range testCases {
		t.Run(key, func(t *testing.T) {

			dt, expRes := fn()

			err := dt.Valid(expRes.input)
			if expRes.err == nil {
				require.Nil(t, err)
				res, err := dt.Format(expRes.input)
				require.Nil(t, err)
				require.Equal(t, expRes.output, res)
			} else {
				require.NotNil(t, err)
				require.Condition(t, func() bool {
					return strings.Contains(err.Error(), expRes.err.Error())
				})
			}
		})
	}
}
