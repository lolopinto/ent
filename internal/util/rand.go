package util

import (
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"time"

	generate "github.com/sethvargo/go-password/password"
)

func GenerateRandCode(n int) string {
	rand.Seed(time.Now().UnixNano())

	var sb strings.Builder
	for i := 0; i < n; i++ {
		sb.WriteString(strconv.Itoa(rand.Intn(9)))
	}
	return sb.String()
}

func GenerateRandEmail() string {
	return fmt.Sprintf("test-%s@email.com", GenerateRandCode(9))
}

func GenerateRandPassword() string {
	// generate a random password
	password, err := generate.Generate(30, 3, 3, true, false)
	Die(err)
	return password
}
