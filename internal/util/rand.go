package util

import (
	"math/rand"
	"strconv"
	"strings"
	"time"
)

func GenerateRandCode(n int) string {
	rand.Seed(time.Now().UnixNano())

	var sb strings.Builder
	for i := 0; i < n; i++ {
		sb.WriteString(strconv.Itoa(rand.Intn(9)))
	}
	return sb.String()
}
