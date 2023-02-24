import * as THREE from 'three';
import { scene, camera, renderer } from "./init.js";
import { vertices, segments, h_snapLine, v_snapLine } from "./mouse-down.js";


//initialize and export basic three variables
const rect = renderer.domElement.getBoundingClientRect();
let mouse = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
let raycaster = new THREE.Raycaster();
export let point = new THREE.Vector3();




//dottedLine variables 
export let dottedLine, dottedGeometry;


//intersection variables
export let crossings = new THREE.Group();

// preview variables
let previewGroup;

/*
Description: renders a snapGroup, consisting of a snapLine and a vertex-marking circle, visible
with one exception if the the vertex in question is the first vertex (here polygon-closing logic takes priority) 
*/
function drawPreview(snapGroup, lastVertex){
    previewGroup = snapGroup.clone();
    const ortho_vertex = previewGroup.children[0].position;

    if(ortho_vertex.x.toFixed(5)==lastVertex.x.toFixed(5)||ortho_vertex.y.toFixed(5)==lastVertex.y.toFixed(5)){
        return null;
    } else {
        previewGroup.children[0].visible = true;
        previewGroup.children[1].visible = true;
        scene.add(previewGroup);
        return ortho_vertex;
    }
}

/*
Description: returns a circle object at the position of vertex input
geometry: constant 
material: color set from input 
visibility set from input
*/
export function drawCircle(vertex, color, visibility){
    const material = new THREE.MeshBasicMaterial({ color: color });
    const geometry = new THREE.CircleGeometry(.5, 32);
    const circle = new THREE.Mesh(geometry, material);
    circle.position.set(vertex.x, vertex.y, 0);
    circle.visible = visibility; 
    return circle;
} 

export function onMouseMove(event){
    event.preventDefault();
    mouse.x = ((event.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
    mouse.y = - ((event.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;

    // calculate intersection point with plane
    raycaster.setFromCamera(mouse, camera);
    raycaster.ray.intersectPlane(plane, point);

    if (vertices.length > 0) {
        //reset scene wrt dottedLine
        if (dottedLine) {
            dottedLine.geometry.dispose();
            scene.remove(dottedLine);
        }
        if (previewGroup) {
            previewGroup.visible = false;
            scene.remove(previewGroup);
            previewGroup = null;
        }
        if (crossings.children) {
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
        let snap_intersects, orthogonal_vertex, snapSet;
        const order = [lastVertex, point];
        if (dx > dy) {
            // horizontal line
            order.reverse();
            snapSet = v_snapLine;
        } else {
            // vertical line
            snapSet = h_snapLine;
        }
        let nextVertex = new THREE.Vector3(order[0].x, order[1].y, 0);
        let direction = new THREE.Vector3().subVectors(nextVertex, lastVertex);

        if (segments.length > 0) {
            const parallel = lastVertex.clone().sub(vertices[vertices.length - 2]).normalize();
            if (direction.dot(parallel) < 0) {
                order.reverse();
            }
        }

        if (vertices.length > 2) {
            snap_intersects = raycaster.intersectObjects(snapSet);
            if (snap_intersects) {
                if (snap_intersects[0]) {
                    orthogonal_vertex = drawPreview(snap_intersects[0].object.parent, lastVertex);
                    if (orthogonal_vertex) {
                        order[order.indexOf(point)] = orthogonal_vertex;
                    }
                }
            }
        }
        nextVertex = new THREE.Vector3(order[0].x, order[1].y, 0);
        direction = new THREE.Vector3().subVectors(nextVertex, lastVertex);
        dottedGeometry = new THREE.BufferGeometry().setFromPoints([lastVertex, nextVertex]);
        dottedLine = new THREE.Line(dottedGeometry, material);
        dottedLine.computeLineDistances();



        const intersect_caster = new THREE.Raycaster(lastVertex, direction.normalize());
        for (const seg of segments.slice(0, -1)) {
            // Check for intersection between the ray and the line segment
            const intersection = intersect_caster.intersectObject(seg);

            // If there is an intersection, intersection will be a THREE.Vector3 object
            if (intersection) {
                if (intersection[0]) {
                    if (intersection[0].distance <= lastVertex.distanceTo(nextVertex)) {
                        if (!intersection[0].point.equals(vertices[0])) {
                            const circle = drawCircle(intersection[0].point, 0xbb6a79, true);
                            crossings.add(circle);
                            crossings.visible = true;
                            scene.add(crossings);
                        }
                    }
                }
            }
        }

        if (crossings.children != []) {
            scene.add(dottedLine);
        }
    }
    // render scene
    renderer.render(scene, camera);
};