package cmd

import (
	"fmt"
	"strings"

	"github.com/lolopinto/ent/internal/codegen"
	"github.com/lolopinto/ent/internal/schema/base"
	"github.com/lolopinto/ent/tsent/cmd/generateschema"
	"github.com/spf13/cobra"
)

// generate a schema
var generateSchemaCmd = &cobra.Command{
	Use:   "schema",
	Short: "generate schema",
	Long: `generate the schema by taking the name of the object and a list of fields separated by a space.
Format: schemaName [fieldSpecfication] [fieldSpecification] ...
Each field specification supports 3 formats: 
* fieldName:type e.g. firstName:string
* fieldName:type:booleanProperty e.g. email_address:email:unique
* fieldName
;type;complexFieldProperties e.g. verified;bool;serverDefault:false or accountId;uuid;foreignKey:{schema:Account;column:id};storageKey:user_id;defaultToViewerOnCreate
When using the 3rd format above, the entire field specification should be quoted in strings`,
	Example: `tsent generate schema User name:string email:email
tsent generate schema User phone:phone:index email:email:unique password:password:private:hideFromGraphQL age:int:nullable activated:bool
tsent generate schema User "account_status;string;serverDefault:DEACTIVATED email:email:unique accountId;uuid;foreignKey:{schema:Account;column:id};storageKey:user_id;defaultToViewerOnCreate"`,
	Args: cobra.MinimumNArgs(2),
	RunE: func(_ *cobra.Command, args []string) error {
		schema, err := parseSchema()
		if err != nil {
			return err
		}

		schemaName := base.GetCamelName(args[0])

		if schema.NameExists(schemaName) {
			return fmt.Errorf("cannot generate a schema for since schema with name %s already exists", schemaName)
		}

		cfg, err := codegen.NewConfig("src/schema", "")
		if err != nil {
			return err
		}

		// handle quoted strings because of ";" in command lines
		fields := args[1:]
		// handle something like tsent generate schema Hello "foo;string;serverDefault:bar bar:email:unique accountId;uuid;foreignKey:{schema:User;column:id};storageKey:user_id;defaultToViewerOnCreate"
		if len(args) == 2 {
			i := strings.Index(args[1], ";")
			if i >= 0 {
				fields = strings.Split(args[1], " ")
			}
		}
		return generateschema.ParseAndGenerateSchema(cfg, schemaName, fields)
	},
}
