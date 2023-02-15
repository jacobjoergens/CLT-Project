// create scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// create material for dotted line
const dottedLineMaterial = new THREE.LineDashedMaterial({
    color: 0x000000,
    linewidth: 2,
    dashSize: 5,
    gapSize: 5
});

// create geometry for dotted line
const dottedLineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3( 0, 0, 0 ),
    new THREE.Vector3( 0, 0, 0 )
]);

// create dotted line object
const dottedLine = new THREE.Line(dottedLineGeometry, dottedLineMaterial);
dottedLine.computeLineDistances();
dottedLine.visible = false;
scene.add(dottedLine);

// create material for solid line
const solidLineMaterial = new THREE.LineBasicMaterial({
    color: 0x000000,
    linewidth: 2
});

// create geometry for solid line
const solidLineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3( 0, 0, 0 ),
    new THREE.Vector3( 0, 0, 0 )
]);

// create solid line object
const solidLine = new THREE.Line(solidLineGeometry, solidLineMaterial);
scene.add(solidLine);

// create array to hold line segments
const lineSegments = [];

// add event listeners to renderer
renderer.domElement.addEventListener('mousemove', (event) => {
    // get mouse position in normalized device coordinates
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );

    // create raycaster to test for intersection with plane at z = 0
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersection = raycaster.intersectObject(plane)[0];

    if (intersection) {
        // snap intersection point to grid of 1 unit squares
        const point = new THREE.Vector3(
            Math.round(intersection.point.x),
            Math.round(intersection.point.y),
            0
        );

        // update dotted line geometry to show where new segment would be placed
        dottedLine.geometry.setFromPoints([solidLine.geometry.vertices[1], point]);
        dottedLine.visible = true;
    } else {
        // hide dotted line if no intersection
        dottedLine.visible = false;
    }
});

renderer.domElement.addEventListener('mousedown', (event) => {
    // get mouse position in normalized device coordinates
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );

    // create raycaster to test for intersection with plane at z = 0
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersection = raycaster.intersectObject(plane)[0];

    if (intersection) {
        // snap intersection point to grid of 1 unit squares
        const point = new THREE.Vector3(
            Math.round(intersection.point.x),
            Math.round(intersection.point.y),
            0
        );

        if (lineSegments.length === 0) {
          // add first point to new segment
          solidLine.geometry.setFromPoints([point, point]);
        } else {
          const lastPoint = lineSegments[lineSegments.length - 1].end;
          const diff = point.clone().sub(lastPoint);
          if (diff.x === 0 || diff.y === 0) {
          // new segment is orthogonal to previous segment
          solidLine.geometry.setFromPoints([lastPoint, point]);
          lineSegments.push({start: lastPoint, end: point});
                      // check if segment is closed (i.e. forms a rectangle)
            const firstPoint = lineSegments[0].start;
            const lastSegment = lineSegments[lineSegments.length - 1];
            if (lastSegment.end.equals(firstPoint)) {
                // exit drawing mode
                dottedLine.visible = false;
                renderer.domElement.removeEventListener('mousemove');
                renderer.domElement.removeEventListener('mousedown');
            }
            } else {
                // new segment is not orthogonal to previous segment
                solidLine.geometry.setFromPoints([point, point]);
            }
        }
    }
});

// create plane at z = 0 to intersect with raycaster
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

// position camera and plane
camera.position.z = 5;
plane.rotateX(-Math.PI / 2);

// render loop
function animate() {
requestAnimationFrame( animate );
renderer.render( scene, camera );
}
animate();
