"""Two real PostgreSQL sessions; argument is a disposable container created by the shell runner."""
import json
import subprocess
import sys
import time

container = sys.argv[1]
base = ["docker", "exec", "-i", container, "psql", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1"]
def sql(source):
    return subprocess.run(base, input=source, text=True, capture_output=True, check=True).stdout

actors = ["11111111-1111-4111-8111-111111111190", "22222222-2222-4222-8222-222222222290"]
inspection = "33333333-3333-4333-8333-333333333390"
# The container is discarded at exit. No real identities, objects or network service.
sql(f"""
insert into auth.users(id) values('{actors[0]}'),('{actors[1]}');
update public.profiles set role='coordinator' where id in ('{actors[0]}','{actors[1]}');
insert into public.laboratories(id,code,name) values('44444444-4444-4444-8444-444444444490','RACE','Synthetic race');
insert into public.inspections(id,client_id,inspector_id,laboratory_id,inspection_date,summary,workflow_status,completed_at)
values('{inspection}',gen_random_uuid(),'{actors[0]}','44444444-4444-4444-8444-444444444490',current_date,'Race','completed',now());
""")
first = subprocess.Popen(base, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
second = None
try:
    first.stdin.write(f"""set application_name='coordination-first';
begin;
set local role authenticated;
select set_config('request.jwt.claims','{json.dumps({'sub': actors[0]})}',true);
select public.coordinate_inspection(gen_random_uuid(),'{inspection}',1,'approve','First decision');
\\echo LOCKED
""")
    first.stdin.flush()
    while True:
        line = first.stdout.readline()
        if not line:
            raise AssertionError(first.stderr.read())
        if line.strip() == "LOCKED":
            break
    second = subprocess.Popen(base, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    second.stdin.write(f"""set application_name='coordination-second';
set role authenticated;
select set_config('request.jwt.claims','{json.dumps({'sub': actors[1]})}',false);
select public.coordinate_inspection(gen_random_uuid(),'{inspection}',1,'reject','Concurrent reason');
""")
    second.stdin.close()
    deadline = time.monotonic() + 10
    while sql("select count(*) from pg_stat_activity where application_name='coordination-second' and wait_event_type='Lock';").strip() != "1":
        if time.monotonic() >= deadline or second.poll() is not None:
            raise AssertionError("Second coordinator did not wait on the inspection lock")
        time.sleep(0.05)
    first.stdin.write("commit;\n")
    first.stdin.close()
    first.wait(timeout=10)
    second.wait(timeout=10)
    assert first.returncode == 0, first.stderr.read()
    assert second.returncode != 0, "Both obsolete decisions committed"
    assert "VERSION_CONFLICT" in second.stderr.read(), "Expected stale-version conflict after lock release"
    assert sql(f"select review_status||':'||version::text from public.inspections where id='{inspection}';").strip() == "approved:2"
    assert sql(f"select count(*) from public.operation_receipts where entity_id='{inspection}';").strip() == "1", "Failed mutation retained an event"
    print("PASS coordination concurrency: two coordinators serialize; one commit, one VERSION_CONFLICT, one receipt")
finally:
    for process in [first, second]:
        if process and process.poll() is None:
            process.kill()
            process.wait()
