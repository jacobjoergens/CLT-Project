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
let h_snapLine = [];
let v_snapLine = [];
let previewGroup;
let osnapOffset = .05;

renderer.domElement.addEventListener('mousemove', onMouseMove);
renderer.domElement.addEventListener('mousedown', onMouseDown);

function createSolidLine() {
    dottedLine.material.dispose();
    const solidMaterial = new THREE.LineBasicMaterial({ color: 0xbfffbf });
    dottedLine.material = solidMaterial;
    var solidLine = dottedLine.clone();
    dottedLine.geometry.dispose();
    scene.remove(dottedLine);
    return solidLine;
}

function drawCircle(x,y){
    const radius = osnapOffset;
    const segments = 32;
    const material = new THREE.MeshBasicMaterial({ color: 0xd3d3d3 });
    const geometry = new THREE.CircleGeometry(radius, segments);
    const circle = new THREE.Mesh(geometry, material);
    circle.position.set(x, y, 0);
    circle.visible = false;
    return circle;
} 

function drawPreview(snapGroup, lastVertex){
    previewGroup = snapGroup.clone();
    ortho_vertex = previewGroup.children[0].position;

    if(ortho_vertex.x.toFixed(5)==lastVertex.x.toFixed(5)||ortho_vertex.y.toFixed(5)==lastVertex.y.toFixed(5)){
        return null;
    } else {
        console.log(ortho_vertex.x,lastVertex.x,ortho_vertex.y,lastVertex.y)
        previewGroup.children[0].visible = true;
        previewGroup.children[1].visible = true;
        scene.add(previewGroup);
        return ortho_vertex;
    }
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
        //reset scene wrt dottedLine
        if (dottedLine) {
            dottedLine.geometry.dispose();
            //dottedLine.material.dispose();
            scene.remove(dottedLine);
        }

        if(previewGroup){
            previewGroup.visible = false;
            scene.remove(previewGroup);
            previewGroup = null;
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
        let intersects, orthogonal_vertex;
        const order = [lastVertex, point];
        if (dx > dy) {
            // horizontal line
            order.reverse();
            if(vertices.length>2){
                intersects = raycaster.intersectObjects(v_snapLine.slice(0,-2));
            }
        } else {
            // vertical line
            if(vertices.length>2){
                intersects = raycaster.intersectObjects(h_snapLine.slice(0,-2));
            }
        }
        if(intersects){
            if(intersects[0]){
                    orthogonal_vertex = drawPreview(intersects[0].object.parent, lastVertex);
                    if(orthogonal_vertex){
                        order[order.indexOf(point)]=orthogonal_vertex;
            
                    }
            }
        }
        
        lineGeometry = new THREE.BufferGeometry().setFromPoints([lastVertex, new THREE.Vector3(order[0].x, order[1].y, 0)]);
        dottedLine = new THREE.Line(lineGeometry, material);
        dottedLine.computeLineDistances();
        scene.add(dottedLine);
    }
    // render scene
    renderer.render(scene, camera);
}

// handle mouse click
function onMouseDown(event) {
    // create first vertex
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    if (vertices.length > 0) {
        const positionAttribute = lineGeometry.getAttribute('position');
        const endpoint = new THREE.Vector3().fromBufferAttribute(positionAttribute, 1);
        // check if polygon is closed
        if (vertices.length > 2 && endpoint.distanceTo(vertices[0]) < 0.1) {
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
        vertices.push(endpoint);
    } else {
        // calculate intersection point with plane
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const point = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, point);
        vertices.push(point);
    }
    // render scene
    //create circle at vertex 
    vertex = vertices[vertices.length-1];
    circle = drawCircle(vertex.x, vertex.y);

    const material = new THREE.LineBasicMaterial({ color: 0xbb6a79, linewidth: osnapOffset});

    // create a horizontal line that spans the width of the window
    const horizontalGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-window.innerWidth / 2, vertex.y, 0),new THREE.Vector3(window.innerWidth / 2, vertex.y, 0)]);
    const horizontalLine = new THREE.LineSegments(horizontalGeometry, material);
    horizontalLine.visible = false;
    const h_group = new THREE.Group();
    h_group.add(circle);
    h_group.add(horizontalLine);
    scene.add(h_group);
    h_snapLine.push(h_group);

    // create a vertical line that spans the height of the window
    const verticalGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(vertex.x, -window.innerHeight / 2, 0),new THREE.Vector3(vertex.x, window.innerHeight / 2, 0)]);
    const verticalLine = new THREE.Line(verticalGeometry, material);
    verticalLine.visible = false;
    const v_group = new THREE.Group();
    v_group.add(circle);
    v_group.add(verticalLine);
    scene.add(v_group);
    v_snapLine.push(v_group);
    renderer.render(scene, camera);
}

// set camera position and look at origin
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);

// render initial scene
renderer.render(scene, camera);

