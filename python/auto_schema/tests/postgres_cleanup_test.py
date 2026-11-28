import os

import pytest
import sqlalchemy as sa

from . import conftest


@pytest.fixture
def admin(monkeypatch):
    url = sa.engine.make_url(os.getenv("DB_CONNECTION_STRING", "postgresql://localhost"))
    url = url.set(database="postgres")
    monkeypatch.setenv("DB_CONNECTION_STRING", url.render_as_string(hide_password=False))
    engine = sa.create_engine(url, isolation_level="AUTOCOMMIT")
    with engine.connect() as connection:
        yield connection
    engine.dispose()


def oid(admin, name):
    return admin.execute(sa.text("SELECT oid FROM pg_database WHERE datname = :name"),
                         {"name": name}).scalar_one_or_none()


@pytest.fixture
def helpers(admin):
    created = []

    def make():
        helper = conftest.Postgres()
        created.append(helper)
        return helper

    yield make
    for helper in created:
        try:
            helper.get_finalizer()()
        except ExceptionGroup:
            pass
        # Failure-injection cases may intentionally block the first cleanup.
        # Even test recovery must check the successfully created identity.
        for name, expected_oid in helper._dbs.items():
            if oid(admin, name) == expected_oid:
                admin.exec_driver_sql(f'DROP DATABASE {helper._identifier(name)} WITH (FORCE)')


def test_finalizer_before_setup_and_repeated_cleanup(admin, helpers):
    helpers().get_finalizer()()
    helper = helpers()
    helper.create_connection("unused")
    helper.get_finalizer()()
    helper.get_finalizer()()
    assert oid(admin, helper._randomDB) is None


def test_lingering_session_only_terminates_owned_database(admin, helpers):
    sentinel = helpers().create_connection("unused")
    sentinel.connection.execute(sa.text("CREATE TABLE sentinel (value text)"))
    sentinel.connection.execute(sa.text("INSERT INTO sentinel VALUES ('keep')"))
    helper = helpers()
    info = helper.create_connection("unused")
    other_engine = sa.create_engine(info.url)
    other = other_engine.connect()
    try:
        helper.get_finalizer()()
        assert oid(admin, helper._randomDB) is None
        assert sentinel.connection.execute(sa.text("SELECT value FROM sentinel")).scalar_one() == "keep"
    finally:
        other.close()
        other_engine.dispose()


def test_failed_drop_still_cleans_other_databases_and_admin(admin, helpers, monkeypatch):
    helper = helpers()
    helper.create_connection("unused")
    second = helper.create_new_database("unused")
    second_name = sa.engine.make_url(second.url).database
    drop = helper._drop_database

    def fail_first(name, database_oid):
        if name == helper._randomDB:
            raise RuntimeError("injected drop failure")
        drop(name, database_oid)

    monkeypatch.setattr(helper, "_drop_database", fail_first)
    with pytest.raises(ExceptionGroup, match="Test database cleanup failed") as failure:
        helper.get_finalizer()()
    assert "injected drop failure" in str(failure.value.exceptions[0])
    assert oid(admin, second_name) is None
    assert helper._globalConnection.closed
    assert helper._globalEngine.pool.checkedout() == 0


def test_create_collision_preserves_database_and_connection(admin, helpers, monkeypatch):
    sentinel = helpers()
    info = sentinel.create_connection("unused")
    expected_oid = oid(admin, sentinel._randomDB)
    monkeypatch.setattr(conftest, "randomDB", lambda: sentinel._randomDB)
    collision = helpers()
    with pytest.raises(sa.exc.ProgrammingError):
        collision.create_connection("unused")
    collision.get_finalizer()()
    assert collision._dbs == {}
    assert oid(admin, sentinel._randomDB) == expected_oid
    assert info.connection.execute(sa.text("SELECT 42")).scalar_one() == 42


def test_new_database_collision_does_not_claim_existing_database(admin, helpers, monkeypatch):
    sentinel = helpers()
    sentinel_info = sentinel.create_connection("unused")
    helper = helpers()
    helper.create_connection("unused")
    monkeypatch.setattr(conftest, "randomDB", lambda: sentinel._randomDB)
    with pytest.raises(sa.exc.ProgrammingError):
        helper.create_new_database("unused")
    assert sentinel._randomDB not in helper._dbs
    assert oid(admin, helper._randomDB) is None
    assert sentinel_info.connection.execute(sa.text("SELECT 42")).scalar_one() == 42


def test_partial_setup_failure_cleans_database_and_preserves_error(admin, helpers, monkeypatch):
    helper = helpers()
    failure = RuntimeError("injected connection failure")

    def fail(*args):
        raise failure

    monkeypatch.setattr(helper, "_conn_info_for_engine", fail)
    with pytest.raises(RuntimeError) as caught:
        helper.create_connection("unused")
    assert caught.value is failure
    assert oid(admin, helper._randomDB) is None
    assert helper._globalConnection.closed
    helper.get_finalizer()()


def test_replaced_database_is_not_dropped(admin, helpers, monkeypatch):
    original = helpers()
    info = original.create_connection("unused")
    original_oid = oid(admin, original._randomDB)
    info.connection.invalidate()
    admin.exec_driver_sql(f'DROP DATABASE {original._identifier(original._randomDB)}')
    monkeypatch.setattr(conftest, "randomDB", lambda: original._randomDB)
    replacement = helpers()
    replacement_info = replacement.create_connection("unused")
    assert oid(admin, replacement._randomDB) != original_oid
    # The old engine can reconnect to the new database under the same name.
    # Refusing a drop must also preserve these replacement sessions.
    assert info.connection.execute(sa.text("SELECT 42")).scalar_one() == 42
    try:
        with pytest.raises(ExceptionGroup) as failure:
            original.get_finalizer()()
        assert "Refusing to clean up replaced" in str(failure.value.exceptions[0])
        assert replacement_info.connection.execute(sa.text("SELECT 42")).scalar_one() == 42
        assert info.connection.execute(sa.text("SELECT 42")).scalar_one() == 42
    finally:
        info.connection.close()
        info.engine.dispose()


def test_connection_close_failure_still_drops_database(admin, helpers, monkeypatch):
    helper = helpers()
    info = helper.create_connection("unused")
    close = info.connection.close

    def fail():
        raise RuntimeError("injected connection close failure")

    monkeypatch.setattr(info.connection, "close", fail)
    try:
        with pytest.raises(ExceptionGroup):
            helper.get_finalizer()()
        assert oid(admin, helper._randomDB) is None
        assert helper._globalConnection.closed
    finally:
        close()
