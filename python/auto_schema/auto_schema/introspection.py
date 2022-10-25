import sqlalchemy as sa


def get_sorted_enum_values(connection: sa.engine.Connection, enum_type: str):
    # we gotta go to the db and check the order
    db_sorted_enums = []
    # https://www.postgresql.org/docs/9.5/functions-enum.html
    query = "select unnest(enum_range(enum_first(null::%s)));" % (
        enum_type)
    for row in connection.execute(query):
        db_sorted_enums.append(dict(row)['unnest'])

    return db_sorted_enums
