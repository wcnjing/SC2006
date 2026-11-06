"""Parse repository SQL/PLpgSQL without connecting to or executing against a DB.

Requires optional review tooling pglast==7.14 (PostgreSQL 17 grammar).
Install outside the repository dependencies and add its path to PYTHONPATH.
"""
from pathlib import Path

from pglast import ast, get_postgresql_version, parse_plpgsql, parse_sql

root = Path(__file__).resolve().parents[1]
paths = sorted((root / 'supabase/migrations').glob('*.sql')) + [
    root / 'docs/proposals/p2-save-join.sql',
    root / 'docs/proposals/p2-swipe-discovery.sql',
]
print(f'Static parser only; PostgreSQL grammar {get_postgresql_version()}')
for path in paths:
    source = path.read_text()
    statements = parse_sql(source)
    routines = parse_plpgsql(source)
    plpgsql_bodies = sum('action' in item.get('PLpgSQL_function', {}) for item in routines)
    sql_bodies = 0
    for statement in statements:
        if isinstance(statement.stmt, ast.CreateFunctionStmt):
            options = {option.defname: option.arg for option in statement.stmt.options}
            if options.get('language').sval == 'sql' and 'as' in options:
                parse_sql(options['as'][0].sval)
                sql_bodies += 1
    print(f'{path.relative_to(root)}: {len(statements)} statements, '
          f'{plpgsql_bodies} PL/pgSQL bodies, {sql_bodies} SQL function bodies parsed')
print(f'PASS: {len(paths)} files parsed; no SQL executed, no database connection.')
