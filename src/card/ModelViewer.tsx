import { useEffect, useRef, useState } from "react";
import {
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  type Object3D,
  PerspectiveCamera,
  Points,
  Scene,
  Sphere,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { t } from "../i18n";
import { ColorInput } from "../ui/ColorInput";
import { Range } from "../ui/Field";
import { Hint } from "../ui/Hint";
import { loadModel } from "./modelFiles";

const hemisphereLight = 0.7;
const sunLight = 2.4;
const backgrounds = ["#f1f2f4", "#ffffff", "#c1c7d0", "#44546f", "#1d2125", "#000000"];

interface Stage {
  scene: Scene;
  hemisphere: HemisphereLight;
  sun: DirectionalLight;
  render: () => void;
}

function dispose(object: Object3D) {
  object.traverse((child) => {
    if (!(child instanceof Mesh || child instanceof Points)) return;
    child.geometry.dispose();
    for (const material of [child.material].flat()) material.dispose();
  });
}

/**
 * A 3D file in a WebGL view: drag to orbit, scroll or pinch to zoom, right-drag to pan; the light and the background
 * can be changed. Loaded on demand with three.js, so the rest of the app does not carry it.
 */
export default function ModelViewer({ data, name }: { data: ArrayBuffer; name: string }) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [light, setLight] = useState(1);
  const [background, setBackground] = useState(backgrounds[0]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.className = "absolute inset-0 size-full touch-none";
    element.prepend(renderer.domElement);
    const scene = new Scene();
    const camera = new PerspectiveCamera(45, 1, 0.01, 1000);
    const hemisphere = new HemisphereLight(0xffffff, 0x8590a2, hemisphereLight);
    // The sun follows the camera, so the side in view is always lit.
    const sun = new DirectionalLight(0xffffff, sunLight);
    sun.position.set(1, 1.5, 2);
    camera.add(sun);
    scene.add(hemisphere, camera);
    const render = () => renderer.render(scene, camera);
    stage.current = { scene, hemisphere, sun, render };
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.addEventListener("change", render);
    const resize = () => {
      renderer.setSize(element.clientWidth, element.clientHeight, false);
      camera.aspect = element.clientWidth / Math.max(1, element.clientHeight);
      camera.updateProjectionMatrix();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);

    let model: Object3D | undefined;
    let closed = false;
    loadModel(name, data)
      .then((object) => {
        if (closed) return dispose(object);
        model = object;
        // Centre the model and back the camera off until all of it is in view.
        const box = new Box3().setFromObject(object);
        object.position.sub(box.getCenter(new Vector3()));
        scene.add(object);
        const radius = box.getBoundingSphere(new Sphere()).radius || 1;
        // The narrower of the two angles of view decides, so the model fits a phone held upright too.
        const vertical = (camera.fov * Math.PI) / 360;
        const aspect = element.clientWidth / Math.max(1, element.clientHeight);
        const half = Math.min(vertical, Math.atan(Math.tan(vertical) * aspect));
        const distance = (radius / Math.sin(half)) * 1.1;
        camera.near = distance / 100;
        camera.far = distance * 100;
        camera.position.set(0.6, 0.45, 0.9).setLength(distance);
        camera.updateProjectionMatrix();
        controls.update();
        render();
        setState("ready");
      })
      .catch(() => !closed && setState("error"));
    return () => {
      closed = true;
      stage.current = null;
      observer.disconnect();
      controls.dispose();
      if (model) dispose(model);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [data, name]);

  useEffect(() => {
    const current = stage.current;
    if (!current) return;
    current.hemisphere.intensity = hemisphereLight * light;
    current.sun.intensity = sunLight * light;
    current.scene.background = new Color(background);
    current.render();
  }, [light, background]);

  return (
    <div ref={host} className="relative min-h-0 flex-1 overflow-hidden" data-model-state={state}>
      {state !== "ready" && (
        <Hint className="absolute inset-0 m-0 grid place-items-center">
          {state === "loading" ? t("card.loading") : t("card.modelError")}
        </Hint>
      )}
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-4 rounded-md bg-white/90 px-3 py-2 text-[14px] text-ink shadow-popover">
        <label className="flex items-center gap-2">
          {t("card.modelLight")}
          <Range min={0} max={3} step={0.1} value={light} onChange={(event) => setLight(Number(event.target.value))} />
        </label>
        <label className="flex items-center gap-2">
          {t("card.modelBackground")}
          <ColorInput
            value={background}
            presets={backgrounds}
            label={t("card.modelBackground")}
            onCommit={setBackground}
            className="h-7 w-10 cursor-pointer rounded-sm border border-line bg-white p-0.5"
          />
        </label>
      </div>
    </div>
  );
}
