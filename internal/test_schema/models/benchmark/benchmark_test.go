package benchmark

import (
	"testing"

	"github.com/lolopinto/ent/ent"
	"github.com/lolopinto/ent/internal/util"
	"github.com/stretchr/testify/require"

	"github.com/lolopinto/ent/ent/viewer"
	"github.com/lolopinto/ent/ent/viewertesting"
	"github.com/lolopinto/ent/internal/test_schema/models"
	useraction "github.com/lolopinto/ent/internal/test_schema/models/user/action"
	"github.com/lolopinto/ent/internal/test_schema/testschemaviewer"
)

// TODO need viewer|ent result per request memory cache and need to benchmark with/without that
// TODO need multi-insert, multi-delete etc APIs

func BenchmarkInsert(b *testing.B) {
	pwd, err := util.GenerateRandPassword()
	require.Nil(b, err)

	for i := 0; i < b.N; i++ {
		_, err := useraction.CreateUser(viewer.LoggedOutViewer()).
			SetEmailAddress(util.GenerateRandEmail()).
			SetPassword(pwd).
			SetFirstName("Jon").
			SetLastName("Snow").
			Save()

		if err != nil {
			b.FailNow()
		}
	}
}

func createUser(b *testing.B) (viewer.ViewerContext, *models.User) {
	pwd, err := util.GenerateRandPassword()
	require.Nil(b, err)

	user, err := useraction.CreateUser(viewer.LoggedOutViewer()).
		SetEmailAddress(util.GenerateRandEmail()).
		SetPassword(pwd).
		SetFirstName("Jon").
		SetLastName("Snow").
		Save()

	if err != nil {
		b.FailNow()
	}

	v, err := testschemaviewer.NewViewerContext(user.ID)
	if err != nil {
		b.FailNow()
	}

	return v, user
}

func BenchmarkEdit(b *testing.B) {
	v, user := createUser(b)
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := useraction.EditUser(v, user).
			SetFirstName("Dany" + util.GenerateRandCode(6)).
			Save()
		if err != nil {
			b.FailNow()
		}
	}
}

func BenchmarkDelete(b *testing.B) {
	v, user := createUser(b)
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		err := useraction.DeleteUser(v, user).
			Save()
		if err != nil {
			b.FailNow()
		}
	}
}

func BenchmarkReadCacheDisabled(b *testing.B) {
	v, user := createUser(b)
	ent.DisableCache()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := models.LoadUser(v, user.ID)
		if err != nil {
			b.FailNow()
		}
	}
}

func BenchmarkGenReadCacheDisabled(b *testing.B) {
	v, user := createUser(b)
	ent.DisableCache()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		res := <-models.GenLoadUser(v, user.ID)
		if res.Err != nil {
			b.FailNow()
		}
	}
}

func BenchmarkReadCacheEnabled(b *testing.B) {
	v, user := createUser(b)
	ent.EnableCache()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := models.LoadUser(v, user.ID)
		if err != nil {
			b.FailNow()
		}
	}
}

func BenchmarkGenReadCacheEnabled(b *testing.B) {
	v, user := createUser(b)
	ent.EnableCache()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		res := <-models.GenLoadUser(v, user.ID)
		if res.Err != nil {
			b.FailNow()
		}
	}
}

func BenchmarkReadCachePrimedAndEnabled(b *testing.B) {
	v, user := createUser(b)
	ent.EnableCache()
	_, err := models.LoadUser(v, user.ID)
	// prime the load first
	if err != nil {
		b.FailNow()
	}
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := models.LoadUser(v, user.ID)
		if err != nil {
			b.FailNow()
		}
	}
}

func BenchmarkRawReadCacheDisabled(b *testing.B) {
	v, user := createUser(b)
	ent.DisableCache()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		loader := models.NewUserLoader(v)
		_, err := ent.LoadNodeRawData(user.ID, loader)
		if err != nil {
			b.FailNow()
		}
	}
}

func BenchmarkRawReadCacheEnabled(b *testing.B) {
	v, user := createUser(b)
	ent.EnableCache()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		loader := models.NewUserLoader(v)
		_, err := ent.LoadNodeRawData(user.ID, loader)
		if err != nil {
			b.FailNow()
		}
	}
}

func createUsers(b *testing.B) []string {
	// some large enough number but not too large is what we care about
	ids := make([]string, 30)
	for i := 0; i < 30; i++ {
		_, user := createUser(b)
		ids[i] = user.ID
	}
	return ids
}

func BenchmarkMultiReadCacheEnabled(b *testing.B) {
	ids := createUsers(b)
	v := viewertesting.OmniViewerContext{}
	ent.EnableCache()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := models.LoadUsers(v, ids...)
		if err != nil {
			b.FailNow()
		}
	}
}

func BenchmarkMultiReadCacheDisabled(b *testing.B) {
	ids := createUsers(b)
	v := viewertesting.OmniViewerContext{}
	ent.DisableCache()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := models.LoadUsers(v, ids...)
		if err != nil {
			b.FailNow()
		}
	}
}

func BenchmarkGenMultiReadCacheEnabled(b *testing.B) {
	ids := createUsers(b)
	v := viewertesting.OmniViewerContext{}
	ent.EnableCache()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		res := <-models.GenLoadUsers(v, ids...)
		if res.Err != nil {
			b.FailNow()
		}
	}
}

func BenchmarkGenMultiReadCacheDisabled(b *testing.B) {
	ids := createUsers(b)
	v := viewertesting.OmniViewerContext{}
	ent.DisableCache()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		res := <-models.GenLoadUsers(v, ids...)
		if res.Err != nil {
			b.FailNow()
		}
	}
}

func BenchmarkMultiReadRawCacheDisabled(b *testing.B) {
	// some large enough number but not too large is what we care about
	ids := make([]string, 30)
	for i := 0; i < 30; i++ {
		_, user := createUser(b)
		ids[i] = user.ID
	}
	v := viewertesting.OmniViewerContext{}
	ent.DisableCache()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		loader := models.NewUserLoader(v)
		_, err := ent.LoadNodesRawData(ids, loader)
		if err != nil {
			b.FailNow()
		}
	}
}

func BenchmarkMultiReadRawCacheEnabled(b *testing.B) {
	// some large enough number but not too large is what we care about
	ids := make([]string, 30)
	for i := 0; i < 30; i++ {
		_, user := createUser(b)
		ids[i] = user.ID
	}
	v := viewertesting.OmniViewerContext{}
	ent.EnableCache()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		loader := models.NewUserLoader(v)
		_, err := ent.LoadNodesRawData(ids, loader)
		if err != nil {
			b.FailNow()
		}
	}
}
