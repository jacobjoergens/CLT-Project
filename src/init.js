import * as THREE from 'three';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, .1, 1000);
const renderer = new THREE.WebGLRenderer({alpha: true});
renderer.setSize(window.innerWidth, window.innerHeight*.9);
document.body.appendChild(renderer.domElement);

// Create a button element
const button = document.createElement("button");
// Set the button text
button.innerHTML = "rhino compute";
// Add an event listener to the button
button.addEventListener("click", function() {
  alert("Button clicked!");
});

// Add the button to the document body
document.body.appendChild(button);

export { scene, camera, renderer };

