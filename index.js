// create Three.js scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.color = 0x3a0d00
document.body.appendChild(renderer.domElement);

// set up variables
let vertices = [];
let dottedLine, lineGeometry;
let snapLine; 
let osnapOffset = .2;

renderer.domElement.addEventListener('mousemove', onMouseMove);
renderer.domElement.addEventListener('mousedown', onMouseDown);

function drawCircle(x,y){
    const radius = .2;
    const segments = 32;
    const material = new THREE.MeshBasicMaterial({ color: 0xd3d3d3 });
    const geometry = new THREE.CircleGeometry(radius, segments);
    const circle = new THREE.Mesh(geometry, material);
    circle.position.set(x, y, 0);
    return circle;
} 
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
        //osnap 
        if(snapLine){
            snapLine.geometry.dispose();
            snapLine.material.dispose();
            scene.remove(snapLine);
            scene.remove(circle);
        }
        const snap_material = new THREE.LineBasicMaterial({color: 0xd3d3d3}); 
        let snapGeometry, start, end; 
        for (let i = 0; i < vertices.length-2; i++) {
            vertex = vertices[i]
            if(mouse.x<=vertex.x+osnapOffset && mouse.x>=vertex.x-osnapOffset){
                console.log("x match");
                start = new THREE.Vector3(vertex.x, window.innerHeight / 2, 0);
                end = new THREE.Vector3(vertex.x, - window.innerHeight / 2, 0);
                circle = drawCircle(vertex.x, vertex.y)
                continue;
            } else if(mouse.y<=vertex.y+osnapOffset && mouse.y>=vertex.y-osnapOffset){
                console.log("y match");
                start = new THREE.Vector3(-window.innerWidth / 2, vertex.y, 0);
                end = new THREE.Vector3(window.innerWidth / 2, vertex.y, 0); 
                circle = drawCircle(vertex.x, vertex.y)
                continue;
            }
        }
        if(start && end){
            snapGeometry = new THREE.BufferGeometry().setFromPoints([start,end])
            snapLine = new THREE.Line(snapGeometry,snap_material)
            scene.add(snapLine);
            scene.add(circle);
        }

        if (dottedLine) {
            dottedLine.geometry.dispose();
            dottedLine.material.dispose();
            scene.remove(dottedLine);
            start = null;
            end = null;
        }
        // create dotted line
        const material = new THREE.LineDashedMaterial({
            color: 0xffffff,
            dashSize: 0.1,
            gapSize: 0.1
        });
        const lastVertex = vertices[vertices.length - 1];
        const dx = Math.abs(point.x - lastVertex.x);
        const dy = Math.abs(point.y - lastVertex.y);
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

function createSolidLine() {
    dottedLine.material.dispose();
    const solidMaterial = new THREE.LineBasicMaterial({ color: 0xbfffbf });
    dottedLine.material = solidMaterial;
    var solidLine = dottedLine.clone();
    dottedLine.geometry.dispose();
    scene.remove(dottedLine);
    return solidLine
}

// handle mouse click
function onMouseDown(event) {
    if (vertices.length > 0) {
        const positionAttribute = lineGeometry.getAttribute('position');
        const startEndpoint = new THREE.Vector3().fromBufferAttribute(positionAttribute, 0);
        const endEndpoint = new THREE.Vector3().fromBufferAttribute(positionAttribute, 1);
        // check if polygon is closed
        if (vertices.length > 2 && endEndpoint.distanceTo(vertices[0]) < 0.1) {
            console.log("polygon closed");
            // close polygon
            solidLine = createSolidLine(vertices[vertices.length - 1], vertices[0])
            scene.add(solidLine);
            vertices = [] ; 
            dottedLine = null ; 
            lineGeometry = null ; 
            return;
        }
        
        // add solid line to scene
        solidLine = createSolidLine()
        scene.add(solidLine);
        vertices.push(endEndpoint);
    } else {
        // create first vertex
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
        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: .5
        });
        const geometry = new THREE.BufferGeometry().setFromPoints([point]);
        const vertex = new THREE.Points(geometry, material);
        //scene.add(vertex);
        vertices.push(point);
    }
    // render scene
    renderer.render(scene, camera);
}

// set camera position and look at origin
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);

// render initial scene
renderer.render(scene, camera);

