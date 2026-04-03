package names

import (
	"strings"
	"unicode"
	"unicode/utf8"
)

func isSeparatorToken(s string) bool {
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			return false
		}
	}
	return true
}

func titleWord(s string) string {
	if s == "" {
		return s
	}

	lowered := []rune(strings.ToLower(s))
	for i, r := range lowered {
		if unicode.IsLetter(r) {
			lowered[i] = unicode.ToUpper(r)
			break
		}
	}
	return string(lowered)
}

func lowerWord(s string) string {
	return strings.ToLower(s)
}

func toSnakeWord(s string) string {
	if s == "" {
		return s
	}
	if !utf8.ValidString(s) {
		return strings.ToLower(s)
	}

	split := splitCamelCase(s)
	if len(split) > 2 {
		last := split[len(split)-1]
		nextLast := split[len(split)-2]
		if last.entry == "s" && nextLast.class == upper {
			prefixWords := snakeWords(split[:len(split)-2])
			return strings.Join(append(prefixWords, strings.ToLower(nextLast.entry)+last.entry), "_")
		}
	}
	return strings.Join(snakeWords(split), "_")
}

func snakeWords(split []splitResult) []string {
	words := make([]string, 0, len(split))
	for _, v := range split {
		if isSeparatorToken(v.entry) {
			continue
		}
		word := strings.ToLower(v.entry)
		if v.class == digit && len(words) > 0 {
			words[len(words)-1] += word
			continue
		}
		words = append(words, word)
	}
	return words
}
