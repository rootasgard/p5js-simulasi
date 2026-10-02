function loadSketch() {
	const sketchName = new URLSearchParams(window.location.search).get('sketch') || 'sketch.js';
	const validSketchName = /^[\w.-]+\.js$/i.test(sketchName) ? sketchName : 'sketch.js';
	const sketchScript = document.createElement('script');
	sketchScript.src = validSketchName;
	document.body.appendChild(sketchScript);
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', loadSketch);
} else {
	loadSketch();
}
