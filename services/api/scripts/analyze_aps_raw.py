"""
Comprehensive APS Raw Data Analyzer
Properties structure: obj['properties'] = {pset_name: {attr_name: value_str}}
"""
import sys, os, json
from collections import defaultdict, Counter

sys.path.insert(0, '/app')
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://cadvisor:cadvisor@postgres:5432/cadvisor")
engine = create_engine(DATABASE_URL)
conn = engine.connect()


def to_dict(val):
    if val is None: return {}
    if isinstance(val, (dict, list)): return val
    try: return json.loads(val)
    except: return {}


print("=" * 80)
print("APS RAW DATA ANALYZER")
print("=" * 80)

row = conn.execute(text("""
    SELECT id, filename, created_at,
           file_metadata->'aps_raw_responses'  AS aps_raw,
           file_metadata->'entities'           AS entities,
           file_metadata->'layers'             AS layers,
           file_metadata->'views'              AS views_data,
           file_metadata->'objects'            AS objects_meta,
           file_metadata->>'extraction_method' AS method
    FROM files WHERE filename ILIKE '%.dwg'
    ORDER BY created_at DESC LIMIT 1
""")).fetchone()

if not row:
    print("No DWG files found"); conn.close(); sys.exit(1)

fid, fname, fcreated, aps_raw_json, ent_json, lay_json, vi_json, om_json, method = row
print(f"\nFile:   {fname}")
print(f"ID:     {fid}")
print(f"Date:   {fcreated}")
print(f"Method: {method or 'unknown'}")

ents    = to_dict(ent_json)
layers  = to_dict(lay_json)
views   = to_dict(vi_json)
om      = to_dict(om_json)
aps_raw = to_dict(aps_raw_json)

# ==========================
# 1. CURRENT PARSED DATA
# ==========================
print("\n" + "=" * 80)
print("1. CURRENT PARSED DATA")
print("=" * 80)

print(f"\n  Entity total: {ents.get('total', 0)}")
et = {k: v for k, v in ents.items() if k != 'total' and isinstance(v, int)}
print(f"  Entity types ({len(et)}) – top 30:")
for k, v in sorted(et.items(), key=lambda x: x[1], reverse=True)[:30]:
    print(f"    {v:6d}x  {k}")

layer_list = layers.get('layers', [])
print(f"\n  Layer definitions: {layers.get('count', 0)}")
for l in layer_list[:30]:
    if isinstance(l, dict):
        print(f"    '{l.get('name','?')}' | color:{l.get('color','?')} | on:{l.get('on','?')} | frozen:{l.get('frozen','?')} | lt:{l.get('linetype','?')}")

print(f"\n  Views: {views.get('count', 0)}")
for v in views.get('views', []):
    print(f"    '{v.get('name')}' ({v.get('role')})")

total_objs = om.get('total_count', 0)
stored     = len(om.get('objects', []))
print(f"\n  Objects: total={total_objs}  stored={stored}{' [TRUNCATED]' if total_objs > stored else ''}")

# ==========================
# 2. LOAD ALL OBJECTS
# ==========================
print("\n" + "=" * 80)
print("2. LOADING ALL OBJECTS FROM APS RAW RESPONSES")
print("=" * 80)

all_objects = []

if aps_raw and aps_raw.get('available'):
    resps       = aps_raw.get('responses', [])
    tree_resps  = [r for r in resps if r.get('api_type') == 'object_tree']
    props_resps = [r for r in resps if r.get('api_type') == 'properties']
    print(f"  Object-tree responses: {len(tree_resps)}")
    print(f"  Properties responses:  {len(props_resps)}")
    for r in props_resps:
        coll = r.get('response', {}).get('data', {}).get('collection', [])
        vname = r.get('view_name', '?')
        print(f"  View '{vname}': {len(coll)} objects")
        for obj in coll:
            obj['_view'] = vname
        all_objects.extend(coll)
else:
    print("  No aps_raw_responses – using stored sample (may be truncated to 500)")
    all_objects = list(om.get('objects', []))

print(f"\n  TOTAL objects for analysis: {len(all_objects)}")

# ==========================
# 3. PROPERTY SET CATALOG
# ==========================
print("\n" + "=" * 80)
print("3. PROPERTY SET CATALOG   (structure: {pset: {attr: value}})")
print("=" * 80)

# pset_name -> {attr_name -> [values]}
pset_data       = defaultdict(lambda: defaultdict(list))
pset_obj_count  = Counter()     # how many objects have each pset
object_type_ctr = Counter()
layer_ctr       = Counter()
name_ctr        = Counter()
all_attr_values = defaultdict(set)   # "pset::attr" -> set of sample values

for obj in all_objects:
    n = (obj.get('name') or '').strip()
    if n: name_ctr[n] += 1

    props = obj.get('properties') or {}
    if not isinstance(props, dict):
        continue

    for pset_name, pset_attrs in props.items():
        pset_obj_count[pset_name] += 1
        if not isinstance(pset_attrs, dict):
            continue
        for attr_name, attr_val in pset_attrs.items():
            v = str(attr_val).strip()
            pset_data[pset_name][attr_name].append(v)
            key = f"{pset_name}::{attr_name}"
            if v and v not in ('', 'None', 'null', '-1', 'No description', 'ByLayer') and len(all_attr_values[key]) < 10:
                all_attr_values[key].add(v)

            alow = attr_name.lower().strip()
            if alow in ('category', 'type', 'object type', 'family', 'family and type', 'name '):
                object_type_ctr[v] += 1
            if alow in ('layer', 'layer name', 'layer '):
                layer_ctr[v] += 1

print(f"\n  Unique property sets: {len(pset_data)}\n")

# Print each pset sorted by object count
for pset_name, attr_dict in sorted(pset_data.items(), key=lambda x: pset_obj_count[x[0]], reverse=True):
    obj_count = pset_obj_count[pset_name]
    print(f"\n  [{obj_count} objects] \"{pset_name}\"")
    # Sort attrs by frequency
    attr_counts = {attr: len(vals) for attr, vals in attr_dict.items()}
    for attr_name, count in sorted(attr_counts.items(), key=lambda x: x[1], reverse=True)[:25]:
        key = f"{pset_name}::{attr_name}"
        samples = sorted(all_attr_values.get(key, set()))[:8]
        samp_str = "  ->  " + " | ".join(samples) if samples else ""
        print(f"      {attr_name:<44} ({count}x){samp_str}")

# ==========================
# 4. OBJECT TYPES
# ==========================
print("\n" + "=" * 80)
print("4. OBJECT TYPES / CATEGORIES")
print("=" * 80)
print(f"\n  Distinct values: {len(object_type_ctr)}")
for otype, cnt in object_type_ctr.most_common(60):
    if otype.strip():
        print(f"  {cnt:6d}x  {otype}")

# ==========================
# 5. LAYER DISTRIBUTION
# ==========================
print("\n" + "=" * 80)
print("5. LAYER DISTRIBUTION (objects per layer)")
print("=" * 80)

all_layers = Counter(layer_ctr)
for l in layer_list:
    lname = l.get('name', '') if isinstance(l, dict) else str(l)
    if lname and lname not in all_layers:
        all_layers[lname] = 0

print(f"\n  Total distinct layers: {len(all_layers)}")
for lname, cnt in all_layers.most_common(100):
    if lname.strip():
        suffix = "  (def only)" if cnt == 0 else ""
        print(f"  {cnt:6d}x  '{lname}'{suffix}")

# ==========================
# 6. FIRE SAFETY + COMPLIANCE
# ==========================
print("\n" + "=" * 80)
print("6. FIRE SAFETY / BUILDING / COMPLIANCE ATTRIBUTE SCAN")
print("=" * 80)

fire_kw   = ['fire','sprinkler','alarm','suppression','egress','exit',
              'stair','corridor','compartment','smoke','evacu','emergency',
              'extinguish','hydrant','hose','detector','sensor','escape','refuge']
build_kw  = ['area','width','height','length','perimeter','dimension',
              'room','space','floor','level','zone','occupan','capacity',
              'door','window','wall','ceiling','slab','beam','column']
comply_kw = ['rating','rei','class','code','standard','comply','requir',
              'spec','regulation','certif','resistance','hour','approved','norm']

fire_hits   = defaultdict(set)
build_hits  = defaultdict(set)
comply_hits = defaultdict(set)

for obj in all_objects:
    props = obj.get('properties') or {}
    if not isinstance(props, dict): continue
    for pset_name, pset_attrs in props.items():
        if not isinstance(pset_attrs, dict): continue
        for attr_name, attr_val in pset_attrs.items():
            v     = str(attr_val).strip()
            alow  = attr_name.lower().strip()
            plow  = pset_name.lower()
            skip  = {'', 'None', 'null', '-1', 'No description', 'ByLayer', '0.000 mm', '0'}
            if v in skip: continue
            key = f"{pset_name}::{attr_name}"
            for kw in fire_kw:
                if kw in alow or kw in v.lower() or kw in plow:
                    fire_hits[key].add(v); break
            for kw in build_kw:
                if kw in alow:
                    build_hits[key].add(v); break
            for kw in comply_kw:
                if kw in alow or kw in v.lower():
                    comply_hits[key].add(v); break


def show_hits(hits, label, limit=50):
    print(f"\n  {label}  ({len(hits)} keys):")
    for k, vals in sorted(hits.items())[:limit]:
        print(f"    {k}")
        print(f"         -> {sorted(vals)[:8]}")


show_hits(fire_hits,   "FIRE-SAFETY")
show_hits(build_hits,  "BUILDING / DIMENSIONS")
show_hits(comply_hits, "COMPLIANCE / RATINGS")

# ==========================
# 7. TOP NAMES
# ==========================
print("\n" + "=" * 80)
print("7. OBJECT NAMES (top 80)")
print("=" * 80)
print(f"\n  Unique names: {len(name_ctr)}")
for nm, cnt in name_ctr.most_common(80):
    print(f"  {cnt:6d}x  {nm}")

# ==========================
# 8. COMPLETENESS
# ==========================
print("\n" + "=" * 80)
print("8. COMPLETENESS SUMMARY")
print("=" * 80)

total      = len(all_objects)
with_props = sum(1 for o in all_objects if o.get('properties'))
with_name  = sum(1 for o in all_objects if (o.get('name') or '').strip())
total_attr = sum(
    len(v) for pset in pset_data.values() for v in pset.values()
)

print(f"""
  Total objects analysed:          {total:>8,}
  Objects with properties:         {with_props:>8,}  ({100*with_props//max(total,1)}%)
  Objects with non-empty names:    {with_name:>8,}  ({100*with_name//max(total,1)}%)
  Total attribute-value records:   {total_attr:>8,}
  Unique property sets:            {len(pset_data):>8,}
  Unique object types:             {len(object_type_ctr):>8,}
  Unique layers:                   {len(all_layers):>8,}
""")

# ==========================
# 9. SAMPLE RICH OBJECTS
# ==========================
print("\n" + "=" * 80)
print("9. SAMPLE OBJECTS – 5 Most Attribute-Rich")
print("=" * 80)

def attr_count(obj):
    props = obj.get('properties') or {}
    if not isinstance(props, dict): return 0
    return sum(len(v) for v in props.values() if isinstance(v, dict))

richest = sorted(all_objects, key=attr_count, reverse=True)[:5]

for i, obj in enumerate(richest, 1):
    props = obj.get('properties') or {}
    total_a = attr_count(obj)
    print(f"\n  -- Object {i} " + "-" * 55)
    print(f"    objectid:    {obj.get('objectid','?')}")
    print(f"    name:        {obj.get('name','?')}")
    print(f"    externalId:  {obj.get('externalId','?')}")
    print(f"    view:        {obj.get('_view','?')}")
    print(f"    total attrs: {total_a}")
    if isinstance(props, dict):
        for pset_name, pset_attrs in props.items():
            print(f"\n    [{pset_name}]")
            if isinstance(pset_attrs, dict):
                for aname, aval in pset_attrs.items():
                    print(f"      {aname:<44} = {aval}")

print("\n" + "=" * 80)
print("ANALYSIS COMPLETE")
print("=" * 80)
conn.close()
