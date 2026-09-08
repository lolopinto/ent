import pytest

from auto_schema.postgresql_parser import type_name_at_position


@pytest.mark.parametrize('prefix,type_sql,expected', [
    ('SELECT NULL::', 'future_status', ('future_status',)),
    ('SELECT NULL::', 'public.future_status', ('public', 'future_status')),
    ('SELECT NULL::', '"public.future_status"', ('public.future_status',)),
    ('SELECT NULL::', 'public /* middle */ . future_status', ('public', 'future_status')),
    ('SELECT NULL::', 'public. -- middle\n future_status', ('public', 'future_status')),
    ('SELECT NULL::', 'U&"fut\\0075re_status"', ('future_status',)),
    ('SELECT NULL::', 'U&"fut!0075re_status" UESCAPE \'!\'', ('future_status',)),
    ('SELECT NULL::', 'future_status[2][]', ('future_status',)),
    ('SELECT NULL::', '"quo""ted"."名"', ('quo"ted', '名')),
    ("SELECT '三🙂%', NULL::", 'future_status', ('future_status',)),
    ("SELECT E'it\\\'s', NULL::", 'future_status', ('future_status',)),
    ('SELECT NULL::', 'my_database.public.future_status', ('my_database', 'public', 'future_status')),
])
def test_type_name_at_actual_character_position(prefix, type_sql, expected):
    assert type_name_at_position(prefix + type_sql, len(prefix) + 1) == expected


@pytest.mark.parametrize('statement,position', [
    (None, 1), ('SELECT NULL::future_status', None),
    ('SELECT NULL::future_status', 'bad'), ('SELECT NULL::future_status', 0),
    ('SELECT NULL::future_status', 100), ('SELECT NULL::future_status', 1),
    ('SELECT FROM', 8),
])
def test_unknown_or_invalid_position_preserves_original_error(statement, position):
    assert type_name_at_position(statement, position) is None


def test_nondefault_string_lexer_and_error_cleanup():
    prefix = "SELECT 'it\\\'s 三%', NULL::"
    sql = prefix + 'public /* comment */ . future_status'
    assert type_name_at_position(sql, len(prefix) + 1) is None
    assert type_name_at_position(sql, len(prefix) + 1, standard_conforming_strings=False) == ('public', 'future_status')
    # Both native success and error results must be freed, and a rejected parse
    # must not leak lexer settings into subsequent calls.
    assert type_name_at_position(sql, len(prefix) + 1, standard_conforming_strings=False, backslash_quote=False) is None
    assert type_name_at_position('SELECT NULL::future_status', 14) == ('future_status',)
