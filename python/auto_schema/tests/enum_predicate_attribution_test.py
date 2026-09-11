import pytest
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from auto_schema import ops
from . import testingutils
from .runner_test import _assert_no_predicate_views, _enum_partial_index_metadata, _partial_index_metadata, _reflected_predicate


class TestPostgresEnumPredicateAttribution:
    @pytest.mark.parametrize('full_text', [False, True])
    @pytest.mark.parametrize('spelling', [
        'simple', 'qualified', 'commented', 'unicode_escape', 'array', 'unicode_prefix',
        'nonstandard_strings', 'database_qualified',
    ])
    def test_missing_enum_type_is_attributed_and_migrates(self, new_test_runner, full_text, spelling):
        before = _partial_index_metadata('score > 0', full_text=full_text)
        r = new_test_runner(before)
        if spelling == 'nonstandard_strings':
            database = r.get_connection().dialect.identifier_preparer.quote(r.engine.url.database)
            r.get_connection().exec_driver_sql(f'ALTER DATABASE {database} SET standard_conforming_strings = off')
            r.get_connection().exec_driver_sql('SET standard_conforming_strings = off')
            r.get_connection().commit()
        r.run()
        original = _reflected_predicate(r)
        sql_type = {
            'qualified': 'public.future_status',
            'commented': 'public /* component */ . future_status',
            'unicode_escape': 'U&"fut\\0075re_status"',
            'database_qualified': f'{r.engine.url.database}.public.future_status',
        }.get(spelling, 'future_status')
        value = "'active'"
        if spelling == 'array':
            sql_type += '[][]'
            value = "'{active}'"
        predicate = f'score > CASE WHEN {value}::{sql_type} = {value}::{sql_type} THEN 2 ELSE 1 END'
        if spelling == 'unicode_prefix':
            predicate = "status != '三🙂%' AND " + predicate
        elif spelling == 'nonstandard_strings':
            predicate = "status != 'it\\\'s 三%' AND " + predicate
        after = _partial_index_metadata(predicate, full_text=full_text)
        sa.Table('other', after, sa.Column('id', sa.Integer(), primary_key=True),
                 sa.Column('state', postgresql.ENUM('active', name='future_status', create_type=False)))
        r2 = new_test_runner(after, r)
        assert isinstance(r2.compute_changes()[0], ops.AddEnumOp)
        r2.revision()
        assert _reflected_predicate(r2) == original
        assert sa.inspect(r2.engine).get_enums() == []
        _assert_no_predicate_views(r2)
        r2.upgrade()
        updated = _reflected_predicate(r2)
        assert updated != original
        assert r2.compute_changes() == []
        r2.downgrade('-1', delete_files=False)
        assert _reflected_predicate(r2) == original
        assert sa.inspect(r2.engine).get_enums() == []
        restored = new_test_runner(before, r2)
        assert restored.compute_changes() == []
        replay = new_test_runner(after, restored)
        replay.upgrade()
        assert _reflected_predicate(replay) == updated
        assert replay.compute_changes() == []

    @pytest.mark.parametrize('full_text', [False, True])
    @pytest.mark.parametrize('concurrent', [False, True])
    @pytest.mark.parametrize('case', ['wrong_name', 'quoted_dot', 'wrong_schema'])
    def test_unrelated_new_enum_cannot_defer_missing_type(self, new_test_runner, full_text, concurrent, case):
        before = _partial_index_metadata('score > 0', full_text=full_text)
        index = next(iter(before.tables['contacts'].indexes))
        (index.info if full_text else index.kwargs)['postgresql_concurrently'] = concurrent
        r = new_test_runner(before)
        r.get_connection().execute(sa.schema.CreateSchema('unmanaged'))
        r.get_connection().commit()
        r.run()
        original = _reflected_predicate(r)
        identity = r.get_connection().execute(sa.text("SELECT 'contacts_active_idx'::regclass::oid")).scalar_one()
        r.get_connection().commit()
        sql_type = {
            'wrong_name': 'typo_status', 'quoted_dot': '"public.future_status"',
            'wrong_schema': 'unmanaged.future_status',
        }[case]
        after = _partial_index_metadata(
            f"score > CASE WHEN 'active'::{sql_type} = 'active'::{sql_type} THEN 2 ELSE 1 END",
            full_text=full_text,
        )
        index = next(iter(after.tables['contacts'].indexes))
        (index.info if full_text else index.kwargs)['postgresql_concurrently'] = concurrent
        sa.Table('other', after, sa.Column('id', sa.Integer(), primary_key=True),
                 sa.Column('state', postgresql.ENUM(
                     'active', name='future_status', create_type=False,
                     schema='unmanaged' if case == 'wrong_schema' else None,
                 )))
        r2 = new_test_runner(after, r)
        with pytest.raises(sa.exc.ProgrammingError) as error:
            r2.revision()
        assert error.value.orig.pgcode == '42704'
        testingutils.assert_num_files(r2, 1)
        assert _reflected_predicate(r2) == original
        assert r2.get_connection().execute(sa.text("SELECT 'contacts_active_idx'::regclass::oid")).scalar_one() == identity
        assert sa.inspect(r2.engine).get_enums(schema='*') == []
        _assert_no_predicate_views(r2)

    @pytest.mark.parametrize('full_text', [False, True])
    @pytest.mark.parametrize('concurrent', [False, True])
    @pytest.mark.parametrize('case', [
        'unrelated_typo', 'same_label_wrong_type', 'wrong_label_pending_type',
    ])
    def test_invalid_label_rejected_before_revision_changes_database(
        self, new_test_runner, full_text, concurrent, case,
    ):
        def metadata(after):
            contact_values, other_values = ['active'], ['active']
            if after:
                (contact_values if case == 'wrong_label_pending_type' else other_values).append('archived')
            predicate = "status = 'active'"
            if after:
                predicate = "status = 'archived'" if case == 'same_label_wrong_type' else "status = 'typo'"
            result = _enum_partial_index_metadata(contact_values, predicate, full_text)
            table = result.tables['contacts']
            index = next(index for index in table.indexes if index.name == 'contacts_active_idx')
            if full_text:
                index.info['postgresql_concurrently'] = concurrent
            else:
                index.kwargs['postgresql_concurrently'] = concurrent
            sa.Table('other', result, sa.Column('id', sa.Integer(), primary_key=True),
                     sa.Column('state', postgresql.ENUM(*other_values, name='other_state', create_type=False)))
            return result

        before = metadata(False)
        r = new_test_runner(before)
        r.run()
        r.get_connection().execute(before.tables['contacts'].insert(), {
            'id': 1, 'owner_id': 1, 'status': 'active',
        })
        r.get_connection().commit()

        def state(current):
            connection = current.get_connection()
            index = connection.execute(sa.text(
                "SELECT indexrelid, pg_get_indexdef(indexrelid), indisvalid FROM pg_index "
                "WHERE indexrelid = 'contacts_active_idx'::regclass"
            )).one()
            version = connection.execute(sa.text('SELECT version_num FROM alembic_version')).scalar_one()
            rows = connection.execute(sa.text('SELECT id, status::text FROM contacts ORDER BY id')).all()
            enums = {enum['name']: enum['labels'] for enum in sa.inspect(connection).get_enums()}
            connection.commit()
            return index, version, rows, enums

        original = state(r)
        r2 = new_test_runner(metadata(True), r)
        with pytest.raises(sa.exc.DataError, match='invalid input value for enum contact_status'):
            r2.revision()
        testingutils.assert_num_files(r2, 1)
        _assert_no_predicate_views(r2)
        assert state(r2) == original
