//import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// create Three.js scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, .1, 1000);
const renderer = new THREE.WebGLRenderer({alpha: true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
//document.body.style.background = 0x000000;
//const controls = new OrbitControls(camera, renderer.domElement);

// set up variables
let vertices = [];
let segments = [];
let dottedLine, lineGeometry;
let h_snapLine = [];
let v_snapLine = [];
let crossings = new THREE.Group();
let previewGroup;
let osnapOffset = window.innerHeight/500;

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
    const material = new THREE.MeshBasicMaterial({ color: 0xb8a5a3 });
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
        previewGroup.children[0].visible = true;
        previewGroup.children[1].visible = true;
        scene.add(previewGroup);
        return ortho_vertex;
    }
}

function drawIntersection(vertex){
    const material = new THREE.MeshBasicMaterial({ color: 0xbb6a79 });
    const geometry = new THREE.CircleGeometry(osnapOffset, 32);
    const circle = new THREE.Mesh(geometry, material);
    circle.position.set(vertex.x, vertex.y, 0);
    circle.visible = true;
    return circle;
}


const rect = renderer.domElement.getBoundingClientRect();
var mouse = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
var point = new THREE.Vector3();
var raycaster = new THREE.Raycaster();


// handle mouse movement
function onMouseMove(event) {
    event.preventDefault();
    mouse.x = ( ( event.clientX - rect.left ) / ( rect.right - rect.left ) ) * 2 - 1;
    mouse.y = - ( ( event.clientY - rect.top ) / ( rect.bottom - rect.top) ) * 2 + 1;
    
    // calculate intersection point with plane
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(plane, point); 

    if (vertices.length > 0) {   
        //reset scene wrt dottedLine
        if (dottedLine) {
            dottedLine.geometry.dispose();
            scene.remove(dottedLine);
        }
        if(previewGroup){
            previewGroup.visible = false;
            scene.remove(previewGroup);
            previewGroup = null;
        }
        if(crossings.children){
            crossings.visible = false;
            while (crossings.children.length > 0) {
                crossings.remove(crossings.children[0]);
            }
            scene.remove(crossings);
        }

        //create dotted line
        const material = new THREE.LineDashedMaterial({
            color: 0xbfffbf,
            dashSize: 0.1,
            gapSize: 0.1,
            opacity: 0.75,
            transparent: true
        });

        const lastVertex = vertices[vertices.length - 1];
        const dx = Math.abs(point.x - lastVertex.x);
        const dy = Math.abs(point.y - lastVertex.y);
        let snap_intersects, orthogonal_vertex;
        const order = [lastVertex, point];
        if (dx > dy) {
            // horizontal line
            order.reverse();
            snapSet = v_snapLine;
        } else {
            // vertical line
            snapSet = h_snapLine;
        }
        if(vertices.length>2){
            snap_intersects = raycaster.intersectObjects(snapSet);
        }
        
        if(snap_intersects){
            if(snap_intersects[0]){
                    orthogonal_vertex = drawPreview(snap_intersects[0].object.parent, lastVertex);
                    if(orthogonal_vertex){
                        order[order.indexOf(point)]=orthogonal_vertex;
                    }
            }
        }
        nextVertex = new THREE.Vector3(order[0].x, order[1].y, 0);
        lineGeometry = new THREE.BufferGeometry().setFromPoints([lastVertex, nextVertex]);
        dottedLine = new THREE.Line(lineGeometry, material);
        dottedLine.computeLineDistances();
        

        const direction = new THREE.Vector3().subVectors(nextVertex, lastVertex);
        const intersect_caster = new THREE.Raycaster(lastVertex,direction.normalize());
        for (const seg of segments.slice(0,-1)){
            // Check for intersection between the ray and the line segment
            const intersection = intersect_caster.intersectObject(seg);

            // If there is an intersection, intersection will be a THREE.Vector3 object
            if (intersection) {
                if(intersection[0]){
                    if(intersection[0].distance<=lastVertex.distanceTo(nextVertex)){
                        circle = drawIntersection(intersection[0].point);
                        crossings.add(circle);
                        crossings.visible = true;
                        scene.add(crossings);
                    }
                }
            }
        }

        if(crossings.children!=[]){
            scene.add(dottedLine);
        }
    }
    // render scene
    renderer.render(scene, camera);
}

function setSnapLines(vertex, lastVertex, secondLast){

    const material = new THREE.LineBasicMaterial({ color: 0xb8a5a3, opacity: 0.25, transparent: true});

    const cardinal = [
        new THREE.Vector3(1,0,0),
        new THREE.Vector3(-1,0,0),
        new THREE.Vector3(0,1,0),
        new THREE.Vector3(0,-1,0)
    ];
    //get unviable directions
    const last_direction = new THREE.Vector3().subVectors(vertex,lastVertex).normalize().round();
    let second_direction;
    if(secondLast!=null){
        second_direction = new THREE.Vector3().subVectors(secondLast,lastVertex).normalize().round();
    }
    console.log(last_direction, second_direction);
    
    // create viable, cardinal snapLines around new vertex
    for(const el of cardinal){
        if(el.equals(last_direction)||(second_direction && el.equals(second_direction))){
            continue;
        }else if(el.y==0){
            a = new THREE.Vector3(lastVertex.x,lastVertex.y,0);
            b = new THREE.Vector3(el.x*window.innerWidth/2,lastVertex.y,0);
        } else {
            a = new THREE.Vector3(lastVertex.x,lastVertex.y,0);
            b = new THREE.Vector3(lastVertex.x,el.y*window.innerHeight/2,0);
        }
    
        const snapGeometry = new THREE.BufferGeometry().setFromPoints([a,b]);
        const snapLine = new THREE.Line(snapGeometry, material);
        snapLine.visible = true;
        const group = new THREE.Group();
        circle = drawCircle(lastVertex.x, lastVertex.y);
        group.add(circle);
        group.add(snapLine);
        scene.add(group);
        if(el.y==0){
            h_snapLine.push(group);
        } else { 
            v_snapLine.push(group);
        }
    }
}

// handle mouse click
function onMouseDown(event) {
    event.preventDefault();
    
    if (vertices.length > 0) {
        const positionAttribute = lineGeometry.getAttribute('position');
        if(vertices.length==1){
            vertices[0] = new THREE.Vector3().fromBufferAttribute(positionAttribute, 0);
        }
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
        segments.push(solidLine);
        vertices.push(endpoint);
    } else {
        // calculate intersection point with plane
        vertices.push(point.clone());
    }
    vertex = vertices[vertices.length-1];

    if(vertices.length>1){
        lastVertex = vertices[vertices.length-2];
        secondLast = null; 
        if(vertices.length>2){
            secondLast = vertices[vertices.length-3];
        }
        setSnapLines(vertex, lastVertex, secondLast);
    }
        //render scene
    renderer.render(scene, camera);
}

// set camera position and look at origin
camera.position.set(0, 0, 100);
camera.lookAt(0, 0, 0);

// render initial scene
renderer.render(scene, camera);

