import { type BufferGeometry, Group, Mesh, MeshStandardMaterial, type Object3D, Points, PointsMaterial } from "three";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GCodeLoader } from "three/examples/jsm/loaders/GCodeLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

export type ModelFormat = "fbx" | "obj" | "stl" | "gcode" | "gltf" | "glb" | "ply" | "3mf";

const formats: Record<string, ModelFormat> = {
  fbx: "fbx",
  obj: "obj",
  stl: "stl",
  gcode: "gcode",
  gco: "gcode",
  gltf: "gltf",
  glb: "glb",
  ply: "ply",
  "3mf": "3mf",
};

/** The 3D format of a file, by its extension. */
export function modelFormat(name: string): ModelFormat | undefined {
  return formats[name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ""];
}

const surface = () => new MeshStandardMaterial({ color: 0x8f9eb0, roughness: 0.55, metalness: 0.1 });

/** A bare geometry (STL, PLY) as a mesh, with its vertex colours when the file has them. */
function meshOf(geometry: BufferGeometry): Mesh {
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  const material = surface();
  material.vertexColors = Boolean(geometry.getAttribute("color"));
  return new Mesh(geometry, material);
}

/** A PLY scan without faces is a point cloud. */
function plyObject(geometry: BufferGeometry): Object3D {
  if (geometry.index) return meshOf(geometry);
  return new Points(
    geometry,
    new PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: Boolean(geometry.getAttribute("color")) }),
  );
}

/** Reads a 3D file, by its name's extension, into a scene object; textures embedded in the file (FBX, GLB, 3MF) come with it. */
export async function loadModel(name: string, data: ArrayBuffer): Promise<Object3D> {
  const format = modelFormat(name);
  if (!format) throw new Error(`Not a 3D file: ${name}`);
  const text = () => new TextDecoder().decode(data);
  switch (format) {
    case "stl":
      return meshOf(new STLLoader().parse(data));
    case "ply":
      return plyObject(new PLYLoader().parse(data));
    case "obj": {
      // Materials live in a separate .mtl file the attachment does not carry.
      const object = new OBJLoader().parse(text());
      object.traverse((child) => {
        if (child instanceof Mesh) child.material = surface();
      });
      return object;
    }
    case "gcode":
      return new GCodeLoader().parse(text());
    case "fbx":
      return new FBXLoader().parse(data, "");
    case "3mf":
      return new ThreeMFLoader().parse(data);
    case "gltf":
    case "glb": {
      const gltf = await new GLTFLoader().parseAsync(data, "");
      const group = new Group();
      group.add(gltf.scene);
      return group;
    }
  }
}
