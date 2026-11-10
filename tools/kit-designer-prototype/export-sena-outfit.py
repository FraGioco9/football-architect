"""KM-05: export ONLY Alberto Sena garments from the uploaded Blender source.

Run with Blender 4.0+ from the Football Architect repo root:
  blender --background path/to/soccer_kit.blend --python \
    tools/kit-designer-prototype/export-sena-outfit.py -- \
    --textures path/to/soccer_kit/textures \
    --output kit-maker/local-assets/alberto-sena-outfit.glb \
    --report kit-maker/local-assets/alberto-sena-outfit-report.json

Local dev-only operation. Never stages a third-party asset in Git.
This is a static clothing kit, not a rigged animation or a verified fit.
"""
import argparse
import json
import re
import sys
from pathlib import Path

try:
    import bpy
    from mathutils import Vector
except ImportError as exc:
    raise RuntimeError("Run with Blender --background, not normal Python") from exc

GROUP_NAMES = ("jersey", "shorts", "socks", "boots")
MAX_GARMENT_HEIGHT = 1.85
OUTFIT_PREFIX = "FA_"
CREATOR = "Alberto Sena"
SOURCE_URL = "https://www.behance.net/gallery/229397033/Free-Soccer-Kit"


def args_from_blender():
    parser = argparse.ArgumentParser(description="Inspect/export Sena's original clothes only")
    parser.add_argument("--textures", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--audit-only", action="store_true")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])


def world_bounds(obj):
    if obj.type != "MESH" or not obj.data or len(obj.data.vertices) < 3:
        return None
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    if any(not all(abs(float(v)) < 1e7 for v in p) for p in corners):
        return None
    return {
        "min": [min(float(p[i]) for p in corners) for i in range(3)],
        "max": [max(float(p[i]) for p in corners) for i in range(3)],
    }


def classify_object(obj, bounds):
    name = obj.name.lower()
    # Blender scenes are Z-up, whereas exported glTF/Kit Maker is Y-up.
    low_z, high_z = bounds["min"][2], bounds["max"][2]
    if re.match(r"^shoes_[lr](?:\.\d+)?$", name):
        return "boots"
    if name in {"38", "42", "62", "9"} or name.startswith("pattern_"):
        return "jersey"
    if not name.startswith("pattern2d_"):
        return None
    if high_z > 1.28:
        return "jersey"
    if low_z >= 0.61:
        return "shorts"
    if high_z <= 1.15:
        return "socks"
    return None


def prepare_textures(texture_dir):
    texture_dir = texture_dir.resolve(strict=True)
    problems, relocated = [], []
    for image in bpy.data.images:
        if image.source != "FILE" or image.packed_file:
            continue
        original = image.filepath or image.name
        # CLO3D assets contain Windows separators, even when used on Linux.
        filename = original.replace("\\", "/").split("/")[-1]
        candidates = [texture_dir / filename, texture_dir / image.name]
        found = next((p for p in candidates if p.is_file()), None)
        if found is None:
            if image.users:
                problems.append(filename)
            continue
        image.filepath = str(found)
        image.reload()
        relocated.append(filename)
    return sorted(set(problems)), sorted(set(relocated))


def main():
    arguments = args_from_blender()
    if not bpy.data.filepath or Path(bpy.data.filepath).suffix.lower() != ".blend":
        raise RuntimeError("First open the original soccer_kit.blend in Blender")
    if arguments.output.suffix.lower() != ".glb":
        raise RuntimeError("Output file must be an independent local .glb")
    if arguments.report.resolve() == arguments.output.resolve():
        raise RuntimeError("Report path must differ from the model path")

    models, ignored = [], []
    for obj in bpy.context.scene.objects:
        bbox = world_bounds(obj)
        if bbox is None:
            continue
        kind = classify_object(obj, bbox)
        # Ignore supplied body/avatar, stage, balls, cameras, etc.
        if kind is None:
            ignored.append(obj.name)
            continue
        if bbox["min"][2] < -0.1 or bbox["max"][2] > MAX_GARMENT_HEIGHT:
            raise RuntimeError(f"Suspicious out-of-range garment '{obj.name}'")
        models.append({"object": obj, "name": obj.name, "category": kind,
                       "bounds": bbox, "vertices": len(obj.data.vertices)})

    counts = {group: sum(1 for item in models if item["category"] == group)
              for group in GROUP_NAMES}
    missing = [category for category, count in counts.items() if count == 0]
    missing_textures, remapped_textures = prepare_textures(arguments.textures)
    report = {
        "source_author": CREATOR,
        "source": SOURCE_URL,
        "blend_file": Path(bpy.data.filepath).name,
        "license": "NOT VERIFIED - original package contains no explicit redistribution license",
        "status": "INSPECTED_NOT_REDISTRIBUTABLE",
        "categories": counts,
        "missing_categories": missing,
        "missing_textures": missing_textures,
        "remapped_textures": remapped_textures,
        "objects": [{key: val for key, val in item.items() if key != "object"}
                    for item in models],
        "ignored_meshes": ignored,
        "rig_modified": False,
        "exported": False,
    }
    arguments.report.parent.mkdir(parents=True, exist_ok=True)
    arguments.report.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("KM-05 / Sena outfit audit:", arguments.report)
    print("Categories:", counts, "Missing:", missing)
    if arguments.audit_only:
        return 0

    if missing or missing_textures:
        raise RuntimeError(
            f"Not exporting partial/texture-broken outfit: "
            f"categories={missing}; textures={missing_textures}")
    bpy.ops.object.select_all(action="DESELECT")
    selection = []
    for item in models:
        obj = item["object"]
        world_matrix = obj.matrix_world.copy()
        obj.parent = None  # preserve parent scale (0.1 for original shoes) without exporting avatar rig
        obj.matrix_world = world_matrix
        obj.name = OUTFIT_PREFIX + item["category"] + "__" + item["name"]
        obj["fa_kit_maker_part"] = item["category"]
        obj.hide_set(False)
        obj.hide_render = False
        obj.select_set(True)
        selection.append(obj)
    bpy.context.view_layer.objects.active = selection[0]
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    export_args = dict(filepath=str(arguments.output.resolve()),
                       export_format="GLB", use_selection=True,
                       export_yup=True, export_extras=True,
                       export_materials="EXPORT")
    valid = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    if "export_draco_mesh_compression_enable" in valid:
        export_args["export_draco_mesh_compression_enable"] = False
    bpy.ops.export_scene.gltf(**export_args)
    if not arguments.output.is_file() or arguments.output.stat().st_size < 1024:
        raise RuntimeError("Failed to produce the independent outfit GLB")
    report["exported"] = True
    report["output_file"] = arguments.output.name
    report["output_bytes"] = arguments.output.stat().st_size
    report["status"] = "PRIVATE_DEV_EXPORT_ONLY_LICENSE_UNVERIFIED"
    arguments.report.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("LOCAL-ONLY outfit GLB:", arguments.output)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print("KM-05 export failed:", error, file=sys.stderr)
        raise SystemExit(1)
