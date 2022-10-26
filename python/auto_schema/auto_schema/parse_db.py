import sqlalchemy as sa
import json
import json
import re
from sqlalchemy.dialects import postgresql
import inflect
from enum import Enum
from auto_schema.introspection import get_sorted_enum_values, get_raw_db_indexes
from auto_schema.clause_text import get_clause_text

# copied from ts/src/schema/schema.ts


class DBType(str, Enum):
    UUID = "UUID"
    Int64ID = "Int64ID"  # unsupported right now
    Boolean = "Boolean"
    Int = "Int"
    BigInt = "BigInt"
    Float = "Float"
    String = "String"

    Timestamp = "Timestamp"
    Timestamptz = "Timestamptz"
    JSON = "JSON"  # JSON type in the database
    JSONB = "JSONB"  # JSONB type in the database Postgres
    Enum = "Enum"  # enum type in the database
    StringEnum = "StringEnum"  # string type in the database
    IntEnum = "IntEnum"  # int type in the database

    Date = "Date"
    Time = "Time"
    Timetz = "Timetz"

    List = "List"


class ConstraintType(str, Enum):
    PrimaryKey = "primary"
    ForeignKey = "foreign"
    Unique = "unique"
    Check = "check"


sqltext_regex = re.compile('to_tsvector\((.+?), (.+)\)')


class ParseDB(object):

    def __init__(self, engine):
        engine = sa.create_engine(engine)
        self.connection = engine.connect()
        self.metadata = sa.MetaData()
        self.metadata.bind = self.connection
        self.metadata.reflect()

    def parse(self):
        assoc_edge_config = [
            table for table in self.metadata.sorted_tables if table.name == 'assoc_edge_config']
        existing_edges = {}

        if assoc_edge_config:
            for row in self.connection.execute('select * from assoc_edge_config'):
                edge = dict(row)
                existing_edges[edge['edge_table']] = edge

        for table in self.metadata.sorted_tables:
            # TODO handle these later
            if table.name == 'alembic_version' or existing_edges.get(table.name) is not None or table.name == "assoc_edge_config":
                continue

            if table.name != 'holidays':
                continue

            print(table.name)
            self._parse_table(table)

    def _parse_table(self, table: sa.Table):
        node = {}
        col_indices = {}
        # parse indices before columns and get
        indices = self._parse_indices(table, col_indices)
        node["fields"] = self._parse_columns(table, col_indices)
        node["constraints"] = self._parse_constraints(table)
        node["indices"] = indices

        print(json.dumps(node))

    def _parse_columns(self, table: sa.Table, col_indices: dict):
        # TODO handle column foreign key so we don't handle them in constraints below...
        fields = {}
        for col in table.columns:
            # we don't return computed fields
            if col.computed:
                continue

            field = {}
            field['storageKey'] = col.name
            if col.primary_key:
                field['primaryKey'] = True

            if isinstance(col.type, postgresql.ARRAY):
                field['type'] = {
                    "dbType": DBType.List,
                    "listElemType": self._parse_column_type(col.type.item_type),
                }
            else:
                field["type"] = self._parse_column_type(col.type)

            if col.nullable:
                field["nullable"] = True
            if col.name in col_indices or col.index:
                field["index"] = True
            if col.unique:
                field["unique"] = True

            fkey = self._parse_foreign_key(col)
            if fkey is not None:
                field["foreignKey"] = fkey

            server_default = get_clause_text(col.server_default, col.type)
            if server_default is not None:
                field["serverDefault"] = server_default

            # TODO foreign key, server default
            if len(col.constraints) != 0:
                raise Exception(
                    "column %s in table %s has more than one constraint which is not supported" % (col.name, table.name))

            if col.default:
                raise Exception(
                    "column %s in table %s has default which is not supported" % (col.name, table.name))

            if col.onupdate:
                raise Exception(
                    "column %s in table %s has onupdate which is not supported" % (col.name, table.name))

            # if col.key:
                # print(col.key)
                # raise Exception(
                #     "column %s in table %s has key which is not supported" % (col.name, table.name))

                # ignoring comment
            fields[col.name] = field

        return fields

    def _parse_column_type(self, col_type):
        if isinstance(col_type, sa.TIMESTAMP):
            if col_type.timezone:
                return {
                    "dbType": DBType.Timestamptz
                }
            return {
                "dbType": DBType.Timestamp
            }

        if isinstance(col_type, sa.Time):
            if col_type.timezone:
                return {
                    "dbType": DBType.Timetz
                }
            return {
                "dbType": DBType.Time
            }

        if isinstance(col_type, sa.Date):
            return {
                "dbType": DBType.Date
            }

        # ignoring precision for now
        # TODO
        if isinstance(col_type, sa.Numeric):
            return {
                "dbType": DBType.Float
            }

        if isinstance(col_type, postgresql.ENUM):
            db_sorted_enums = get_sorted_enum_values(
                self.connection, col_type.name)

            return {
                "dbType": DBType.Enum,
                "values": db_sorted_enums
            }

        if isinstance(col_type, postgresql.JSONB):
            return {
                "dbType": DBType.JSONB
            }
        if isinstance(col_type, postgresql.JSON):
            return {
                "dbType": DBType.JSON
            }

        if isinstance(col_type, postgresql.UUID):
            return {
                "dbType": DBType.UUID
            }

        if isinstance(col_type, sa.String):
            return {
                "dbType": DBType.String
            }

        if isinstance(col_type, sa.Boolean):
            return {
                "dbType": DBType.Boolean
            }

        if isinstance(col_type, sa.Integer):
            return {
                "dbType": DBType.Int
            }

        if isinstance(col_type, sa.BigInteger):
            return {
                "dbType": DBType.BigInt
            }

        raise Exception("unsupported type %s" % str(col_type))

    def _parse_foreign_key(self, col: sa.Column):
        if len(col.foreign_keys) > 1:
            raise Exception(
                "don't currently support multiple foreign keys in a column ")

        for fkey in col.foreign_keys:
            return {
                "schema": self._table_to_node(fkey.column.table.name),
                "column": fkey.column.name,
            }

        return None

    def _table_to_node(self, table_name) -> str:
        p = inflect.engine()
        return "".join([t.title()
                        for t in p.singular_noun(table_name).split("_")])

    def _parse_constraints(self, table: sa.Table):
        constraints = []
        for constraint in table.constraints:
            constraint_type = None
            if isinstance(constraint, sa.CheckConstraint):
                constraint_type = ConstraintType.Check
            if isinstance(constraint, sa.UniqueConstraint):
                constraint_type = ConstraintType.Unique
            if isinstance(constraint, sa.ForeignKeyConstraint):
                constraint_type = ConstraintType.ForeignKey
            if isinstance(constraint, sa.PrimaryKeyConstraint):
                constraint_type = ConstraintType.PrimaryKey

            if not constraint_type:
                raise Exception("invalid constraint_type %s" % str(constraint))

            # TODO there's duplicate logic here btw this and column. primaryKey/foreignKey
            # which one is better/preferred???
            constraints.append({
                "name": constraint.name,
                "type": constraint_type,
                "columns": [col.name for col in constraint.columns],
            })
        return constraints

    # same logic as internal/db/db_schema.go
    def _default_index(self, table: sa.Table, col_name: str):
        col = table.columns[col_name]
        if isinstance(col.type, postgresql.JSONB) or isinstance(col.type, postgresql.JSON) or isinstance(col.type, postgresql.ARRAY):
            return 'gin'
        return 'btree'

    def _parse_indices(self, table: sa.Table, col_indices: dict):
        indices = []

        col_names = set([col.name for col in table.columns])
        generated_columns = self._parse_generated_columns(table, col_names)

        raw_db_indexes = get_raw_db_indexes(self.connection, table)
        all_conn_indexes = raw_db_indexes.get('all')

        seen = {}
        for name, info in all_conn_indexes.items():
            seen[name] = True
            internals = info.get("postgresql_using_internals")
            internals = internals.strip().lstrip("(").rstrip(")")
            index_type = info.get("postgresql_using")

            # nothing to do here. index on a column.
            if internals in col_names and self._default_index(table, internals) == index_type:
                col_indices[internals] = True
                continue

            generated_col_info = generated_columns.get(internals, None)

            # TODO handle non-generated col...
            if generated_col_info is None:
                raise Exception("unsupported index %s in table %s" %
                                (name, table.name))

            idx = {
                "name": name,
                "columns": generated_col_info.get("columns"),
                "fulltext": {
                    "language": generated_col_info.get("language"),
                    "indexType": index_type,
                    "generatedColumnName": internals,
                }
            }
            indices.append(idx)

        for index in table.indexes:
            if seen[index.name]:
                continue

            idx = {
                "name": index.name,
                "unique": index.unique,
                "columns": [col.name for col in index.columns],
            }
            indices.append(idx)

        return indices

    def _parse_generated_columns(self, table: sa.Table, col_names: set):
        generated = {}
        for col in table.columns:
            def unsupported_col(sqltext):
                raise Exception("unsupported sqltext %s for col %s in table %s" % (
                    sqltext, col.name, table.name))

            if not col.computed:
                continue

            if not isinstance(col.type, postgresql.TSVECTOR):
                raise Exception(
                    "unsupported computed type %s which isn't a tsvector" % str(col.type))

            # computed...
            sqltext = str(col.computed.sqltext)
            m = sqltext_regex.match(sqltext)
            if not m:
                unsupported_col(sqltext)

            groups = m.groups()
            lang = groups[0].rstrip("::regconfig").strip("'")

            # TODO handle setweight if it exists...
            # TODO eventually support examples with no COALESCE e.g. if you're sure not nullable

            val = groups[1]
            starts = [m.start() for m in re.finditer('COALESCE', groups[1])]
            cols = []
            for i in range(len(starts)):

                if i + 1 == len(starts):
                    curr = val[starts[i]: len(val)-1]
                else:
                    curr = val[starts[i]: starts[i+1]-1]

                parts = curr.rstrip(' ||').split(' || ')
                if len(parts) > 2:
                    unsupported_col(sqltext)

                # we added a space to concatenate. that's ok
                # if something else was added to concatenate, currently unsupported
                if len(parts) == 2 and parts[1] != "' '::text)":
                    unsupported_col(sqltext)

                curr = parts[0]

                # COALESCE(last_name, ''::text)
                # go from "COALESCE" to try and get the
                text_parts = curr[8:].lstrip("(").rstrip(")").split(",")
                if len(text_parts) > 2:
                    unsupported_col(sqltext)

                # we concatenate '' incase it's nullable, strip that part
                if len(text_parts) == 2 and text_parts[1].lstrip() != "''::text":
                    unsupported_col(sqltext)

                if text_parts[0] in col_names:
                    cols.append(text_parts[0])
                else:
                    raise Exception(
                        "unknown col %s in sqltext %s for generated col %s", (text_parts[0], sqltext, col.name))

            generated[col.name] = {
                "language": lang,
                "columns": cols,
            }
        return generated
