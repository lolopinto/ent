from enum import Enum


# subclass of str for enum encoding
# NOTE: these need to be in sync with golang internal/schema/change.go
class ChangeType(str, Enum):
    ADD_TABLE = "add_table"
    DROP_TABLE = "drop_table"
    ADD_COLUMN = "add_column"
    DROP_COLUMN = "drop_column"
    CREATE_INDEX = "create_index"
    DROP_INDEX = "drop_index"
    # TODO update go?
    CREATE_FULL_TEXT_INDEX = "create_full_text_index"
    DROP_FULL_TEXT_INDEX = "drop_full_text_index"
    CREATE_FOREIGN_KEY = "create_foreign_key"
    ALTER_COLUMN = "alter_column"
    CREATE_UNIQUE_CONSTRAINT = "create_unique_constraint"
    ADD_EDGES = "add_edges"
    REMOVE_EDGES = "remove_edges"
    MODIFY_EDGE = "modify_edge"
    ADD_ROWS = "add_rows"
    REMOVE_ROWS = "remove_rows"
    MODIFY_ROWS = "modify_rows"
    ALTER_ENUM = "alter_enum"
    ADD_ENUM = "add_enum"
    DROP_ENUM = "drop_enum"
    CREATE_CHECK_CONSTRAINT = "create_check_constraint"
    DROP_CHECK_CONSTRAINT = "drop_check_constraint"
