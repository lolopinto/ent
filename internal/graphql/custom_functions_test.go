package graphql

import (
	"bytes"
	"go/ast"
	"go/format"
	"go/printer"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/iancoleman/strcase"
	"github.com/lolopinto/ent/internal/astparser"
	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/codegen/nodeinfo"
	"github.com/lolopinto/ent/internal/enttype"
	"github.com/lolopinto/ent/internal/field"
	"github.com/lolopinto/ent/internal/schema"
	"github.com/lolopinto/ent/internal/schemaparser"
	"github.com/stretchr/testify/assert"
)

func TestFunctionThatReturns(t *testing.T) {
	verifyGeneratedCode(t, `package graphql
	
	import "time"

// @graphql serverTime
func serverTime() time.Time {
	return time.Now()
}
	`,
		"ServerTime",
		"queryResolver",
		`func (r *queryResolver) ServerTime(ctx context.Context) (*time.Time, error) {
	ret := serverTime()
	return &ret, nil
}`,
	)
}

func TestFunctionThatReturnsDirectly(t *testing.T) {
	verifyGeneratedCode(t, `package graphql
	
	import "time"

// @graphql serverTime
func serverTime() (*time.Time, error) {
	t := time.Now()
	return &t, nil
}
	`,
		"ServerTime",
		"queryResolver",
		`func (r *queryResolver) ServerTime(ctx context.Context) (*time.Time, error) {
	return serverTime()
}`,
	)
}

func TestFunctionThatLooksLikeItReturnsDirectly(t *testing.T) {
	verifyGeneratedCode(t, `package graphql
	
	import "time"

// @graphql serverTime
func serverTime() (time.Time, error) {
	t := time.Now()
	return t, nil
}
	`,
		"ServerTime",
		"queryResolver",
		`func (r *queryResolver) ServerTime(ctx context.Context) (*time.Time, error) {
	ret, err := serverTime()
	if err != nil {
		return nil, err
	}
	return &ret, nil
}`,
	)
}

func TestFunctionThatReturnsObjDirectly(t *testing.T) {
	verifyGeneratedCode(t, `package graphql
	
	import "github.com/lolopinto/ent/internal/test_schema/models"

// @graphql viewer
func loggedInUser() (*models.User, error) {
//	return &models.User{}, nil
return nil, nil
}
	`,
		"Viewer",
		"queryResolver",
		`func (r *queryResolver) Viewer(ctx context.Context) (*models.User, error) {
	return loggedInUser()
}`,
		"User",
	)
}

func TestFunctionThatReturnsObjInMutation(t *testing.T) {
	verifyGeneratedCode(t, `package graphql
	
	import "github.com/lolopinto/ent/internal/test_schema/models"

// @graphql viewer Mutation
func loggedInUser() (*models.User, error) {
	return &models.User{}, nil
}
	`,
		"Viewer",
		"mutationResolver",
		`func (r *mutationResolver) Viewer(ctx context.Context) (*ViewerResponse, error) {
	user, err := loggedInUser()
	if err != nil {
		return nil, err
	}

	return &ViewerResponse{
		User: user,
	}, nil
}`,
		"User",
	)
}

func TestFunctionWithArgs(t *testing.T) {
	verifyGeneratedCode(
		t,
		`package graphql

		import "context"
	
// @graphql logEvent Mutation
func Log(ctx context.Context, event string) {
}`,
		"LogEvent",
		"mutationResolver",
		`func (r *mutationResolver) LogEvent(ctx context.Context, input LogEventInput) (*LogEventResponse, error) {
	Log(ctx, input.Event)

	return &LogEventResponse{
		Success: cast.ConvertToNullableBool(true),
	}, nil
}`,
	)
}

func TestFunctionWithArgsNoInputObj(t *testing.T) {
	verifyGeneratedCode(
		t,
		`package graphql

		import "context"
		import "time"
	
// @graphql logEvent Mutation
// @graphqlinputtype false
func Log(ctx context.Context, event string, t time.Time) {
}`,
		"LogEvent",
		"mutationResolver",
		`func (r *mutationResolver) LogEvent(ctx context.Context, event string, t time.Time) (*LogEventResponse, error) {
	Log(ctx, event, t)

	return &LogEventResponse{
		Success: cast.ConvertToNullableBool(true),
	}, nil
}`,
	)
}

func TestFunctionThatReturnsError(t *testing.T) {
	verifyGeneratedCode(
		t,
		`package graphql
	
// @graphql logEvent Mutation
func Log() error{
	return nil
}`,
		"LogEvent",
		"mutationResolver",
		`func (r *mutationResolver) LogEvent(ctx context.Context) (*LogEventResponse, error) {
	err := Log()
	if err != nil {
		return nil, err
	}

	return &LogEventResponse{
		Success: cast.ConvertToNullableBool(true),
	}, nil
}`,
	)
}

func TestFunctionThatTakesAndReturnsObject(t *testing.T) {
	verifyGeneratedCode(
		t,
		`package graphql
	
	import "context"
	import "github.com/lolopinto/ent/internal/test_schema/models"
	
// @graphql viewerBlock Mutation
func Block(ctx context.Context, user *models.User) (*models.User, error) {
	return nil, nil
}`,
		"ViewerBlock",
		"mutationResolver",
		`func (r *mutationResolver) ViewerBlock(ctx context.Context, input ViewerBlockInput) (*ViewerBlockResponse, error) {
	user, userErr := models.LoadUserFromContext(ctx, input.UserID)
	if userErr != nil {
		return nil, userErr
	}

	user, err := Block(ctx, user)
	if err != nil {
		return nil, err
	}

	return &ViewerBlockResponse{
		User: user,
	}, nil
}`,
		"User",
	)
}

func TestFunctionThatOverridesParamName(t *testing.T) {
	verifyGeneratedCode(
		t,
		`package graphql

		import "context"
	
// @graphql logEvent Mutation
// @graphqlparam datapoint event
func Log(ctx context.Context, datapoint string) {
}`,
		"LogEvent",
		"mutationResolver",
		`func (r *mutationResolver) LogEvent(ctx context.Context, input LogEventInput) (*LogEventResponse, error) {
	Log(ctx, input.Event)

	return &LogEventResponse{
		Success: cast.ConvertToNullableBool(true),
	}, nil
}`,
	)
}

func TestFuncThatTakesMultipleArgOfSameType(t *testing.T) {
	verifyGeneratedCode(
		t,
		`package graphql

		import "context"
	
// @graphql adminAddFriend Mutation
func AdminAddFriend(ctx context.Context, frienderID, friendeeID string) error {
	return nil
}`,
		"AdminAddFriend",
		"mutationResolver",
		`func (r *mutationResolver) AdminAddFriend(ctx context.Context, input AdminAddFriendInput) (*AdminAddFriendResponse, error) {
	err := AdminAddFriend(ctx, input.FrienderID, input.FriendeeID)
	if err != nil {
		return nil, err
	}

	return &AdminAddFriendResponse{
		Success: cast.ConvertToNullableBool(true),
	}, nil
}`,
	)
}

func TestFuncThatTakesMultipleArgsOfObjects(t *testing.T) {
	verifyGeneratedCode(
		t,
		`package graphql

		import "context"
		import "github.com/lolopinto/ent/internal/test_schema/models"
	
// @graphql adminAddFriend Mutation
func AdminAddFriend(ctx context.Context, friender, friendee *models.User) error {
	// TODO
	return nil
}`,
		"AdminAddFriend",
		"mutationResolver",
		`func (r *mutationResolver) AdminAddFriend(ctx context.Context, input AdminAddFriendInput) (*AdminAddFriendResponse, error) {
	v, ctxErr := viewer.ForContext(ctx)
	if ctxErr != nil {
		return nil, ctxErr
	}

	var wg sync.WaitGroup
	wg.Add(2)
	var frienderResult models.UserResult
	var friendeeResult models.UserResult
	go models.GenLoadUser(v, input.FrienderID, &frienderResult, &wg)
	go models.GenLoadUser(v, input.FriendeeID, &friendeeResult, &wg)
	wg.Wait() 
	if entErr := ent.CoalesceErr(&frienderResult, &friendeeResult); entErr != nil {
		return nil, entErr
	}

	err := AdminAddFriend(ctx, frienderResult.User, friendeeResult.User)
	if err != nil {
		return nil, err
	}

	return &AdminAddFriendResponse{
		Success: cast.ConvertToNullableBool(true),
	}, nil
}`,
		"User",
	)
}

func TestFuncThatTakesMultipleArgsOfObjectsNoInputObj(t *testing.T) {
	verifyGeneratedCode(
		t,
		`package graphql

		import "context"
		import "github.com/lolopinto/ent/internal/test_schema/models"
	
// @graphql adminAddFriend Mutation
// @graphqlinputtype false
func AdminAddFriend(ctx context.Context, friender, friendee *models.User) error {
	// TODO
	return nil
}`,
		"AdminAddFriend",
		"mutationResolver",
		`func (r *mutationResolver) AdminAddFriend(ctx context.Context, frienderID string, friendeeID string) (*AdminAddFriendResponse, error) {
	v, ctxErr := viewer.ForContext(ctx)
	if ctxErr != nil {
		return nil, ctxErr
	}

	var wg sync.WaitGroup
	wg.Add(2)
	var frienderResult models.UserResult
	var friendeeResult models.UserResult
	go models.GenLoadUser(v, frienderID, &frienderResult, &wg)
	go models.GenLoadUser(v, friendeeID, &friendeeResult, &wg)
	wg.Wait() 
	if entErr := ent.CoalesceErr(&frienderResult, &friendeeResult); entErr != nil {
		return nil, entErr
	}

	err := AdminAddFriend(ctx, frienderResult.User, friendeeResult.User)
	if err != nil {
		return nil, err
	}

	return &AdminAddFriendResponse{
		Success: cast.ConvertToNullableBool(true),
	}, nil
}`,
		"User",
	)
}

func TestFuncThatTakesSliceOfObject(t *testing.T) {
	verifyGeneratedCode(
		t,
		`package graphql

		import "context"
		import "github.com/lolopinto/ent/internal/test_schema/models"
	
// @graphql adminAddFriends Mutation
func AdminAddFriends(ctx context.Context, friends []*models.User) error {
	// TODO
	return nil
}`,
		"AdminAddFriends",
		"mutationResolver",
		`func (r *mutationResolver) AdminAddFriends(ctx context.Context, input AdminAddFriendsInput) (*AdminAddFriendsResponse, error) {
	v, ctxErr := viewer.ForContext(ctx)
	if ctxErr != nil {
		return nil, ctxErr
	}
	var wg sync.WaitGroup
	results := make([]*models.UserResult, len(input.FriendIDs))
	wg.Add(len(input.FriendIDs))
	for idx, id := range input.FriendIDs {
		go models.GenLoadUser(v, id, results[idx], &wg)
	}
	wg.Wait() 

	var errs []error
	var friends []*models.User
	for _, res := range results {
		if res.Err != nil {
			errs = append(errs, res.Err)
		} else {
			friends = append(friends, res.User)
		}
	}
	if err := ent.CoalesceErr(errs...); err != nil {
		return nil, err
	}

	err := AdminAddFriends(ctx, friends)
	if err != nil {
		return nil, err
	}

	return &AdminAddFriendsResponse{
		Success: cast.ConvertToNullableBool(true),
	}, nil
}`,
		"User",
	)
}

func TestFuncThatTakesSliceOfObjectNoInputObj(t *testing.T) {
	verifyGeneratedCode(
		t,
		`package graphql

		import "context"
		import "github.com/lolopinto/ent/internal/test_schema/models"
	
// @graphql adminAddFriends Mutation
// @graphqlinputtype false
func AdminAddFriends(ctx context.Context, friends []*models.User) error {
	// TODO
	return nil
}`,
		"AdminAddFriends",
		"mutationResolver",
		`func (r *mutationResolver) AdminAddFriends(ctx context.Context, friendIDs []string) (*AdminAddFriendsResponse, error) {
	v, ctxErr := viewer.ForContext(ctx)
	if ctxErr != nil {
		return nil, ctxErr
	}
	var wg sync.WaitGroup
	results := make([]*models.UserResult, len(friendIDs))
	wg.Add(len(friendIDs))
	for idx, id := range friendIDs {
		go models.GenLoadUser(v, id, results[idx], &wg)
	}
	wg.Wait() 

	var errs []error
	var friends []*models.User
	for _, res := range results {
		if res.Err != nil {
			errs = append(errs, res.Err)
		} else {
			friends = append(friends, res.User)
		}
	}
	if err := ent.CoalesceErr(errs...); err != nil {
		return nil, err
	}

	err := AdminAddFriends(ctx, friends)
	if err != nil {
		return nil, err
	}

	return &AdminAddFriendsResponse{
		Success: cast.ConvertToNullableBool(true),
	}, nil
}`,
		"User",
	)
}

func TestFuncThatTakesSliceOfScalar(t *testing.T) {
	verifyGeneratedCode(
		t,
		`package graphql

		import "context"
	
// @graphql adminAddFriends Mutation
func AdminAddFriends(ctx context.Context, friendIDs []string) error {
	return nil
}`,
		"AdminAddFriends",
		"mutationResolver",
		`func (r *mutationResolver) AdminAddFriends(ctx context.Context, input AdminAddFriendsInput) (*AdminAddFriendsResponse, error) {
	err := AdminAddFriends(ctx, input.FriendIDs)
	if err != nil {
		return nil, err
	}

	return &AdminAddFriendsResponse{
		Success: cast.ConvertToNullableBool(true),
	}, nil
}`,
	)
}

func TestFuncThatReturnsMultipleNamedItems(t *testing.T) {
	verifyGeneratedCode(
		t,
		`package graphql

		import "context"
		import "github.com/lolopinto/ent/internal/test_schema/models"
	
// @graphql authUser Mutation
func Auth(ctx context.Context, email, password string) (user *models.User, token string, err error) {
	return nil, "", nil
}`,
		"AuthUser",
		"mutationResolver",
		`func (r *mutationResolver) AuthUser(ctx context.Context, input AuthUserInput) (*AuthUserResponse, error) {
	user, token, err := Auth(ctx, input.Email, input.Password)
	if err != nil {
		return nil, err
	}

	return &AuthUserResponse{
		User: user,
		Token: token,
	}, nil
}`,
		"User",
	)
}

func TestFuncThatReturnsMultipleItemsGraphQLReturn(t *testing.T) {
	verifyGeneratedCode(
		t,
		`package graphql

		import "context"
		import "github.com/lolopinto/ent/internal/test_schema/models"
	
// @graphql authUser Mutation
// @graphqlreturn user
// @graphqlreturn token
func Auth(ctx context.Context, email, password string) (*models.User, string, error) {
	return nil, "", nil
}`,
		"AuthUser",
		"mutationResolver",
		`func (r *mutationResolver) AuthUser(ctx context.Context, input AuthUserInput) (*AuthUserResponse, error) {
	user, token, err := Auth(ctx, input.Email, input.Password)
	if err != nil {
		return nil, err
	}

	return &AuthUserResponse{
		User: user,
		Token: token,
	}, nil
}`,
		"User",
	)
}

func TestFuncThatReturnsNonNullItem(t *testing.T) {
	verifyGeneratedCode(
		t,
		`package graphql

		import "context"
		import "github.com/lolopinto/ent/internal/test_schema/models"
	
// @graphql authUser Mutation
// @graphqlreturn user @required
func Auth(ctx context.Context, email, password string) (*models.User, error) {
	return &models.User{}, nil
}`,
		"AuthUser",
		"mutationResolver",
		`func (r *mutationResolver) AuthUser(ctx context.Context, input AuthUserInput) (*AuthUserResponse, error) {
	user, err := Auth(ctx, input.Email, input.Password)
	if err != nil {
		return nil, err
	}

	return &AuthUserResponse{
		User: user,
	}, nil
}`,
		"User",
	)
}

func verifyGeneratedCode(t *testing.T, userCode, fnName, receiverName, expectedGeneratedFnCode string, nodes ...string) {
	absPath, err := filepath.Abs(".")
	if err != nil {
		t.Fatal(err)
	}
	dirPath, err := ioutil.TempDir(absPath, "test")
	if err != nil {
		t.Fatal(err)
	}
	packageDir := filepath.Join(dirPath, "graphql")
	err = os.MkdirAll(packageDir, 0755)
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dirPath)

	parse(t, userCode, dirPath, packageDir, nodes)

	pkg := schemaparser.LoadPackage(
		&schemaparser.ConfigSchemaParser{
			AbsRootPath: packageDir,
		},
	)
	var file *ast.File
	for idx, filename := range pkg.GoFiles {
		if strings.HasSuffix(filename, "resolver.go") {
			file = pkg.Syntax[idx]
			break
		}
	}
	assert.NotNil(t, file)

	// find function
	var userFn *ast.FuncDecl
	ast.Inspect(file, func(node ast.Node) bool {
		if fn, ok := node.(*ast.FuncDecl); ok {
			if fn.Name.Name == fnName && fn.Recv != nil {
				fTypeInfo := astparser.GetFieldTypeInfo(fn.Recv.List[0])
				if fTypeInfo.Name == receiverName {
					userFn = fn
					return false
				}
			}
		}
		return true
	})

	assert.NotNil(t, userFn)

	// confirm that generated code is same as expected code
	var buffer bytes.Buffer
	printer.Fprint(&buffer, pkg.Fset, userFn)

	expFormattedCode, err := format.Source([]byte(expectedGeneratedFnCode))
	if err != nil {
		t.Fatal(err)
	}
	formattedCode, err := format.Source(buffer.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, string(expFormattedCode), string(formattedCode))
}

func parse(t *testing.T, code, dirPath, packagePath string, nodes []string) {
	// because we're going to read and parse the generated code, write the code to code.go instead of using overlays
	err := ioutil.WriteFile(
		filepath.Join(packagePath, "code.go"),
		[]byte(strings.TrimSpace(code)),
		0666,
	)

	if err != nil {
		t.Fatal(err)
	}

	basePath := filepath.Base(dirPath)

	s := newGraphQLSchema(&codegen.Data{
		CodePath: codegen.NewCodePath(
			"models/configs",
			"github.com/lolopinto/ent/internal/graphql/"+basePath+"/graphql",
		),
		Schema: &schema.Schema{},
	})
	s.overrideGraphQLFolder(packagePath)

	s.config.Schema.Nodes = make(schema.NodeMapInfo)

	// need to override this because we're using test_schema/models in the examples
	s.config.CodePath.OverrideImportPathToModels(
		"github.com/lolopinto/ent/internal/test_schema/models",
	)

	for _, node := range nodes {
		nodeSnake := strcase.ToSnake(node)
		s.config.Schema.Nodes[node+"Config"] = &schema.NodeDataInfo{
			NodeData: &schema.NodeData{
				NodeInfo:    nodeinfo.GetNodeInfo(nodeSnake),
				PackageName: nodeSnake,
				FieldInfo: &field.FieldInfo{
					NonEntFields: []*field.NonEntField{
						&field.NonEntField{
							FieldName: "id",
							FieldType: &enttype.IDType{},
						},
					},
				},
			},
		}
	}
	s.overrideCustomEntSchemaParser(nil, nil)

	s.overrideTopLevelEntSchemaParser(
		&schemaparser.ConfigSchemaParser{
			AbsRootPath:   packagePath,
			FilesToIgnore: []string{"generated.go"},
		},
		&customTopLevelParser{},
	)
	s.disableServerPlugin()
	s.runSpecificSteps([]gqlStep{
		"schema",
		"custom_functions",
		"schema.graphql",
		"generate_code",
	})

	result := s.customEntResult
	assert.Nil(t, result.Error)
	assert.Nil(t, result.Functions)
	assert.Len(t, result.Objects, 0)

	result = s.topLevelResult
	assert.Nil(t, result.Error)
	assert.NotNil(t, result.Functions)
	assert.Len(t, result.Objects, 0)
}
