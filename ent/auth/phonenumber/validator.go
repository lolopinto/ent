package phonenumber

import (
	"errors"
	"fmt"

	"github.com/lolopinto/ent/ent/cache"
)

// DefaultKey is the default key for the phone number|pin combo stored in the cache
func DefaultKey(phoneNumber string) string {
	return fmt.Sprintf("phone_number:%s", phoneNumber)
}

// Validator takes a phonenumber/pin combo and validates that it's a valid
// Note that this already assumes a valid phone number via the IDFromPhoneNumber function
// passed to PhonePinAuth
type Validator interface {
	// takes phone number|pin and returns error if not valid
	// could be email/pin? or email/password
	Valid(string, string) error
}

// Clearer is an object that takes the phone number and clears the key
// associated with it from its storage only if the PIN is valid.
// If you want to clear even if the PIN provided was incorrect,
// wrap whatever validator that's being used by OneTimePINValidator
type Clearer interface {
	Clear(string) // clear key? separate func
}

// MemoryValidator is used to store the PIN in memory (using go-cache) and then
// checking that there was previously a mapping from phone number to pin stored
type MemoryValidator struct {
	// Required. Instance of Memory responsible for storing phone number
	Memory *cache.Memory

	// function that takes a phonenumber and returns the key. Defaults to DefaultKey when not provided
	KeyFunc func(string) string
}

// Valid returns error if the pin stored for phone number doesn't match the provided pin
func (v *MemoryValidator) Valid(phoneNumber, pin string) error {
	if v.Memory == nil {
		return errors.New("Memory field is required")
	}

	key := v.getKey(phoneNumber)

	val, found := v.Memory.Get(key)
	if !found {
		return errors.New("No PIN exists")
	}

	if val == pin {
		return nil
	}
	return errors.New("PIN not as expected")
}

// Clear clears the key mapping phone number to pin in memory
func (v *MemoryValidator) Clear(phoneNumber string) {
	v.Memory.Delete(v.getKey(phoneNumber))
}

func (v *MemoryValidator) getKey(phoneNumber string) string {
	if v.KeyFunc == nil {
		return DefaultKey(phoneNumber)
	}
	return v.KeyFunc(phoneNumber)
}

// OneTimePINValidator wraps any validator to ensure that the PIN is cleared
// from storage even if there was an error validating the PIN.
// Does not allow PIN reuses. Having default lenient behavior with this as
// the backup provides the most optionality
type OneTimePINValidator struct {
	Validator Validator
}

// Valid returns error if pin is not valid for phone number
func (v *OneTimePINValidator) Valid(phoneNumber, pin string) error {
	err := v.Validator.Valid(phoneNumber, pin)

	clearer, ok := v.Validator.(Clearer)
	if ok {
		defer clearer.Clear(phoneNumber)
	}
	return err
}

// RedisValidator is used to store the PIN in redis and then
// checking that there was previously a mapping from phone number to pin stored
type RedisValidator struct {
	// Required. Instance of Redis responsible for storing phone number
	Redis *cache.Redis

	// function that takes a phonenumber and returns the key. Defaults to DefaultKey when not provided
	KeyFunc func(string) string
}

// Valid returns error if the pin stored for phone number doesn't match the provided pin
func (v *RedisValidator) Valid(phoneNumber, pin string) error {
	if v.Redis == nil {
		return errors.New("Redis field is required")
	}

	key := v.getKey(phoneNumber)

	val, found, err := v.Redis.Get(key)
	if err != nil {
		return err
	}
	if !found {
		return errors.New("No PIN exists")
	}

	if val == pin {
		return nil
	}
	return errors.New("PIN not as expected")
}

// Clear clears the key mapping phone number to pin in memory
func (v *RedisValidator) Clear(phoneNumber string) {
	v.Redis.Delete(v.getKey(phoneNumber))
}

func (v *RedisValidator) getKey(phoneNumber string) string {
	if v.KeyFunc == nil {
		return DefaultKey(phoneNumber)
	}
	return v.KeyFunc(phoneNumber)
}
