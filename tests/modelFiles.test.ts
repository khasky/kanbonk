import { Box3, Mesh, type Object3D, Points, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { attachmentKind } from "../src/board/attachmentIndex";
import { loadModel, modelFormat } from "../src/card/modelFiles";
import { previewKind } from "../src/card/previewKinds";

const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;
const size = (object: Object3D) => new Box3().setFromObject(object).getSize(new Vector3()).toArray();
const triangle = "v 0 0 0\nv 2 0 0\nv 0 3 0\nf 1 2 3\n";
const stl = `solid t
facet normal 0 0 1
outer loop
vertex 0 0 0
vertex 2 0 0
vertex 0 3 0
endloop
endfacet
endsolid t
`;
const ply = (faces: boolean) => `ply
format ascii 1.0
element vertex 3
property float x
property float y
property float z
${faces ? "element face 1\nproperty list uchar int vertex_indices\n" : ""}end_header
0 0 0
2 0 0
0 3 0
${faces ? "3 0 1 2\n" : ""}`;

describe("3D attachments", () => {
  it("knows 3D files by extension, whatever type they were stored with", () => {
    for (const name of ["a.fbx", "a.OBJ", "a.stl", "a.gcode", "a.gco", "a.gltf", "a.glb", "a.ply", "a.3mf"])
      expect(previewKind(name, "application/octet-stream")).toBe("model");
    expect(previewKind("scene.gltf", "application/json")).toBe("model");
    expect(previewKind("part.obj", "text/plain")).toBe("model");
    expect(modelFormat("print.GCO")).toBe("gcode");
    expect(modelFormat("notes.txt")).toBeUndefined();
    expect(attachmentKind({ id: "a", name: "part.stl", mimeType: "", size: 1, status: "local" })).toBe("model");
  });

  it("reads STL, OBJ, PLY and G-code into scene objects", async () => {
    const fromStl = await loadModel("part.stl", bytes(stl));
    expect(fromStl).toBeInstanceOf(Mesh);
    expect(size(fromStl)).toEqual([2, 3, 0]);
    expect(size(await loadModel("part.obj", bytes(triangle)))).toEqual([2, 3, 0]);
    expect(await loadModel("scan.ply", bytes(ply(true)))).toBeInstanceOf(Mesh);
    expect(await loadModel("cloud.ply", bytes(ply(false)))).toBeInstanceOf(Points);
    const gcode = await loadModel("print.gcode", bytes("G1 X0 Y0 Z0.2 E0\nG1 X10 Y0 Z0.2 E1\nG1 X10 Y5 Z0.2 E2\n"));
    expect(size(gcode)[0]).toBe(10);
  });

  it("rejects files it cannot read", async () => {
    await expect(loadModel("notes.txt", bytes("hello"))).rejects.toThrow();
    await expect(loadModel("broken.glb", bytes("not a model"))).rejects.toThrow();
  });
});
