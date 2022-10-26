import sqlalchemy as sa
import json
import json
from sqlalchemy.dialects import postgresql
from enum import Enum
from auto_schema.introspection import get_sorted_enum_values
import inflect
from auto_schema.introspection import get_raw_db_indexes

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

        # print(len(metadata.sorted_tables))
        for table in self.metadata.sorted_tables:
            # TODO handle these later
            if table.name == 'alembic_version' or existing_edges.get(table.name) is not None:
                continue
            # TODO inspect table

            if table.name != 'users':
                continue

            print(table.name)
            self._parse_table(table)

    def _parse_table(self, table: sa.Table):
        node = {}
        node["fields"] = self._parse_columns(table)
        node["constraints"] = self._parse_constraints(table)
        node["indices"] = self._parse_indices(table)

        # print(json.dumps(node))

    def _parse_columns(self, table: sa.Table):
        fields = {}
        for col in table.columns:
            # we don't return computed fields
            if col.computed:
                continue

            field = {}
            field['storageKey'] = col.name
            if col.primary_key:
                field['primaryKey'] = True
            if col.nullable:
                field["nullable"] = True
            if col.index:
                field["index"] = True
            if col.unique:
                field["unique"] = True

            if isinstance(col.type, postgresql.ARRAY):
                field['type'] = {
                    "dbType": DBType.List,
                    "listElemType": self._parse_column_type(col.type.item_type),
                }
            else:
                field["type"] = self._parse_column_type(col.type)

            fkey = self._parse_foreign_key(col)
            if fkey is not None:
                field["foreignKey"] = fkey

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

    def _parse_indices(self, table: sa.Table):
        indices = []

        for col in table.columns:
            if not col.computed:
                continue

            if not isinstance(col.type, postgresql.TSVECTOR):
                raise Exception(
                    "unsupported computed type which isn't a tsvector")

            # computed...
            sqltext = col.computed.sqltext
            print(col, col.computed.sqltext)

        computed = set([col.name for col in table.columns if col.computed])
        print(computed)

        raw_db_indexes = get_raw_db_indexes(self.connection, table)
        all_conn_indexes = raw_db_indexes.get('all')

        seen = {}
        for name, v in all_conn_indexes.items():
            seen[name] = True
            print("missing", name, v)

        for index in table.indexes:
            if seen[index.name]:
                continue

            idx = {
                "name": index.name,
                "unique": index.unique,
                "columns": [col.name for col in index.columns],
            }
            # TODO indices on columns also here
            print("indexxxx", index)
            # indexType, fulltext
            indices.append(idx)

        return indices
