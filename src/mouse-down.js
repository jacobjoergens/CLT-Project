import * as THREE from 'three';
import { scene, camera, renderer } from "./init.js";
import { point, crossings, dottedLine, dottedGeometry, drawCircle } from "./mouse-move.js";

//solidLine variables
export let vertices = [];

//snapLine variables
export let h_snapLine = [];
export let v_snapLine = [];


const solidGeometry = new THREE.BufferGeometry();
solidGeometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
const solidMaterial = new THREE.LineBasicMaterial({ color: 0xbfffbf });
export const solidLine = new THREE.LineSegments(solidGeometry, solidMaterial);
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
    console.log(vertices[vertices.length-1]);
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
    
    let a,b;
    // create viable, cardinal snapLines around new vertex
    for(const el of cardinal){
        if(el.equals(last_direction)||(second_direction&&el.equals(second_direction))){
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
        const group = new THREE.Group();
        const circle = drawCircle(lastVertex, 0xb8a5a3, true);
        group.add(circle);
        group.add(snapLine);
        group.visible = false;
        scene.add(group);
        if(el.y==0){
            h_snapLine.push(group);
        } else { 
            v_snapLine.push(group);
        }
    }
}

export function onMouseDown(event){
    event.preventDefault();
    if (crossings.children.length > 0) {
        crossings.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.material.color.set('red');
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
        // check if polygon is closed
        if (vertices.length > 2 && endpoint.distanceTo(vertices[0]) < 0.1) {
            console.log("polygon closed");
            // close polygon
            vertices.push(endpoint);
            updateSolidLine(vertices);
            vertices = [];
            dottedLine = null;
            dottedGeometry = null;
            return;
        }

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
    //render scene
    renderer.render(scene, camera);
}