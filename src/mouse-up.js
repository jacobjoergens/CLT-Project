import * as THREE from 'three';
import { scene, camera, renderer } from "./init.js";
import { crossings } from "./mouse-move.js";

export function onMouseUp(event){
    if(crossings.children.length>0){
        crossings.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.material.color.set(0xbb6a79);
            }
          });
        renderer.render(scene, camera);
        return;
    }
}
    