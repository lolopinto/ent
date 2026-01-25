package devschema

import (
	"crypto/sha1"
	"encoding/hex"
	"os"
	"strings"
)

func firstEnv(keys ...string) string {
	for _, key := range keys {
		val := os.Getenv(key)
		if val != "" {
			return val
		}
	}
	return ""
}

func parseEnvBool(keys ...string) (bool, bool) {
	for _, key := range keys {
		val := os.Getenv(key)
		if val == "" {
			continue
		}
		if b, ok := parseBool(val); ok {
			return b, true
		}
	}
	return false, false
}

func parseBool(val string) (bool, bool) {
	v := strings.TrimSpace(strings.ToLower(val))
	switch v {
	case "1", "true", "t", "yes", "y":
		return true, true
	case "0", "false", "f", "no", "n":
		return false, true
	default:
		return false, false
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

func buildSchemaName(prefix, branch, suffix string) string {
	prefix = sanitizeIdentifier(prefix)
	branchSlug := slugify(branch)
	if branchSlug == "" {
		branchSlug = "branch"
	}
	hash := shortHash(branch)
	parts := []string{prefix, branchSlug, hash}
	if suffix != "" {
		parts = append(parts, slugify(suffix))
	}
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
	if over > 0 && suffix != "" {
		suffixSlug := slugify(suffix)
		if len(suffixSlug) > 1 {
			trim := min(over, len(suffixSlug)-1)
			suffixSlug = suffixSlug[:len(suffixSlug)-trim]
			suffix = suffixSlug
			over -= trim
		}
	}

	parts = []string{prefix, branchSlug, hash}
	if suffix != "" {
		parts = append(parts, suffix)
	}
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
