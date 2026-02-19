"""
Enrich existing CAD file records with compliance analysis data extracted from
already-stored APS raw responses. Runs without re-calling the APS API.

Usage:
    docker-compose exec api python /app/scripts/enrich_compliance_data.py
    docker-compose exec api python /app/scripts/enrich_compliance_data.py --file-id <uuid>
"""
import sys, os, json, argparse
sys.path.insert(0, '/app')

from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://cadvisor:cadvisor@postgres:5432/cadvisor")
engine = create_engine(DATABASE_URL)

# Import parser methods directly
from app.services.cad_parser import DXFParser
parser = DXFParser()


def to_dict(val):
    if val is None: return {}
    if isinstance(val, (dict, list)): return val
    try: return json.loads(val)
    except: return {}


def collect_objects_from_raw(aps_raw: dict) -> list:
    """Collect all APS objects from stored raw responses."""
    objects = []
    if not aps_raw or not aps_raw.get('available'):
        return objects
    for resp in aps_raw.get('responses', []):
        if resp.get('api_type') == 'properties':
            coll = resp.get('response', {}).get('data', {}).get('collection', [])
            vname = resp.get('view_name', '')
            vrole = resp.get('view_role', '2d')
            for obj in coll:
                o = dict(obj)
                o.setdefault('view_name', vname)
                o.setdefault('view_role', vrole)
                objects.append(o)
    return objects


def enrich_file(conn, file_id: str, dry_run: bool = False) -> bool:
    row = conn.execute(text(
        "SELECT id, filename, file_metadata FROM files WHERE id = :fid"
    ), {"fid": file_id}).fetchone()
    if not row:
        print(f"  File not found: {file_id}")
        return False

    fid, fname, meta_raw = row
    meta = to_dict(meta_raw)

    # Pull objects from raw responses
    aps_raw  = to_dict(meta.get('aps_raw_responses'))
    objects  = collect_objects_from_raw(aps_raw)

    if not objects:
        # Fall back to stored truncated objects
        objects_meta = to_dict(meta.get('objects'))
        objects = objects_meta.get('objects', []) if isinstance(objects_meta, dict) else []

    if not objects:
        print(f"  [{fname}] No objects available – skipping")
        return False

    print(f"  [{fname}] Analysing {len(objects):,} objects …", end=' ', flush=True)

    compliance = parser._extract_compliance_analysis(objects)

    rooms     = compliance["rooms"]
    fires     = compliance["fire_elements"]
    evac      = compliance["evacuation"]
    texts     = compliance["text_annotations"]
    struct    = compliance["structural_elements"]

    print(f"rooms={len(rooms)} fire={len(fires)} evac={len(evac)} text={len(texts)}")

    if dry_run:
        return True

    # Patch the metadata dict in-place and write back
    meta["rooms"]               = {"count": len(rooms),  "rooms": rooms}
    meta["fire_elements"]       = {"count": len(fires),  "items": fires}
    meta["evacuation"]          = evac
    meta["text_annotations"]    = {"count": len(texts),  "items": texts}
    meta["structural_elements"] = struct

    conn.execute(
        text("UPDATE files SET file_metadata = :meta WHERE id = :fid"),
        {"meta": json.dumps(meta), "fid": str(fid)}
    )
    return True


def main():
    ap = argparse.ArgumentParser(description="Enrich stored files with compliance analysis")
    ap.add_argument("--file-id", help="Single file UUID to process (default: all DWG/DXF files)")
    ap.add_argument("--dry-run", action="store_true", help="Analyse but do not write to DB")
    args = ap.parse_args()

    with engine.begin() as conn:
        if args.file_id:
            file_ids = [args.file_id]
        else:
            rows = conn.execute(text(
                "SELECT id FROM files WHERE filename ~* '\\.(dwg|dxf)$' ORDER BY created_at DESC"
            )).fetchall()
            file_ids = [str(r[0]) for r in rows]

        print(f"Processing {len(file_ids)} file(s)  [dry_run={args.dry_run}]")
        ok = fail = 0
        for fid in file_ids:
            try:
                if enrich_file(conn, fid, dry_run=args.dry_run):
                    ok += 1
                else:
                    fail += 1
            except Exception as e:
                print(f"  ERROR {fid}: {e}")
                import traceback; traceback.print_exc()
                fail += 1

    action = "Would update" if args.dry_run else "Updated"
    print(f"\n{action} {ok} file(s), {fail} skipped/failed.")


if __name__ == "__main__":
    main()
