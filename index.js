// create Three.js scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// set up variables
const vertices = [];
let dottedLine, solidLine;

renderer.domElement.addEventListener( 'mousemove', onMouseMove );
renderer.domElement.addEventListener( 'mousedown', onMouseDown );

// handle mouse movement
function onMouseMove(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // calculate intersection point with plane
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const point = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  raycaster.ray.intersectPlane(plane, point);

  if (vertices.length > 0) {
    // create dotted line
    const material = new THREE.LineDashedMaterial({
      color: 0x0000ff,
      dashSize: 0.1,
      gapSize: 0.1
    });
    const lastVertex = vertices[vertices.length - 1];
    const dx = Math.abs(point.x - lastVertex.x);
    const dy = Math.abs(point.y - lastVertex.y);
    let lineGeometry;
    if (dx > dy) {
      // horizontal line
      lineGeometry = new THREE.BufferGeometry().setFromPoints([lastVertex, new THREE.Vector3(point.x, lastVertex.y, 0)]);
    } else {
      // vertical line
      lineGeometry = new THREE.BufferGeometry().setFromPoints([lastVertex, new THREE.Vector3(lastVertex.x, point.y, 0)]);
    }
    dottedLine = new THREE.Line(lineGeometry, material);
    dottedLine.computeLineDistances();
    scene.add(dottedLine);
  }

  // render scene
  renderer.render(scene, camera);
}

// handle mouse click
function onMouseDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  // calculate intersection point with plane
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const point = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, point);

  if (vertices.length > 0) {
    // calculate distances between last vertex and new vertex
    const lastVertex = vertices[vertices.length - 1];
    const dx = Math.abs(point.x - lastVertex.x);
    const dy = Math.abs(point.y - lastVertex.y);

    // use larger distance as length of solid line
    if (dx > dy) {
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([lastVertex, new THREE.Vector3(point.x, lastVertex.y, 0)]);
      solidLine = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({
        color: 0x0000ff
      }));
    } else {
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([lastVertex, new THREE.Vector3(lastVertex.x, point.y, 0)]);
      solidLine = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({
        color: 0x0000ff
      }));
    }

    // check if polygon is closed
    if (vertices.length > 2 && point.distanceTo(vertices[0]) < 0.1) {
      // close polygon
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([vertices[vertices.length - 1], vertices[0]]);
      solidLine = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({
        color: 0x0000ff
      }));
      scene.add(solidLine);
      scene.remove(dottedLine);
      dottedLine = null;
      vertices.push(vertices[0]);
      alert("Polygon closed!");
      return;
    }

    // add solid line to scene
    scene.add(solidLine);
    scene.remove(dottedLine);
    dottedLine = null;
  } else {
    // create first vertex
    const material = new THREE.PointsMaterial({
      color: 0xff0000
    });
    const geometry = new THREE.BufferGeometry().setFromPoints([point]);
    const vertex = new THREE.Points(geometry, material);
    scene.add(vertex);
    vertices.push(point);
  }

  // render scene
  renderer.render(scene, camera);
}

// set camera position and look at origin
camera.position.set( 0, 0, 5 );
camera.lookAt( 0, 0, 0 );

// render initial scene
renderer.render( scene, camera );

