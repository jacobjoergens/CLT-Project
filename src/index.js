import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';
import { scene, camera, renderer } from './init.js';

// create OrbitControls for zooming and panning
export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;

import { onMouseMove } from './mouse-move';
import { onMouseDown } from './mouse-down';
import { onMouseUp } from './mouse-up';

renderer.domElement.addEventListener('mousemove', onMouseMove);
renderer.domElement.addEventListener('mousedown', onMouseDown);
renderer.domElement.addEventListener('mouseup', onMouseUp);



// set camera position and look at origin
camera.position.set(0, 0, 100);
camera.lookAt(0, 0, 0);

// render initial scene
renderer.render(scene, camera);

animate();
function animate() {
    // update the controls
    controls.update();
    // render the scene
    renderer.render(scene, camera);
    // request the next frame of the animation loop
    requestAnimationFrame(animate);
}
  

