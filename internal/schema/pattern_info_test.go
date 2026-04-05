package schema

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPatternInfoMixinBaseNaming(t *testing.T) {
	pattern := &PatternInfo{Name: "UserAuthJWT"}

	assert.Equal(t, "UserAuthJWTBaseMixin", pattern.GetMixinBaseName())
	assert.Equal(t, "src/ent/generated/mixins/user_auth_jwt_base", pattern.GetImportPathForMixinBase())
}
