# Texture-only shrink of a plain (unpacked) GLB: every picture -> SIZE px, nothing else changes.
# usage: py -I shrink.py in.glb out.glb SIZE [jpeg88]   (jpeg88 = every map to JPEG q88 4:2:0, like the Oct 28 rigged models)
import sys, json, struct, io
from PIL import Image, JpegImagePlugin
sys.stdout.reconfigure(encoding="utf-8")
src, dst, size = sys.argv[1], sys.argv[2], int(sys.argv[3]); ALLJPEG = len(sys.argv) > 4 and sys.argv[4] == "jpeg88"
b = open(src, "rb").read()
jl = struct.unpack_from("<I", b, 12)[0]
j = json.loads(b[20:20 + jl])
bl = struct.unpack_from("<I", b, 20 + jl)[0]
bin_ = b[28 + jl:28 + jl + bl]
assert len(j["buffers"]) == 1 and "EXT_meshopt_compression" not in j.get("extensionsUsed", [])

# which images are normal maps (re-normalise after resize)
normal_imgs = set()
for m in j.get("materials", []):
    nt = m.get("normalTexture")
    if nt is not None:
        normal_imgs.add(j["textures"][nt["index"]]["source"])

img_by_view = {im["bufferView"]: i for i, im in enumerate(j.get("images", []))}
out = bytearray(); report = []
for vi, v in enumerate(j["bufferViews"]):
    data = bin_[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]]
    if vi in img_by_view:
        ii = img_by_view[vi]; im = Image.open(io.BytesIO(data)); fmt = im.format
        w0, h0 = im.size
        if max(w0, h0) > size:
            mode = im.mode
            r = im.convert("RGBA" if "A" in mode else "RGB").resize((size * w0 // max(w0, h0), size * h0 // max(w0, h0)), Image.LANCZOS)
            if ii in normal_imgs:
                px = r.load()
                for y in range(r.size[1]):
                    for x in range(r.size[0]):
                        p = px[x, y]; n = [(c / 255) * 2 - 1 for c in p[:3]]
                        l = (n[0] ** 2 + n[1] ** 2 + n[2] ** 2) ** 0.5 or 1
                        q = tuple(max(0, min(255, round((c / l + 1) / 2 * 255))) for c in n)
                        px[x, y] = q + tuple(p[3:])
            buf = io.BytesIO()
            if ALLJPEG:
                r.convert("RGB").save(buf, "JPEG", quality=88, subsampling=2); j["images"][ii]["mimeType"] = "image/jpeg"
            elif fmt == "JPEG":
                r.convert("RGB").save(buf, "JPEG", qtables=im.quantization, subsampling=JpegImagePlugin.get_sampling(im))
            else:
                r.save(buf, "PNG", optimize=True)
            data = buf.getvalue()
        report.append((ii, j["images"][ii].get("mimeType"), (w0, h0), Image.open(io.BytesIO(data)).size, v["byteLength"], len(data), "normal" if ii in normal_imgs else ""))
    while len(out) % 4: out.append(0)
    v["byteOffset"] = len(out); v["byteLength"] = len(data); out += data
while len(out) % 4: out.append(0)
j["buffers"][0]["byteLength"] = len(out)
js = json.dumps(j, separators=(",", ":")).encode()
js += b" " * ((4 - len(js) % 4) % 4)
glb = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(out), 0x004E4942) + bytes(out)
open(dst, "wb").write(glb)

# check: every non-picture view byte-identical, JSON identical apart from offsets/lengths
b2 = glb; j2 = json.loads(b2[20:20 + len(js)]); bin2 = bytes(out)
j0 = json.loads(b[20:20 + jl])
for vi, (v0, v1) in enumerate(zip(j0["bufferViews"], j2["bufferViews"])):
    if vi in img_by_view: continue
    a = bin_[v0.get("byteOffset", 0):v0.get("byteOffset", 0) + v0["byteLength"]]
    c = bin2[v1["byteOffset"]:v1["byteOffset"] + v1["byteLength"]]
    assert a == c, "view %d differs" % vi
strip = lambda d: json.dumps({k: (val if k not in ("bufferViews", "images") else [{kk: vv for kk, vv in x.items() if kk not in ("byteOffset", "byteLength", "mimeType")} for x in val]) for k, val in d.items() if k != "buffers"}, sort_keys=True)
s0 = json.loads(strip(j0)); s1 = json.loads(strip(j2))
for i in img_by_view: pass
assert s0 == s1, "JSON differs"
for r in report: print("image", r)
print(src, len(b), "->", dst, len(glb), "| non-picture bytes and JSON identical")
