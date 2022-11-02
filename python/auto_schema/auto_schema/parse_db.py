from cgi import test
import sqlalchemy as sa
import json
import re
from sqlalchemy.dialects import postgresql
import inflect
from enum import Enum
from auto_schema.introspection import get_sorted_enum_values, get_raw_db_indexes, default_index
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


sqltext_regex = re.compile(r"to_tsvector\((.+?), (.+)\)")
edge_name_regex = re.compile('(.+?)To(.+)Edge')


class ParseDB(object):

    def __init__(self, engine_conn):
        if isinstance(engine_conn, sa.engine.Connection):
            self.connection = engine_conn
        else:
            engine = sa.create_engine(engine_conn)
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
                edge_table = edge['edge_table']
                edges = existing_edges.get(edge_table, [])
                edges.append(edge)
                existing_edges[edge_table] = edges

        nodes = {}
        for table in self.metadata.sorted_tables:
            if table.name == 'alembic_version' or existing_edges.get(table.name) is not None or table.name == "assoc_edge_config":
                continue

            # if table.name != 'accounts':
            #     continue

            # print(table.name)
            node = self._parse_table(table)
            nodes[ParseDB.table_to_node(table.name)] = node

        (unknown_edges, edges_map) = self._parse_edges_info(existing_edges, nodes)

        for (k, v) in edges_map.items():
            node = nodes[k]
            node["edges"] = v

        return nodes

    def parse_and_print(self):
        print(json.dumps(self.parse()))

    def _parse_edges_info(self, existing_edges: dict, nodes: dict):
        unknown_edges = []
        edges_map = {}

        # todo global edge
        for item in existing_edges.items():
            table_name = item[0]
            edges = item[1]
            if len(edges) == 1:
                self._handle_single_edge_in_table(
                    edges[0], nodes, edges_map, unknown_edges)
            else:
                self._handle_multi_edges_in_table(
                    edges, nodes, edges_map, unknown_edges)

        return (unknown_edges, edges_map)

    def _parse_edge_name(self, edge: dict):
        m = edge_name_regex.match(edge['edge_name'])
        if m is None:
            return None
        return m.groups()

    def _handle_single_edge_in_table(self, edge, nodes, edges_map, unknown_edges):
        t = self._parse_edge_name(edge)
        # unknown edges
        if t is None or nodes.get(t[0], None) is None:
            print("unknown edge", edge, '\n')
            unknown_edges.append(edge)
            return

        if edge["symmetric_edge"]:
            # symmetric
            node_edges = edges_map.get(t[0], [])
            node_edges.append({
                "name": t[1],
                "schemaName": t[0],
                "symmetric": True,
            })
            edges_map[t[0]] = node_edges
        else:

            res = self.connection.execute(
                'select id2_type, count(id2_type) from %s group by id2_type' % (edge["edge_table"])).fetchall()

            if len(res) != 1:
                print("unknown edge can't determine schemaName", edge, '\n')
                unknown_edges.append(edge)
                return

            toNode = res[0][0].title()
            if nodes.get(toNode, None) is None:
                print(
                    "unknown edge can't determine schemaName because toNode is unknown", edge, toNode, '\n')
                unknown_edges.append(edge)
                return

            node_edges = edges_map.get(t[0], [])
            node_edges.append({
                "name": t[1],
                "schemaName": toNode,
            })
            edges_map[t[0]] = node_edges

    def _handle_multi_edges_in_table(self, edges, nodes, edges_map, unknown_edges):
        edge_types = {}
        for edge in edges:
            edge_types[str(edge['edge_type'])] = edge

        seen = {}
        for edge in edges:
            edge_type = str(edge["edge_type"])
            if seen.get(edge_type, False):
                continue

            seen[edge_type] = True

            # assoc edge group??
            if edge["symmetric_edge"] or edge['inverse_edge_type'] is None:
                self._handle_single_edge_in_table(
                    edge, nodes, edges_map, unknown_edges)
                continue

            # for inverse edges, we don't know which schema should be the source of truth
            # so it ends up being randomly placed in one or the other

            inverse_edge_type = str(edge['inverse_edge_type'])
            if inverse_edge_type not in edge_types:
                print('unknown inverse edge', inverse_edge_type)
                unknown_edges.append(edge)
                continue

            inverse_edge = edge_types[inverse_edge_type]
            seen[inverse_edge_type] = True

            t1 = self._parse_edge_name(edge)
            t2 = self._parse_edge_name(inverse_edge)

            # pattern or polymorphic edge...
            if t1 is None or t2 is None or nodes.get(t1[0], None) is None or nodes.get(t2[0], None) is None:
                print("unknown edge or inverse edge", edge, inverse_edge, "\n")

                unknown_edges.append(edge)
                unknown_edges.append(inverse_edge)
                continue

            node = t1[0]
            inverseNode = t2[0]

            node_edges = edges_map.get(node, [])
            node_edges.append({
                "name": t1[1],
                "schemaName": inverseNode,
                "inverseEdge": {
                    "name": t2[1]
                },
            })
            edges_map[node] = node_edges

    def _parse_table(self, table: sa.Table):
        node = {}
        col_indices = {}
        col_unique = {}
        # parse indices and constraints before columns and get col specific data
        indices = self._parse_indices(table, col_indices)
        constraints = self._parse_constraints(table, col_unique)
        node["fields"] = self._parse_columns(table, col_indices, col_unique)
        node["constraints"] = constraints
        node["indices"] = indices

        return node

    def _parse_columns(self, table: sa.Table, col_indices: dict, col_unique: dict):
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
            if col.name in col_unique or col.unique:
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

    # keep this in sync with testingutils._validate_parsed_data_type
    def _parse_column_type(self, col_type):
        if isinstance(col_type, sa.TIMESTAMP):
            # sqlite doesn't support timestamp with timezone
            dialect = self.connection.dialect.name
            if col_type.timezone and dialect != 'sqlite':
                return {
                    "dbType": DBType.Timestamptz
                }
            return {
                "dbType": DBType.Timestamp
            }

        if isinstance(col_type, sa.Time):
            # sqlite doesn't support with timezone
            dialect = self.connection.dialect.name
            if col_type.timezone and dialect != 'sqlite':
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
            if isinstance(col_type, sa.BigInteger) or col_type.__visit_name__ == 'big_integer' or col_type.__visit_name__ == 'BIGINT':
                return {
                    "dbType": DBType.BigInt
                }
            return {
                "dbType": DBType.Int
            }

        raise Exception("unsupported type %s" % str(col_type))

    def _parse_foreign_key(self, col: sa.Column):
        if len(col.foreign_keys) > 1:
            raise Exception(
                "don't currently support multiple foreign keys in a column ")

        for fkey in col.foreign_keys:
            return {
                "schema": ParseDB.table_to_node(fkey.column.table.name),
                "column": fkey.column.name,
            }

        return None

    @ classmethod
    def _singular(cls, table_name) -> str:
        p = inflect.engine()
        ret = p.singular_noun(table_name)
        # TODO address this for not-tests
        # what should the node be called??
        # how does this affect GraphQL/TypeScript names etc?
        if ret is False:
            return table_name
        return ret

    @ classmethod
    def table_to_node(cls, table_name) -> str:
        return "".join([t.title()
                        for t in cls._singular(table_name).split("_")])

    def _parse_constraints(self, table: sa.Table, col_unique: dict):
        constraints = []
        for constraint in table.constraints:
            constraint_type = None
            condition = None
            single_col = None
            if len(constraint.columns) == 1:
                single_col = constraint.columns[0]

            if isinstance(constraint, sa.CheckConstraint):
                constraint_type = ConstraintType.Check
                condition = constraint.sqltext

            if isinstance(constraint, sa.UniqueConstraint):
                if single_col is not None:
                    col_unique[single_col.name] = True
                    continue
                constraint_type = ConstraintType.Unique

            if isinstance(constraint, sa.ForeignKeyConstraint):
                if single_col is not None:
                    if len(single_col.foreign_keys) == 1:
                        # handled at the column level
                        continue
                constraint_type = ConstraintType.ForeignKey

            if isinstance(constraint, sa.PrimaryKeyConstraint):
                if single_col is not None and single_col.primary_key:
                    continue
                constraint_type = ConstraintType.PrimaryKey

            if not constraint_type:
                raise Exception("invalid constraint_type %s" % str(constraint))

            # TODO there's duplicate logic here btw this and column. primaryKey/foreignKey
            # which one is better/preferred???
            constraints.append({
                "name": constraint.name,
                "type": constraint_type,
                "columns": [col.name for col in constraint.columns],
                'condition': condition,
            })
        return constraints

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
            internals = internals.strip()
            if internals.startswith("("):
                internals = internals[1:]
            if internals.endswith(")"):
                internals = internals[:-1]

            index_type = info.get("postgresql_using")

            generated_col_info = generated_columns.get(internals, None)

            # nothing to do here. index on a column.
            if internals in col_names and default_index(table, internals) == index_type:
                print('col indices, false')
                col_indices[internals] = True
                continue

            # col index with different type
            # if internals in col_names and index_type is not None:
            #     print('col index, diff type', generated_col_info)
            #     indices.append({
            #         "name": name,
            #         "columns": [internals],
            #         "indexType": index_type,
            #     })
            #     continue

            # print(generated_col_info)

            if generated_col_info is not None:
                # print('generated col', generated_col_info)
                idx = {
                    "name": name,
                    "columns": generated_col_info.get("columns"),
                    "fulltext": {
                        "language": generated_col_info.get("language"),
                        "indexType": index_type,
                        "generatedColumnName": internals,
                    }
                }
                if generated_col_info.get('weights', None) is not None:
                    idx['fulltext']['weights'] = generated_col_info['weights']

                indices.append(idx)
                continue

            if internals in col_names and index_type is not None:
                # print('col index, diff type', generated_col_info)
                indices.append({
                    "name": name,
                    "columns": [internals],
                    "indexType": index_type,
                })
                continue

            internals_parsed = self._parse_postgres_using_internals(
                internals, index_type, col_names)

            if internals_parsed.get('fulltext', None):
                indices.append({
                    'columns': internals_parsed['columns'],
                    'fulltext': internals_parsed['fulltext'],
                    'name': name,
                })
                continue

            # TODO we can actually punt this to regular indexes below...
            # difference is index_type here vs below...
            if internals_parsed.get('columns', None):
                indices.append({
                    "name": name,
                    "columns": internals_parsed.get('columns'),
                    "indexType": index_type,
                })
                continue

            raise Exception("unsupported index %s in table %s" %
                            (name, table.name))

        for index in table.indexes:
            if seen.get(index.name, False):
                continue

            # we don't get raw sqlite cols above so need this for sqlite...
            single_col = None
            if len(index.columns) == 1:
                single_col = index.columns[0]
                index_type = index.kwargs.get('postgresql_using')
                default_index_type = default_index(table, single_col.name)

                if (index_type == False and default_index_type == 'btree') or default_index(table, single_col.name) == index_type:
                    col_indices[single_col.name] = True
                    continue

            indices.append({
                "name": index.name,
                "unique": index.unique,
                "columns": [col.name for col in index.columns],
            })

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
            # wrap in () if not wrapped. needed for parsing logic to be consistent
            if not sqltext.startswith("("):
                sqltext = "(%s)" % sqltext

            # all this logic with no coalesce is what we want i think...
            # print('sqltext - m', sqltext, m)
            # TODO handle setweight here....
            # this logic is broken. no setweight in it...
            res = self._parse_str_into_parts(sqltext)
            if len(res) != 1:
                raise Exception('parsed incorrect')

            cols = []
            lang = ''
            weights = {}

            for child in res[0].children:
                text = sqltext[child.beg_cursor:child.end].strip().strip(
                    '||').lstrip('(').strip()
                print('text', text)

                weight = None
                if text.startswith('setweight'):
                    print('has setweight')
                    idx = text.rfind(',')
                    weight = text[idx +
                                  1:].rstrip(')').rstrip('::"char').replace("'", "").strip()

                    text = child.str[1:idx]

                # print(child, child.children,
                #       child.str, child.beg_paren, child.end, child.beg_cursor, sqltext[child.beg_cursor:child.end])

                m = sqltext_regex.match(text)

                if not m:
                    print('text', text)
                    print('sqltext', sqltext)
                    unsupported_col(text)

                groups = m.groups()
                lang = groups[0].rstrip("::regconfig").strip("'")
                # TODO ensure lang is consistent?
                print('lang', lang)

                # TODO handle setweight if it exists...
                # TODO eventually support examples with no COALESCE e.g. if you're sure not nullable

                val = groups[1]
                starts = [m.start()
                          for m in re.finditer('COALESCE', val)]

                # no coalesce...
                if len(starts) == 0:
                    starts = [0]

                for i in range(len(starts)):
                    if i + 1 == len(starts):
                        curr = val[starts[i]: len(val)-1]
                    else:
                        curr = val[starts[i]: starts[i+1]-1]

                    # print('crsdsdsdsdsd', curr, sqltext)
                    print('sfsfsf', curr)
                    cols2 = self._parse_cols_in_generated_col(
                        curr, sqltext, col_names, unsupported_col)
                    cols = cols + cols2
                    cols.sort()

                    if weight is not None:
                        l = weights.get(weight, [])
                        l = l + cols2
                        # l.append(coll)
                        weights[weight] = list(set(l))
                        weights[weight].sort()

            ret = {
                "language": lang,
                "columns": cols,
            }
            if weights:
                ret['weights'] = weights

            generated[col.name] = ret

        return generated

    def _parse_cols_in_generated_col(self, curr: str, sqltext: str, col_names, err_fn):
        cols = []
        for s in curr.strip().split('||'):
            if not s:
                continue
            s = s.strip().strip('(').strip(')')
            if s.startswith('COALESCE'):
                s = s[8:]

            for s2 in s.split(','):
                s2 = s2.strip().strip('(').strip(')')
                if s2 == "''::text" or s2 == "' '::text":
                    continue

                if s2 in col_names:
                    cols.append(s2)

                else:
                    err_fn(sqltext)

        return cols

    def _parse_postgres_using_internals(self, internals: str, index_type: str, col_names):
        # single-col to_tsvector('english'::regconfig, first_name)
        # multi-col to_tsvector('english'::regconfig, ((first_name || ' '::text) || last_name))
        m = sqltext_regex.match(internals)
        if m:
            groups = m.groups()
            lang = groups[0].rstrip("::regconfig").strip("'")

            cols = []
            s = groups[1]
            parts = self._parse_str(s)
            if len(parts) == 0 and groups[1] in col_names:
                cols = [groups[1]]

            for p in parts:
                col = s[p[0]: p[1]].replace(
                    "' '::text", "").strip().strip("||").strip()

                if col in col_names:
                    cols.append(col)
                else:
                    raise Exception('%s not a column' % col)

            if len(cols) > 0:
                return {
                    'columns': cols,
                    'fulltext': {
                        'language': lang,
                        'indexType': index_type,
                    }
                }

        cols = [col.strip() for col in internals.split(',')]
        # multi-column index
        if len(cols) > 1:
            return {
                'columns': cols,
            }

        return {}

    def _parse_str(self, s: str):
        res = []
        left = []
        for i in range(0, len(s)):
            c = s[i]
            if c == '(':
                left.append(i+1)
            if c == ')':
                l = left[-1]
                if l == 1:
                    l = (res[-1][1])+1
                res.append((l, i))
                # remove last
                left = left[:-1]
        return res

    def _parse_str_into_parts(self, s: str):
        res = []
        # left = []
        stack = []
        # don't need depth if we're also going to have a stack
        # depth = 0
        # last = None
        end = -1
        for i in range(0, len(s)):
            c = s[i]
            if c == '(':
                # print('(', len(stack))
                curr = Tree(i, end+1)
                # last = curr

                # how to know when to add another top level
                if len(stack) == 0:
                    res.append(curr)

                if len(stack) > 0:
                    # add as child
                    stack[-1].append(curr)

                stack.append(curr)

                # all.append(curr)
                # depth = depth+1
                # left.append(i+1)
            if c == ')':
                # print(')', len(stack))
                end = i

                curr = stack[-1]
                l = curr.beg_paren

                # first one
                # if curr.pos == 1:

                # l = left[-1]
                # TODO...
                if len(stack) == 1:
                    l = curr.end + 1
                    # l = (res[-1][1])+1

                    # TODO children somehow
                curr.str = s[l:i]
                curr.end = i+1

                stack.pop()
                # res.append(s[l:i])
                # remove last
                # left = left[:-1]

                # depth = depth-1

        return res


class Tree:
    def __init__(self, beg_paren, beg_cursor) -> None:
        self.children = []
        self.str = ''
        self.beg_paren = beg_paren
        self.beg_cursor = beg_cursor
        self.end = -1

    def append(self, child):
        self.children.append(child)

    # def set_str(self, str):
    #     self.str = str

    # def set_end(self, end):
    #     self.end = end
