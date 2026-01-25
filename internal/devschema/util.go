package devschema

import (
	"crypto/sha1"
	"encoding/hex"
	"os"
	"strings"
)

func parseEnvBool(key string) *bool {
	val, ok := os.LookupEnv(key)
	if !ok {
		return nil
	}
	val = strings.TrimSpace(strings.ToLower(val))
	switch val {
	case "1", "true", "t", "yes", "y":
		v := true
		return &v
	case "0", "false", "f", "no", "n":
		v := false
		return &v
	default:
		return nil
	}
}

func slugify(input string) string {
	if input == "" {
		return ""
	}
	input = strings.ToLower(input)
	var b strings.Builder
	lastUnderscore := false
	for _, r := range input {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			lastUnderscore = false
			continue
		}
		if !lastUnderscore {
			b.WriteByte('_')
			lastUnderscore = true
		}
	}
	out := strings.Trim(b.String(), "_")
	return out
}

func sanitizeIdentifier(input string) string {
	slug := slugify(input)
	if slug == "" {
		return "schema"
	}
	if len(slug) > MaxSchemaLen {
		return slug[:MaxSchemaLen]
	}
	return slug
}

func shortHash(input string) string {
	h := sha1.Sum([]byte(input))
	return hex.EncodeToString(h[:])[:8]
}

func buildSchemaName(branch string) string {
	prefix := sanitizeIdentifier(DefaultPrefix)
	branchSlug := slugify(branch)
	if branchSlug == "" {
		branchSlug = "branch"
	}
	hash := shortHash(branch)
	parts := []string{prefix, branchSlug, hash}
	name := strings.Join(parts, "_")
	if len(name) <= MaxSchemaLen {
		return name
	}

	over := len(name) - MaxSchemaLen
	if over > 0 && len(branchSlug) > 1 {
		trim := min(over, len(branchSlug)-1)
		branchSlug = branchSlug[:len(branchSlug)-trim]
		over -= trim
	}
	parts = []string{prefix, branchSlug, hash}
	name = strings.Join(parts, "_")
	if len(name) > MaxSchemaLen {
		return name[:MaxSchemaLen]
	}
	return name
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
