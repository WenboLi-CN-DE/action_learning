import importlib


def test_database_url_can_be_overridden_for_tests(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")

    import app.database as database

    reloaded = importlib.reload(database)

    assert reloaded.sqlite_url == "sqlite:///:memory:"
    reloaded.create_db_and_tables()
