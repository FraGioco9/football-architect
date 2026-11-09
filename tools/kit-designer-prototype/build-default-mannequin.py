#!/usr/bin/env python3
"""Recreate the owner-approved CC0 male with relaxed arms clear of the torso (Python 3 stdlib)."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
from urllib.request import Request, urlopen

INPUT_SHA="86c7cdfa989924b45e2e5110c131a4a4e6251ceb4e71246be68e468f3a32ca86"
OUTPUT_SHA="d242a684bb636bad4b183d5ab19996acdd2e9c049e0f94c8e133a3db8dbefaf3"
SOURCE_URL="https://files.innerscene.com/library/male-base-mesh-3d-person-rigged-a-pose-380e6d89/038f3a526b2fc3efd012/male-base-mesh-base_male.glb"
FACTOR=1.0082009620848544
ROT={
 "upperarm01.L":[-0.004643015882370147,-0.04627808297668551,-0.4842050267232297,0.873717502134114],
 "lowerarm01.L":[0.014700455862147124,0.0553038508332524,-0.04935969144476318,0.9971404121491297],
 "upperarm01.R":[-0.004643015882370147,0.04627808297668551,0.4842050267232297,0.873717502134114],
 "lowerarm01.R":[0.014700455862147124,-0.0553038508332524,0.04935969144476318,0.9971404121491297],
}
def build(raw):
 if hashlib.sha256(raw).hexdigest()!=INPUT_SHA:
  raise ValueError("Input does not match the approved owner's source model")
 magic,version,size=struct.unpack_from("<III",raw,0)
 if (magic,version,size)!=(0x46546C67,2,len(raw)):raise ValueError("Invalid GLB header")
 chunks=[];off=12
 while off<len(raw):
  length,kind=struct.unpack_from("<II",raw,off);off+=8
  chunks.append((kind,raw[off:off+length]));off+=length
 if len(chunks)!=2 or [c[0] for c in chunks]!=[0x4E4F534A,0x004E4942]:
  raise ValueError("Expected complete JSON+BIN GLB")
 doc=json.loads(chunks[0][1].decode("utf8"))
 if len(doc["skins"][0]["joints"])!=163:raise ValueError("Incorrect rig")
 if sum(n.get("name") in ROT for n in doc["nodes"])!=4:raise ValueError("Arm chains missing")
 for node in doc["nodes"]:
  if node.get("name") in ROT:node["rotation"]=ROT[node["name"]]
 root=doc["nodes"][doc["scenes"][doc["scene"]]["nodes"][0]]
 if root.get("name")!="base_male_body.rig":raise ValueError("Wrong skeleton root")
 root["scale"]=[FACTOR,FACTOR,FACTOR]
 doc.setdefault("extras",{})["footballArchitect"]={
  "sourceFile":"male-base-mesh-base_male.glb",
  "modification":"arms lowered relaxed and slightly away from torso; scaled to exact 180 cm",
  "upperTarget":[0.18,-1.0,0.01],
  "lowerTarget":[0.1,-1.0,0.03],
  "scaleFactor":FACTOR}
 encoded=json.dumps(doc,separators=(",",":"),ensure_ascii=False).encode("utf8")
 encoded+=b" "*((-len(encoded))%4)
 payload=chunks[1][1]
 payload+=b"\0"*((-len(payload))%4)
 out=(struct.pack("<III",0x46546C67,2,12+8+len(encoded)+8+len(payload))+
      struct.pack("<II",len(encoded),0x4E4F534A)+encoded+
      struct.pack("<II",len(payload),0x004E4942)+payload)
 if hashlib.sha256(out).hexdigest()!=OUTPUT_SHA:
  raise ValueError("Unexpected output hash; do not publish")
 return out

def main():
 ap=argparse.ArgumentParser()
 ap.add_argument("--source",help="Previously downloaded original CC0 GLB")
 ap.add_argument("--output",default="tools/kit-designer-prototype/mannequin-180.glb")
 args=ap.parse_args()
 if args.source:raw=Path(args.source).read_bytes()
 else:
  request=Request(SOURCE_URL,headers={"User-Agent":"Mozilla/5.0 FootballArchitect/1.0"})
  with urlopen(request,timeout=40) as response:raw=response.read(6000000)
 result=build(raw)
 path=Path(args.output);path.parent.mkdir(parents=True,exist_ok=True)
 path.write_bytes(result)
 print("Generated",path,len(result),"bytes; sha256",OUTPUT_SHA)
if __name__=="__main__":main()
