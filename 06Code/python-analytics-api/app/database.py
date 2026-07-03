import psycopg
from psycopg.rows import dict_row

from .config import get_settings


class Database:
    def __init__(self, database_url: str):
        self.database_url = database_url

    def connect(self):
        if not self.database_url:
            raise RuntimeError("DATABASE_URL is required for analytics database access.")
        return psycopg.connect(self.database_url, row_factory=dict_row)


def get_database() -> Database:
    return Database(get_settings().database_url)
