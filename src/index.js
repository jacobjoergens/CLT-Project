import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { Rhino3dmLoader } from 'three/examples/jsm/loaders/3DMLoader'
import rhino3dm from 'rhino3dm'

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, .1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight * .9);
document.body.appendChild(renderer.domElement);

// create OrbitControls for zooming and panning
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableRotate = false;

//initialize and  basic three variables
const rect = renderer.domElement.getBoundingClientRect();
let mouse = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
let raycaster = new THREE.Raycaster();
let point = new THREE.Vector3();

//dottedLine variables 
let dottedLine;
const dottedGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]);
const dottedMaterial = new THREE.LineDashedMaterial({
    color: 0xbfffbf,
    dashSize: 0.25,
    gapSize: 0.25,
    opacity: 0.75,
    transparent: true
});
dottedLine = new THREE.Line(dottedGeometry, dottedMaterial);
dottedLine.computeLineDistances();
dottedLine.visible = false;
scene.add(dottedLine);

//intersection variables
let crossings = new THREE.Group();

// preview variables
let previewGroup = null;

/*
Description: renders a snapGroup, consisting of a snapLine and a vertex-marking circle, visible
with one exception if the the vertex in question is the first vertex (here polygon-closing logic takes priority) 
*/
function drawPreview(snapGroup, lastVertex) {
    previewGroup = snapGroup;
    const ortho_vertex = previewGroup.children[0].position;

    if (ortho_vertex.x.toFixed(5) == lastVertex.x.toFixed(5) || ortho_vertex.y.toFixed(5) == lastVertex.y.toFixed(5)) {
        return null;
    } else {
        previewGroup.visible = true;
        return ortho_vertex;
    }
}

/*
Description: returns a circle object at the position of vertex input
geometry: constant 
material: color set from input 
visibility set from input
*/
function drawCircle(vertex, color, visibility) {
    const material = new THREE.MeshBasicMaterial({ color: color });
    const geometry = new THREE.CircleGeometry(.5, 32);
    const circle = new THREE.Mesh(geometry, material);
    circle.position.set(vertex.x, vertex.y, 0);
    circle.visible = visibility;
    return circle;
}

function updateDottedGeometry(lastVertex, nextVertex) {
    const positionAttribute = dottedGeometry.getAttribute('position');
    dottedLine.visible = true;
    positionAttribute.setXYZ(0, lastVertex.x, lastVertex.y, lastVertex.z);
    positionAttribute.setXYZ(1, nextVertex.x, nextVertex.y, nextVertex.z);
    dottedLine.computeLineDistances();
    dottedLine.geometry.attributes.position.needsUpdate = true;
}

function onMouseMove(event) {
    event.preventDefault();
    mouse.x = ((event.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
    mouse.y = - ((event.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;

    // calculate intersection point with plane
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(plane, point);

    if (vertices.length > 0) {
        if (previewGroup) {
            previewGroup.visible = false;
            previewGroup = null;
        }

        if (crossings.children.length > 0) {
            crossings.visible = false;
            while (crossings.children.length > 0) {
                crossings.remove(crossings.children[0]);
            }
            scene.remove(crossings);
        }

        const lastVertex = vertices[vertices.length - 1];
        let nextVertex;
        const dx = Math.abs(point.x - lastVertex.x);
        const dy = Math.abs(point.y - lastVertex.y);
        let snap_intersects, orthogonal_vertex;
        let snapSet = [h_snapLine, v_snapLine];
        const order = [lastVertex, point];
        let intersects;

        if (dx > dy) { // horizontal line
            order.reverse();
            snapSet.reverse();
        }

        nextVertex = new THREE.Vector3(order[0].x, order[1].y, 0);
        let direction = new THREE.Vector3().subVectors(nextVertex, lastVertex);

        if (vertices.length > 1) {
            const parallel = lastVertex.clone().sub(vertices[vertices.length - 2]).normalize();
            if (direction.dot(parallel) < 0) {
                order.reverse();
                snapSet.reverse();
                nextVertex.set(order[0].x, order[1].y, 0);
                direction.subVectors(nextVertex, lastVertex);
            }
        }
        const orthocaster = new THREE.Raycaster(nextVertex, direction.normalize());
        if (vertices.length > 2) {
            snap_intersects = orthocaster.intersectObjects(snapSet[0]);
            if (snap_intersects && snap_intersects[0] && snap_intersects[0].distance < 0.5) {
                orthogonal_vertex = drawPreview(snap_intersects[0].object.parent, lastVertex);
                if (orthogonal_vertex) {
                    order[order.indexOf(point)] = orthogonal_vertex;
                    nextVertex.set(order[0].x, order[1].y, 0);
                }
            }
        }

        const intersect_caster = new THREE.Raycaster(lastVertex, direction.normalize());
        if (vertices.length > 3) {
            intersects = intersect_caster.intersectObjects([solidLine, curves]);
            if (intersects && intersects.length > 0) {
                for (const intersect of intersects.slice(1)) {
                    if (intersect.distance <= nextVertex.distanceTo(lastVertex)) {
                        if (nextVertex.distanceTo(vertices[0]) <= 1) {
                            const circle = drawCircle(intersect.point, 'green', true);
                            crossings.add(circle);
                            crossings.visible = true;
                            scene.add(crossings);
                            nextVertex.set(vertices[0].x, vertices[0].y, 0);
                        } else {
                            const circle = drawCircle(intersect.point, 0xbb6a79, true);
                            crossings.add(circle);
                            crossings.visible = true;
                            scene.add(crossings);
                        }
                    }
                }
            }
        }
        updateDottedGeometry(lastVertex, nextVertex);
    }
    // render scene
    renderer.render(scene, camera);
};


let vertices = [];
let curves = new THREE.Group();

//snapLine variables
let h_snapLine = [];
let v_snapLine = [];


let solidGeometry = new THREE.BufferGeometry();
solidGeometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
const solidMaterial = new THREE.LineBasicMaterial({ color: 0xbfffbf });
const solidLine = new THREE.LineSegments(solidGeometry, solidMaterial);
scene.add(solidLine);

function updateSolidLine() {
    solidGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flatMap(v => v.toArray()), 3));
    const indices = [];
    for (let i = 0; i < vertices.length - 1; i++) {
        indices.push(i, i + 1);
    }
    solidGeometry.setIndex(indices);
    solidLine.geometry.boundingSphere = null;
    solidLine.geometry.attributes.position.needsUpdate = true;
}

function setSnapLines(vertex, lastVertex, secondLast) {
    const material = new THREE.LineBasicMaterial({ color: 0xb8a5a3, opacity: 0.25, transparent: true });

    const cardinal = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, -1, 0)
    ];

    //get unviable directions
    const last_direction = new THREE.Vector3().subVectors(vertex, lastVertex).normalize().round();
    let second_direction;

    if (secondLast != null) {
        second_direction = new THREE.Vector3().subVectors(secondLast, lastVertex).normalize().round();
    }

    let a, b;
    // create viable, cardinal snapLines around new vertex
    for (const el of cardinal) {
        if (el.equals(last_direction) || (second_direction && el.equals(second_direction))) {
            continue;
        } else if (el.y == 0) {
            a = new THREE.Vector3(lastVertex.x, lastVertex.y, 0);
            b = new THREE.Vector3(el.x * window.innerWidth / 2, lastVertex.y, 0);
        } else {
            a = new THREE.Vector3(lastVertex.x, lastVertex.y, 0);
            b = new THREE.Vector3(lastVertex.x, el.y * window.innerHeight / 2, 0);
        }

        const snapGeometry = new THREE.BufferGeometry().setFromPoints([a, b]);
        const snapLine = new THREE.Line(snapGeometry, material);
        const group = new THREE.Group();
        const circle = drawCircle(lastVertex, 0xb8a5a3, true);
        group.add(circle);
        group.add(snapLine);
        group.visible = false;
        scene.add(group);
        if (el.y == 0) {
            h_snapLine.push(group);
        } else {
            v_snapLine.push(group);
        }
    }
}

function closePolygon() {
    // close polygon
    console.log("close polygon");
    vertices.push(vertices[0]);
    updateSolidLine(vertices);
    const curveMaterial = new THREE.LineBasicMaterial({ color: 'green' });
    const curveGeometry = solidGeometry.clone();
    const curve = new THREE.LineSegments(curveGeometry, curveMaterial);
    curves.add(curve);
    solidGeometry.dispose();
    solidGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    solidLine.geometry.attributes.position.needsUpdate = true;
    vertices = [];
    while (crossings.children.length > 0) {
        crossings.remove(crossings.children[0]);
    }
    dottedGeometry.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]);
}

function onMouseDown(event) {
    event.preventDefault();
    if (crossings.children.length > 0) {
        crossings.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                if (child.material.color.equals(new THREE.Color('green'))) {
                    closePolygon();
                } else {
                    child.material.color.set('red');
                }
            }
        });
        renderer.render(scene, camera);
        return;
    }
    if (vertices.length > 0) {
        const positionAttribute = dottedGeometry.getAttribute('position');

        if (vertices.length == 1) {
            vertices[0] = new THREE.Vector3().fromBufferAttribute(positionAttribute, 0);
        }
        const endpoint = new THREE.Vector3().fromBufferAttribute(positionAttribute, 1);

        // add solid line to scene
        vertices.push(endpoint);
        updateSolidLine();
    } else {
        // add first vertex
        vertices.push(point.clone());
        updateSolidLine();
    }

    const vertex = vertices[vertices.length - 1];

    if (vertices.length > 1) {
        const lastVertex = vertices[vertices.length - 2];
        let secondLast;
        if (vertices.length > 2) {
            secondLast = vertices[vertices.length - 3];
        }
        setSnapLines(vertex, lastVertex, secondLast);
    }

    scene.add(curves);
    //render scene
    renderer.render(scene, camera);
}


function onMouseUp(event) {
    if (crossings.children.length > 0) {
        crossings.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.material.color.set(0xbb6a79);
            }
        });
        renderer.render(scene, camera);
        return;
    }
}

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

//////////////

// set up loader for converting the results to threejs
const loader = new Rhino3dmLoader()
loader.setLibraryPath('https://cdn.jsdelivr.net/npm/rhino3dm@0.15.0-beta/')

// initialise 'data' object that will be used by compute()
const data = {
    definition: 'CLT-Project.gh',
    inputs: {
        'curves': [] // start with an empty list (corresponds to "points" input)
    }
}

// Create a button element
const button = document.createElement("button");
// Set the button text
button.innerHTML = "rhino compute";
// Add an event listener to the button
// Add the button to the document body
document.body.appendChild(button);

let rhino, doc

button.addEventListener("click", function () {
    rhino3dm().then(async m => {
        rhino = m
        data.inputs['curves'] = curves;
        compute() // don't compute until user clicks - see onClick()
    })
});




/**
 * Call appserver
 */
async function compute() {

    showSpinner(true)

    // use POST request
    const request = {
        'method': 'POST',
        'body': JSON.stringify(data),
        'headers': { 'Content-Type': 'application/json' }
    }

    try {
        const response = await fetch('/solve', request)

        if (!response.ok) {
            // TODO: check for errors in response json
            throw new Error(response.statusText)
        }

        const responseJson = await response.json()

        collectResults(responseJson)

    } catch (error) {
        console.error(error)
    }
}

/**
 * Parse response
 */
function collectResults(responseJson) {

    const values = responseJson.values

    console.log(values)

    // clear doc
    try {
        if (doc !== undefined)
            doc.delete()
    } catch { }

    //console.log(values)
    doc = new rhino.File3dm()

    // for each output (RH_OUT:*)...
    for (let i = 0; i < values.length; i++) {
        // ...iterate through data tree structure...
        for (const path in values[i].InnerTree) {
            const branch = values[i].InnerTree[path]
            // ...and for each branch...
            for (let j = 0; j < branch.length; j++) {
                // ...load rhino geometry into doc
                const rhinoObject = decodeItem(branch[j])
                if (rhinoObject !== null) {
                    // console.log(rhinoObject)
                    doc.objects().add(rhinoObject, null)
                }
            }
        }
    }

    if (doc.objects().count < 1) {
        console.error('No rhino objects to load!')
        showSpinner(false)
        return
    }

    // hack (https://github.com/mcneel/rhino3dm/issues/353)
    doc.objects().addSphere(new rhino.Sphere([0, 0, 0], 0.001), null)

    // load rhino doc into three.js scene
    const buffer = new Uint8Array(doc.toByteArray()).buffer
    loader.parse(buffer, function (object) {
        // clear objects from scene
        scene.traverse(child => {
            if (!child.isLight) {
                scene.remove(child)
            }
        })

        ///////////////////////////////////////////////////////////////////////

        // render wireframe mesh
        object.traverse(child => {
            if (child.isMesh) {
                child.material = new THREE.MeshBasicMaterial({ wireframe: true, color: 'white' })
            }
        }, false)

        ///////////////////////////////////////////////////////////////////////

        // add object graph from rhino model to three.js scene
        scene.add(object)

        // hide spinner and enable download button
        showSpinner(false)
        downloadButton.disabled = false

        // zoom to extents
        // zoomCameraToSelection(camera, controls, scene.children)
    })
}

/**
 * Attempt to decode data tree item to rhino geometry
 */
function decodeItem(item) {
    const data = JSON.parse(item.data)
    if (item.type === 'System.String') {
        // hack for draco meshes
        try {
            return rhino.DracoCompression.decompressBase64String(data)
        } catch { } // ignore errors (maybe the string was just a string...)
    } else if (typeof data === 'object') {
        return rhino.CommonObject.decode(data)
    }
    return null
}

/**
 * Shows or hides the loading spinner
 */
function showSpinner(enable) {
    if (enable)
        document.getElementById('loader').style.display = 'block'
    else
        document.getElementById('loader').style.display = 'none'
}






